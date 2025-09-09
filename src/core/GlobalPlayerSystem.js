/**
 * Global Player System for IRC MultiRPG Bot
 * Handles cross-network player registration and shared universe gameplay
 */

const EventEmitter = require('events');
const winston = require('winston');
const _ = require('lodash');

class GlobalPlayerSystem extends EventEmitter {
  constructor(config, globalSync, playerClasses, guildSystem) {
    super();
    this.config = config;
    this.globalSync = globalSync;
    this.playerClasses = playerClasses;
    this.guildSystem = guildSystem;
    
    this.globalPlayers = new Map(); // globalPlayerId -> player data
    this.networkPlayers = new Map(); // networkId -> Set of playerIds
    this.playerNetworks = new Map(); // playerId -> Set of networkIds
    this.playerSessions = new Map(); // playerId -> active sessions
    
    this.logger = winston.createLogger({
      level: this.config.get('global.logLevel', 'info'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'global-player-system' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.init();
  }

  /**
   * Initialize global player system
   */
  init() {
    this.setupEventHandlers();
    this.startPlayerProcessing();
    
    this.logger.info('🌍 Global player system initialized - Shared universe enabled!');
  }

  /**
   * Register player globally across all networks
   * @param {string} playerId - Player ID
   * @param {string} networkId - Network ID where player registered
   * @param {Object} playerData - Initial player data
   */
  async registerGlobalPlayer(playerId, networkId, playerData = {}) {
    const globalPlayerId = this.generateGlobalPlayerId(playerId);
    
    // Check if player already exists globally
    let globalPlayer = this.globalPlayers.get(globalPlayerId);
    
    if (!globalPlayer) {
      // Create new global player
      globalPlayer = {
        globalId: globalPlayerId,
        originalPlayerId: playerId,
        originalNetwork: networkId,
        level: playerData.level || 1,
        exp: playerData.exp || 0,
        gold: playerData.gold || 100,
        hp: playerData.hp || 100,
        attack: playerData.attack || 50,
        defense: playerData.defense || 25,
        speed: playerData.speed || 50,
        magic: playerData.magic || 30,
        mana: playerData.mana || 60,
        alignment: playerData.alignment || 'neutral',
        class: playerData.class || 'warrior',
        guild: null,
        networks: new Set([networkId]),
        sessions: new Map(),
        stats: {
          totalBattles: 0,
          totalWins: 0,
          totalLosses: 0,
          totalQuests: 0,
          totalTournaments: 0,
          totalExperience: 0,
          totalGold: 0,
          achievements: [],
          titles: [],
          items: []
        },
        created: Date.now(),
        lastActive: Date.now(),
        isOnline: false
      };

      this.globalPlayers.set(globalPlayerId, globalPlayer);
      
      // Assign default class if not specified
      if (!playerData.class) {
        await this.playerClasses.assignClass(globalPlayerId, 'warrior', globalPlayer);
      }

      // Auto-recruit to guild
      await this.guildSystem.autoRecruitPlayer(globalPlayerId, globalPlayer);

      this.logger.info(`🌍 New global player registered: ${playerId} from ${networkId}`);
      this.emit('playerRegistered', { playerId, networkId, globalPlayer });

      // Broadcast new player welcome
      await this.globalSync.broadcast(
        `🌟 Welcome to the shared universe, ${playerId}! You can now play across all networks! 🌟`,
        'player_registration',
        { playerId, networkId, globalPlayer }
      );

    } else {
      // Player exists, add network
      globalPlayer.networks.add(networkId);
      globalPlayer.lastActive = Date.now();
      
      this.logger.info(`🌍 Player ${playerId} connected from additional network: ${networkId}`);
      this.emit('playerConnected', { playerId, networkId, globalPlayer });
    }

    // Update network mappings
    if (!this.networkPlayers.has(networkId)) {
      this.networkPlayers.set(networkId, new Set());
    }
    this.networkPlayers.get(networkId).add(globalPlayerId);

    if (!this.playerNetworks.has(globalPlayerId)) {
      this.playerNetworks.set(globalPlayerId, new Set());
    }
    this.playerNetworks.get(globalPlayerId).add(networkId);

    return globalPlayer;
  }

  /**
   * Update player session
   * @param {string} playerId - Player ID
   * @param {string} networkId - Network ID
   * @param {Object} sessionData - Session data
   */
  async updatePlayerSession(playerId, networkId, sessionData = {}) {
    const globalPlayerId = this.generateGlobalPlayerId(playerId);
    const globalPlayer = this.globalPlayers.get(globalPlayerId);
    
    if (!globalPlayer) {
      // Auto-register if not exists
      return await this.registerGlobalPlayer(playerId, networkId, sessionData);
    }

    // Update session
    globalPlayer.sessions.set(networkId, {
      ...sessionData,
      lastSeen: Date.now(),
      isActive: true
    });

    globalPlayer.lastActive = Date.now();
    globalPlayer.isOnline = true;

    // Update player stats if provided
    if (sessionData.level) globalPlayer.level = sessionData.level;
    if (sessionData.exp) globalPlayer.exp = sessionData.exp;
    if (sessionData.gold) globalPlayer.gold = sessionData.gold;
    if (sessionData.hp) globalPlayer.hp = sessionData.hp;
    if (sessionData.attack) globalPlayer.attack = sessionData.attack;
    if (sessionData.defense) globalPlayer.defense = sessionData.defense;

    // Sync with global sync system
    await this.globalSync.updatePlayerState(globalPlayerId, globalPlayer, 'global-player-system');

    this.emit('playerSessionUpdated', { playerId, networkId, globalPlayer });
    return globalPlayer;
  }

  /**
   * Get global player data
   * @param {string} playerId - Player ID
   * @param {string} networkId - Network ID (optional)
   */
  getGlobalPlayer(playerId, networkId = null) {
    const globalPlayerId = this.generateGlobalPlayerId(playerId);
    const globalPlayer = this.globalPlayers.get(globalPlayerId);
    
    if (!globalPlayer) {
      return null;
    }

    // If networkId specified, include session data
    if (networkId && globalPlayer.sessions.has(networkId)) {
      return {
        ...globalPlayer,
        currentSession: globalPlayer.sessions.get(networkId),
        currentNetwork: networkId
      };
    }

    return globalPlayer;
  }

  /**
   * Get all players across all networks
   * @param {Object} filters - Filter criteria
   */
  getAllGlobalPlayers(filters = {}) {
    let players = Array.from(this.globalPlayers.values());

    if (filters.networkId) {
      players = players.filter(player => player.networks.has(filters.networkId));
    }

    if (filters.minLevel) {
      players = players.filter(player => player.level >= filters.minLevel);
    }

    if (filters.maxLevel) {
      players = players.filter(player => player.level <= filters.maxLevel);
    }

    if (filters.class) {
      players = players.filter(player => player.class === filters.class);
    }

    if (filters.guild) {
      players = players.filter(player => player.guild === filters.guild);
    }

    if (filters.online) {
      players = players.filter(player => player.isOnline);
    }

    return players;
  }

  /**
   * Get online players across all networks
   */
  getOnlinePlayers() {
    return this.getAllGlobalPlayers({ online: true });
  }

  /**
   * Get players by network
   * @param {string} networkId - Network ID
   */
  getNetworkPlayers(networkId) {
    const playerIds = this.networkPlayers.get(networkId) || new Set();
    return Array.from(playerIds).map(id => this.globalPlayers.get(id)).filter(Boolean);
  }

  /**
   * Find cross-network opponents for battles
   * @param {string} playerId - Player ID
   * @param {Object} criteria - Matchmaking criteria
   */
  findCrossNetworkOpponents(playerId, criteria = {}) {
    const globalPlayer = this.getGlobalPlayer(playerId);
    if (!globalPlayer) {
      return [];
    }

    const allPlayers = this.getAllGlobalPlayers({
      minLevel: criteria.minLevel || globalPlayer.level - 5,
      maxLevel: criteria.maxLevel || globalPlayer.level + 5,
      online: true
    });

    // Filter out the requesting player
    const opponents = allPlayers.filter(player => 
      player.globalId !== globalPlayer.globalId
    );

    // Sort by level proximity and activity
    opponents.sort((a, b) => {
      const levelDiffA = Math.abs(a.level - globalPlayer.level);
      const levelDiffB = Math.abs(b.level - globalPlayer.level);
      
      if (levelDiffA !== levelDiffB) {
        return levelDiffA - levelDiffB;
      }
      
      return b.lastActive - a.lastActive;
    });

    return opponents.slice(0, criteria.limit || 10);
  }

  /**
   * Start cross-network battle
   * @param {string} player1Id - First player ID
   * @param {string} player2Id - Second player ID
   * @param {string} network1Id - First player's network
   * @param {string} network2Id - Second player's network
   */
  async startCrossNetworkBattle(player1Id, player2Id, network1Id, network2Id) {
    const player1 = this.getGlobalPlayer(player1Id, network1Id);
    const player2 = this.getGlobalPlayer(player2Id, network2Id);

    if (!player1 || !player2) {
      throw new Error('One or both players not found');
    }

    // Broadcast cross-network battle announcement
    await this.globalSync.broadcast(
      `⚔️ CROSS-NETWORK BATTLE! ${player1Id} (${network1Id}) vs ${player2Id} (${network2Id})! Epic clash incoming! ⚔️`,
      'cross_network_battle',
      { player1, player2, network1Id, network2Id }
    );

    this.logger.info(`⚔️ Cross-network battle: ${player1Id} vs ${player2Id}`);
    this.emit('crossNetworkBattleStarted', { player1, player2, network1Id, network2Id });

    return { player1, player2, network1Id, network2Id };
  }

  /**
   * Update player statistics globally
   * @param {string} playerId - Player ID
   * @param {Object} stats - Statistics to update
   */
  async updatePlayerStats(playerId, stats) {
    const globalPlayer = this.getGlobalPlayer(playerId);
    if (!globalPlayer) {
      throw new Error('Player not found');
    }

    // Update stats
    Object.assign(globalPlayer.stats, stats);
    globalPlayer.lastActive = Date.now();

    // Sync with global sync system
    await this.globalSync.updatePlayerState(globalPlayer.globalId, globalPlayer, 'global-player-system');

    this.emit('playerStatsUpdated', { playerId, globalPlayer, stats });
    return globalPlayer;
  }

  /**
   * Level up player globally
   * @param {string} playerId - Player ID
   * @param {number} newLevel - New level
   * @param {Object} rewards - Level up rewards
   */
  async levelUpPlayer(playerId, newLevel, rewards = {}) {
    const globalPlayer = this.getGlobalPlayer(playerId);
    if (!globalPlayer) {
      throw new Error('Player not found');
    }

    const oldLevel = globalPlayer.level;
    globalPlayer.level = newLevel;
    globalPlayer.exp += rewards.exp || 0;
    globalPlayer.gold += rewards.gold || 0;
    globalPlayer.lastActive = Date.now();

    // Update class level
    await this.playerClasses.levelUpClass(globalPlayer.globalId, newLevel - oldLevel);

    // Sync with global sync system
    await this.globalSync.updatePlayerState(globalPlayer.globalId, globalPlayer, 'global-player-system');

    // Broadcast level up across all networks
    await this.globalSync.broadcast(
      `🎉 ${playerId} has reached level ${newLevel}! Congratulations on your incredible progress! 🎉`,
      'level_up',
      { playerId, oldLevel, newLevel, rewards, globalPlayer }
    );

    this.logger.info(`🎉 Global level up: ${playerId} -> Level ${newLevel}`);
    this.emit('playerLeveledUp', { playerId, oldLevel, newLevel, globalPlayer });

    return globalPlayer;
  }

  /**
   * Get global leaderboard
   * @param {Object} options - Leaderboard options
   */
  getGlobalLeaderboard(options = {}) {
    const players = this.getAllGlobalPlayers(options);
    const sortBy = options.sortBy || 'level';
    const limit = options.limit || 10;

    players.sort((a, b) => {
      switch (sortBy) {
        case 'level':
          if (b.level !== a.level) return b.level - a.level;
          return b.exp - a.exp;
        case 'gold':
          return b.gold - a.gold;
        case 'battles':
          return b.stats.totalBattles - a.stats.totalBattles;
        case 'wins':
          return b.stats.totalWins - a.stats.totalWins;
        case 'quests':
          return b.stats.totalQuests - a.stats.totalQuests;
        default:
          return b.level - a.level;
      }
    });

    return players.slice(0, limit);
  }

  /**
   * Get global statistics
   */
  getGlobalStats() {
    const players = this.getAllGlobalPlayers();
    const onlinePlayers = this.getOnlinePlayers();
    
    const stats = {
      totalPlayers: players.length,
      onlinePlayers: onlinePlayers.length,
      totalNetworks: this.networkPlayers.size,
      averageLevel: 0,
      totalBattles: 0,
      totalQuests: 0,
      totalTournaments: 0,
      classDistribution: {},
      guildDistribution: {},
      networkDistribution: {}
    };

    if (players.length > 0) {
      let totalLevel = 0;
      
      for (const player of players) {
        totalLevel += player.level;
        stats.totalBattles += player.stats.totalBattles;
        stats.totalQuests += player.stats.totalQuests;
        stats.totalTournaments += player.stats.totalTournaments;
        
        stats.classDistribution[player.class] = (stats.classDistribution[player.class] || 0) + 1;
        if (player.guild) {
          stats.guildDistribution[player.guild] = (stats.guildDistribution[player.guild] || 0) + 1;
        }
        
        for (const networkId of player.networks) {
          stats.networkDistribution[networkId] = (stats.networkDistribution[networkId] || 0) + 1;
        }
      }
      
      stats.averageLevel = Math.floor(totalLevel / players.length);
    }

    return stats;
  }

  /**
   * Start player processing loop
   */
  startPlayerProcessing() {
    setInterval(() => {
      this.processPlayerSessions();
      this.cleanupInactivePlayers();
    }, 30000); // Every 30 seconds
  }

  /**
   * Process player sessions
   */
  processPlayerSessions() {
    const now = Date.now();
    const timeout = 300000; // 5 minutes

    for (const [globalPlayerId, globalPlayer] of this.globalPlayers) {
      let hasActiveSession = false;

      for (const [networkId, session] of globalPlayer.sessions) {
        if (now - session.lastSeen < timeout) {
          hasActiveSession = true;
        } else {
          // Mark session as inactive
          session.isActive = false;
        }
      }

      globalPlayer.isOnline = hasActiveSession;
    }
  }

  /**
   * Cleanup inactive players
   */
  cleanupInactivePlayers() {
    const now = Date.now();
    const cleanupTimeout = 86400000; // 24 hours

    for (const [globalPlayerId, globalPlayer] of this.globalPlayers) {
      if (now - globalPlayer.lastActive > cleanupTimeout && !globalPlayer.isOnline) {
        // Remove from network mappings
        for (const networkId of globalPlayer.networks) {
          const networkPlayers = this.networkPlayers.get(networkId);
          if (networkPlayers) {
            networkPlayers.delete(globalPlayerId);
          }
        }

        this.playerNetworks.delete(globalPlayerId);
        this.globalPlayers.delete(globalPlayerId);

        this.logger.info(`🧹 Cleaned up inactive player: ${globalPlayerId}`);
      }
    }
  }

  /**
   * Generate global player ID
   * @param {string} playerId - Original player ID
   */
  generateGlobalPlayerId(playerId) {
    return `global_${playerId}`;
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.on('playerRegistered', (data) => {
      this.logger.info(`Player registered: ${data.playerId} from ${data.networkId}`);
    });

    this.on('playerConnected', (data) => {
      this.logger.info(`Player connected: ${data.playerId} from ${data.networkId}`);
    });

    this.on('playerSessionUpdated', (data) => {
      this.logger.debug(`Player session updated: ${data.playerId} on ${data.networkId}`);
    });

    this.on('playerLeveledUp', (data) => {
      this.logger.info(`Player leveled up: ${data.playerId} -> Level ${data.newLevel}`);
    });

    this.on('crossNetworkBattleStarted', (data) => {
      this.logger.info(`Cross-network battle: ${data.player1.originalPlayerId} vs ${data.player2.originalPlayerId}`);
    });
  }

  /**
   * Cleanup and close
   */
  cleanup() {
    this.logger.info('🧹 Global player system cleanup completed');
  }
}

module.exports = GlobalPlayerSystem;