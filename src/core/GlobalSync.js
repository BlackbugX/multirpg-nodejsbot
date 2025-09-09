/**
 * Global Synchronization System
 * Handles cross-network gameplay and event propagation
 */

const EventEmitter = require('events');
const Redis = require('redis');
const winston = require('winston');

class GlobalSync extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.redis = null;
    this.isConnected = false;
    this.networks = new Map();
    this.globalEvents = new Map();
    this.playerStates = new Map();
    this.battleQueue = [];
    this.tournamentQueue = [];
    
    this.logger = winston.createLogger({
      level: this.config.get('global.logLevel', 'info'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'global-sync' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.init();
  }

  /**
   * Initialize global synchronization
   */
  async init() {
    if (this.config.get('global.enableRedis', true)) {
      await this.connectRedis();
    }
    
    this.setupEventHandlers();
    this.startSyncLoop();
    
    this.logger.info('🌐 Global synchronization system initialized');
  }

  /**
   * Connect to Redis for global state management
   */
  async connectRedis() {
    try {
      this.redis = Redis.createClient({
        url: this.config.get('global.redisUrl', 'redis://localhost:6379')
      });

      this.redis.on('error', (err) => {
        this.logger.error('Redis connection error:', err);
      });

      this.redis.on('connect', () => {
        this.isConnected = true;
        this.logger.info('🔗 Connected to Redis for global sync');
      });

      this.redis.on('disconnect', () => {
        this.isConnected = false;
        this.logger.warn('⚠️ Disconnected from Redis');
      });

      await this.redis.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      this.isConnected = false;
    }
  }

  /**
   * Register a network for global synchronization
   * @param {string} networkId - Network identifier
   * @param {Object} networkBot - Network bot instance
   */
  registerNetwork(networkId, networkBot) {
    this.networks.set(networkId, {
      bot: networkBot,
      connected: false,
      lastSync: Date.now(),
      players: new Map()
    });

    this.logger.info(`📡 Registered network: ${networkId}`);
  }

  /**
   * Set network connection status
   * @param {string} networkId - Network identifier
   * @param {boolean} connected - Connection status
   */
  setNetworkStatus(networkId, connected) {
    const network = this.networks.get(networkId);
    if (network) {
      network.connected = connected;
      network.lastSync = Date.now();
      this.logger.info(`📡 Network ${networkId} ${connected ? 'connected' : 'disconnected'}`);
    }
  }

  /**
   * Broadcast message to all networks
   * @param {string} message - Message to broadcast
   * @param {string} type - Message type (battle, levelup, tournament, etc.)
   * @param {Object} data - Additional data
   */
  async broadcast(message, type = 'general', data = {}) {
    const broadcastData = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type,
      message,
      data,
      source: 'global-sync'
    };

    // Store in Redis if available
    if (this.isConnected) {
      try {
        await this.redis.lPush('global:events', JSON.stringify(broadcastData));
        await this.redis.lTrim('global:events', 0, 999); // Keep last 1000 events
      } catch (error) {
        this.logger.error('Failed to store event in Redis:', error);
      }
    }

    // Broadcast to all connected networks
    for (const [networkId, network] of this.networks) {
      if (network.connected && network.bot) {
        try {
          await this.sendToNetwork(networkId, message, type, data);
        } catch (error) {
          this.logger.error(`Failed to broadcast to network ${networkId}:`, error);
        }
      }
    }

    this.emit('broadcast', broadcastData);
  }

  /**
   * Send message to specific network
   * @param {string} networkId - Target network
   * @param {string} message - Message to send
   * @param {string} type - Message type
   * @param {Object} data - Additional data
   */
  async sendToNetwork(networkId, message, type, data) {
    const network = this.networks.get(networkId);
    if (!network || !network.connected) {
      return;
    }

    const networkConfig = this.config.getNetwork(networkId);
    if (!networkConfig) {
      return;
    }

    // Format message based on type
    const formattedMessage = this.formatMessage(message, type, data);
    
    // Send to game channel
    if (networkConfig.irc.gameChannel) {
      network.bot.irc.privmsg(networkConfig.irc.gameChannel, formattedMessage);
    }

    // Send to admin channel for important events
    if (type === 'admin' && networkConfig.irc.adminChannel) {
      network.bot.irc.privmsg(networkConfig.irc.adminChannel, formattedMessage);
    }
  }

  /**
   * Format message with emojis and rich formatting
   * @param {string} message - Base message
   * @param {string} type - Message type
   * @param {Object} data - Additional data
   */
  formatMessage(message, type, data) {
    if (!this.config.get('messages.enableEmojis', true)) {
      return message;
    }

    const emojis = {
      battle: '⚔️',
      levelup: '🎉',
      tournament: '🏆',
      milestone: '🌟',
      quest: '📜',
      admin: '👑',
      error: '❌',
      success: '✅',
      info: 'ℹ️',
      warning: '⚠️',
      general: '🎮'
    };

    const emoji = emojis[type] || emojis.general;
    return `${emoji} ${message}`;
  }

  /**
   * Update player state globally
   * @param {string} playerId - Player identifier
   * @param {Object} state - Player state data
   * @param {string} networkId - Source network
   */
  async updatePlayerState(playerId, state, networkId) {
    const playerData = {
      ...state,
      networkId,
      lastUpdate: Date.now(),
      globalId: this.generateGlobalPlayerId(playerId, networkId)
    };

    this.playerStates.set(playerData.globalId, playerData);

    // Store in Redis if available
    if (this.isConnected) {
      try {
        await this.redis.hSet('global:players', playerData.globalId, JSON.stringify(playerData));
      } catch (error) {
        this.logger.error('Failed to store player state in Redis:', error);
      }
    }

    this.emit('playerUpdate', playerData);
  }

  /**
   * Get player state
   * @param {string} playerId - Player identifier
   * @param {string} networkId - Network identifier
   */
  getPlayerState(playerId, networkId) {
    const globalId = this.generateGlobalPlayerId(playerId, networkId);
    return this.playerStates.get(globalId);
  }

  /**
   * Get all players across networks
   * @param {Object} filters - Filter criteria
   */
  getAllPlayers(filters = {}) {
    const players = Array.from(this.playerStates.values());
    
    return players.filter(player => {
      if (filters.networkId && player.networkId !== filters.networkId) return false;
      if (filters.minLevel && player.level < filters.minLevel) return false;
      if (filters.maxLevel && player.level > filters.maxLevel) return false;
      if (filters.alignment && player.alignment !== filters.alignment) return false;
      return true;
    });
  }

  /**
   * Add battle to global queue
   * @param {Object} battle - Battle data
   */
  async addBattle(battle) {
    const battleData = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      ...battle,
      status: 'queued'
    };

    this.battleQueue.push(battleData);

    // Store in Redis if available
    if (this.isConnected) {
      try {
        await this.redis.lPush('global:battles', JSON.stringify(battleData));
      } catch (error) {
        this.logger.error('Failed to store battle in Redis:', error);
      }
    }

    this.emit('battleQueued', battleData);
    return battleData;
  }

  /**
   * Process battle queue
   */
  async processBattleQueue() {
    if (this.battleQueue.length === 0) return;

    const battle = this.battleQueue.shift();
    battle.status = 'processing';

    try {
      // Find suitable opponent
      const opponent = await this.findOpponent(battle.player1, battle.criteria);
      
      if (opponent) {
        battle.player2 = opponent;
        battle.status = 'matched';
        this.emit('battleMatched', battle);
      } else {
        battle.status = 'no_opponent';
        this.battleQueue.push(battle); // Re-queue for later
      }
    } catch (error) {
      this.logger.error('Failed to process battle:', error);
      battle.status = 'error';
    }
  }

  /**
   * Find suitable opponent for battle
   * @param {Object} player1 - First player
   * @param {Object} criteria - Matchmaking criteria
   */
  async findOpponent(player1, criteria = {}) {
    const allPlayers = this.getAllPlayers({
      minLevel: criteria.minLevel || player1.level - 5,
      maxLevel: criteria.maxLevel || player1.level + 5
    });

    // Filter out the requesting player
    const opponents = allPlayers.filter(player => 
      player.globalId !== player1.globalId && 
      player.networkId !== player1.networkId // Prefer cross-network battles
    );

    if (opponents.length === 0) return null;

    // Simple random selection for now
    // TODO: Implement advanced matchmaking algorithm
    return opponents[Math.floor(Math.random() * opponents.length)];
  }

  /**
   * Add tournament to global queue
   * @param {Object} tournament - Tournament data
   */
  async addTournament(tournament) {
    const tournamentData = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      ...tournament,
      status: 'scheduled',
      participants: []
    };

    this.tournamentQueue.push(tournamentData);

    // Store in Redis if available
    if (this.isConnected) {
      try {
        await this.redis.lPush('global:tournaments', JSON.stringify(tournamentData));
      } catch (error) {
        this.logger.error('Failed to store tournament in Redis:', error);
      }
    }

    this.emit('tournamentScheduled', tournamentData);
    return tournamentData;
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.on('playerUpdate', (playerData) => {
      this.logger.debug(`Player updated: ${playerData.globalId}`);
    });

    this.on('battleQueued', (battle) => {
      this.logger.info(`Battle queued: ${battle.player1.name} vs TBD`);
    });

    this.on('battleMatched', (battle) => {
      this.logger.info(`Battle matched: ${battle.player1.name} vs ${battle.player2.name}`);
    });

    this.on('tournamentScheduled', (tournament) => {
      this.logger.info(`Tournament scheduled: ${tournament.name}`);
    });
  }

  /**
   * Start synchronization loop
   */
  startSyncLoop() {
    setInterval(async () => {
      await this.processBattleQueue();
      await this.syncPlayerStates();
    }, 5000); // Every 5 seconds
  }

  /**
   * Sync player states from Redis
   */
  async syncPlayerStates() {
    if (!this.isConnected) return;

    try {
      const playerData = await this.redis.hGetAll('global:players');
      for (const [globalId, data] of Object.entries(playerData)) {
        const player = JSON.parse(data);
        this.playerStates.set(globalId, player);
      }
    } catch (error) {
      this.logger.error('Failed to sync player states:', error);
    }
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate global player ID
   * @param {string} playerId - Local player ID
   * @param {string} networkId - Network ID
   */
  generateGlobalPlayerId(playerId, networkId) {
    return `${networkId}:${playerId}`;
  }

  /**
   * Get global statistics
   */
  getGlobalStats() {
    return {
      totalNetworks: this.networks.size,
      connectedNetworks: Array.from(this.networks.values()).filter(n => n.connected).length,
      totalPlayers: this.playerStates.size,
      queuedBattles: this.battleQueue.length,
      scheduledTournaments: this.tournamentQueue.length,
      redisConnected: this.isConnected
    };
  }

  /**
   * Cleanup and close connections
   */
  async cleanup() {
    if (this.redis && this.isConnected) {
      await this.redis.quit();
    }
    this.logger.info('🧹 Global sync cleanup completed');
  }
}

module.exports = GlobalSync;