/**
 * Enhanced MultiRPG Bot for IRC Networks
 * Main entry point with modular architecture and global synchronization
 */

const config = require('./config/config');
const factory = require('irc-factory');
const api = new factory.Api();

// Core systems
const GlobalSync = require('./core/GlobalSync');
const Matchmaking = require('./core/Matchmaking');
const QuestSystem = require('./core/QuestSystem');
const LevelProgression = require('./core/LevelProgression');
const BattleSystem = require('./core/BattleSystem');
const TournamentSystem = require('./core/TournamentSystem');
const AdminTools = require('./core/AdminTools');
const Database = require('./core/Database');

// Utilities
const winston = require('winston');
const wildcard = require('node-wildcard');

class MultiRPGBot {
  constructor() {
    this.config = config;
    this.api = api;
    this.clients = new Map(); // networkId -> client
    this.networks = new Map(); // networkId -> network data
    
    // Core systems
    this.globalSync = null;
    this.matchmaking = null;
    this.questSystem = null;
    this.levelProgression = null;
    this.battleSystem = null;
    this.tournamentSystem = null;
    this.adminTools = null;
    this.database = null;
    
    // Bot state
    this.isRunning = false;
    this.startTime = Date.now();
    
    this.logger = winston.createLogger({
      level: this.config.get('global.logLevel', 'info'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'multirpg-bot' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.init();
  }

  /**
   * Initialize the bot
   */
  async init() {
    try {
      this.logger.info('🚀 Starting Enhanced MultiRPG Bot...');
      
      // Initialize core systems
      await this.initializeSystems();
      
      // Setup IRC clients for each network
      await this.setupNetworks();
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Start the bot
      this.isRunning = true;
      
      this.logger.info('✅ Enhanced MultiRPG Bot started successfully!');
      await this.globalSync.broadcast(
        '🎮 Enhanced MultiRPG Bot is now online! Ready for epic adventures across all networks! 🎮',
        'startup',
        { bot: 'MultiRPG-Enhanced' }
      );
      
    } catch (error) {
      this.logger.error('❌ Failed to start bot:', error);
      throw error;
    }
  }

  /**
   * Initialize core systems
   */
  async initializeSystems() {
    this.logger.info('🔧 Initializing core systems...');
    
    // Initialize database first
    this.database = new Database(this.config);
    
    // Initialize global synchronization
    this.globalSync = new GlobalSync(this.config);
    
    // Initialize other systems
    this.matchmaking = new Matchmaking(this.config, this.globalSync);
    this.questSystem = new QuestSystem(this.config, this.globalSync);
    this.levelProgression = new LevelProgression(this.config, this.globalSync);
    this.battleSystem = new BattleSystem(this.config, this.globalSync, this.matchmaking);
    this.tournamentSystem = new TournamentSystem(this.config, this.globalSync, this.battleSystem, this.matchmaking);
    this.adminTools = new AdminTools(this.config, this.globalSync, this.battleSystem, this.tournamentSystem, this.questSystem, this.levelProgression);
    
    this.logger.info('✅ Core systems initialized');
  }

  /**
   * Setup IRC networks
   */
  async setupNetworks() {
    const networks = this.config.getEnabledNetworks();
    
    for (const networkConfig of networks) {
      await this.setupNetwork(networkConfig);
    }
    
    this.logger.info(`🌐 Setup complete for ${networks.length} networks`);
  }

  /**
   * Setup individual network
   * @param {Object} networkConfig - Network configuration
   */
  async setupNetwork(networkConfig) {
    const client = this.api.createClient(networkConfig.id, {
      nick: networkConfig.irc.nick,
      user: networkConfig.irc.user,
      server: networkConfig.irc.server,
      realname: networkConfig.irc.realname,
      password: networkConfig.irc.password,
      port: networkConfig.irc.port,
      secure: networkConfig.irc.secure
    });

    this.clients.set(networkConfig.id, client);
    this.networks.set(networkConfig.id, networkConfig);

    // Register network with global sync
    this.globalSync.registerNetwork(networkConfig.id, client);

    // Setup network event handlers
    this.setupNetworkHandlers(networkConfig.id, client, networkConfig);
  }

  /**
   * Setup network event handlers
   * @param {string} networkId - Network ID
   * @param {Object} client - IRC client
   * @param {Object} networkConfig - Network configuration
   */
  setupNetworkHandlers(networkId, client, networkConfig) {
    // On registered
    this.api.hookEvent(networkId, 'registered', async () => {
      this.logger.info(`🔗 Connected to ${networkConfig.name} (${networkConfig.irc.server})`);
      this.globalSync.setNetworkStatus(networkId, true);
      
      // Join channels
      for (const channel of networkConfig.irc.channels) {
        client.irc.join(channel);
        this.logger.info(`📺 Joined channel: ${channel}`);
      }
      
      // Join admin channel if specified
      if (networkConfig.irc.adminChannel) {
        client.irc.join(networkConfig.irc.adminChannel);
        this.logger.info(`👑 Joined admin channel: ${networkConfig.irc.adminChannel}`);
      }
      
      // Login to game service
      if (networkConfig.game.autoLogin) {
        client.irc.privmsg(networkConfig.game.nickname, `login ${networkConfig.irc.nick} ${networkConfig.game.password}`);
        this.logger.info(`🎮 Logged into game service`);
      }
    });

    // On disconnect
    this.api.hookEvent(networkId, 'disconnect', () => {
      this.logger.warn(`⚠️ Disconnected from ${networkConfig.name}`);
      this.globalSync.setNetworkStatus(networkId, false);
    });

    // On private messages (game commands)
    this.api.hookEvent(networkId, 'privmsg', async (message) => {
      if (message.nickname === networkConfig.game.nickname && message.target === networkConfig.irc.nick) {
        await this.handleGameMessage(message, networkId, networkConfig);
      }
    });

    // On channel messages (player commands)
    this.api.hookEvent(networkId, 'privmsg', async (message) => {
      if (networkConfig.irc.channels.includes(message.target)) {
        await this.handleChannelMessage(message, networkId, networkConfig);
      }
    });

    // On admin channel messages
    this.api.hookEvent(networkId, 'privmsg', async (message) => {
      if (networkConfig.irc.adminChannel && message.target === networkConfig.irc.adminChannel) {
        await this.handleAdminMessage(message, networkId, networkConfig);
      }
    });
  }

  /**
   * Handle game service messages
   * @param {Object} message - IRC message
   * @param {string} networkId - Network ID
   * @param {Object} networkConfig - Network configuration
   */
  async handleGameMessage(message, networkId, networkConfig) {
    const msg = message.message.trim();
    
    // Handle game responses
    if (wildcard(msg, 'level*gold*bank*slayttl*')) {
      await this.handlePlayerStats(msg, networkId, networkConfig);
    } else if (wildcard(msg, 'You have deposited * gold into the bank.')) {
      this.logger.info(`💰 Deposited gold to bank`);
    } else if (wildcard(msg, 'You have withdrawn * gold from the bank.')) {
      this.logger.info(`💰 Withdrawn gold from bank`);
    } else if (wildcard(msg, 'You are not logged in*')) {
      // Auto-reconnect
      if (networkConfig.game.autoReconnect) {
        setTimeout(() => {
          this.clients.get(networkId).irc.privmsg(networkConfig.game.nickname, `login ${networkConfig.irc.nick} ${networkConfig.game.password}`);
        }, networkConfig.game.reconnectDelay);
      }
    }
  }

  /**
   * Handle player stats from game
   * @param {string} stats - Stats string
   * @param {string} networkId - Network ID
   * @param {Object} networkConfig - Network configuration
   */
  async handlePlayerStats(stats, networkId, networkConfig) {
    try {
      const arr = stats.split(' ');
      const playerData = {
        level: Number(arr[1]),
        gold: Number(arr[3]),
        bank: Number(arr[5]),
        team: Number(arr[7]),
        sum: Number(arr[9]),
        fights: Number(arr[11]),
        bets: Number(arr[13]),
        powerpots: Number(arr[15]),
        luckpots: Number(arr[17]),
        align: arr[19],
        attackttl: Number(arr[21]),
        challengettl: Number(arr[23]),
        slayttl: Number(arr[25]),
        ttl: Number(arr[27]),
        hero: Number(arr[29]),
        hlevel: Number(arr[31]),
        engineer: Number(arr[33]),
        englevel: Number(arr[35])
      };

      // Update player state globally
      await this.globalSync.updatePlayerState(networkConfig.irc.nick, {
        ...playerData,
        networkId,
        lastUpdate: Date.now()
      }, networkId);

      // Auto-level up if applicable
      if (playerData.level > 1) {
        await this.levelProgression.levelUp(networkConfig.irc.nick, {
          level: playerData.level,
          networkId
        });
      }

      // Auto-battle logic
      if (playerData.level >= 10 && playerData.fights < 5) {
        await this.triggerAutoBattle(playerData, networkId, networkConfig);
      }

      // Auto-quest logic
      if (playerData.level >= 5) {
        await this.triggerAutoQuest(playerData, networkId, networkConfig);
      }

    } catch (error) {
      this.logger.error('Error parsing player stats:', error);
    }
  }

  /**
   * Handle channel messages (player commands)
   * @param {Object} message - IRC message
   * @param {string} networkId - Network ID
   * @param {Object} networkConfig - Network configuration
   */
  async handleChannelMessage(message, networkId, networkConfig) {
    const msg = message.message.trim();
    const user = message.nickname;
    
    // Check if user is banned
    if (this.adminTools.bannedUsers.has(user.toLowerCase())) {
      return;
    }

    // Handle player commands
    if (msg.startsWith('!')) {
      await this.handlePlayerCommand(msg, user, networkId, networkConfig, message.target);
    }
  }

  /**
   * Handle admin messages
   * @param {Object} message - IRC message
   * @param {string} networkId - Network ID
   * @param {Object} networkConfig - Network configuration
   */
  async handleAdminMessage(message, networkId, networkConfig) {
    const msg = message.message.trim();
    const user = message.nickname;
    
    if (msg.startsWith('!')) {
      await this.adminTools.processCommand(msg, user, networkId, {
        channel: message.target,
        network: networkConfig
      });
    }
  }

  /**
   * Handle player commands
   * @param {string} command - Command string
   * @param {string} user - Username
   * @param {string} networkId - Network ID
   * @param {Object} networkConfig - Network configuration
   * @param {string} channel - Channel name
   */
  async handlePlayerCommand(command, user, networkId, networkConfig, channel) {
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    try {
      switch (cmd) {
        case '!help':
          await this.sendMessage(networkId, channel, this.getHelpMessage());
          break;
          
        case '!status':
          await this.sendMessage(networkId, channel, await this.getStatusMessage());
          break;
          
        case '!level':
          const playerLevel = this.levelProgression.getPlayerLevel(user);
          await this.sendMessage(networkId, channel, `📊 Your level: ${playerLevel}`);
          break;
          
        case '!quest':
          await this.handleQuestCommand(args, user, networkId, channel);
          break;
          
        case '!battle':
          await this.handleBattleCommand(args, user, networkId, channel);
          break;
          
        case '!tournament':
          await this.handleTournamentCommand(args, user, networkId, channel);
          break;
          
        case '!leaderboard':
          await this.handleLeaderboardCommand(args, user, networkId, channel);
          break;
          
        case '!achievements':
          await this.handleAchievementsCommand(user, networkId, channel);
          break;
          
        default:
          await this.sendMessage(networkId, channel, `❓ Unknown command: ${cmd}. Use !help for available commands.`);
      }
    } catch (error) {
      this.logger.error(`Error handling command ${cmd}:`, error);
      await this.sendMessage(networkId, channel, `❌ Error executing command: ${error.message}`);
    }
  }

  /**
   * Handle quest command
   * @param {Array} args - Command arguments
   * @param {string} user - Username
   * @param {string} networkId - Network ID
   * @param {string} channel - Channel name
   */
  async handleQuestCommand(args, user, networkId, channel) {
    if (args.length === 0) {
      const quests = this.questSystem.getActiveQuests();
      if (quests.length === 0) {
        await this.sendMessage(networkId, channel, `📜 No active quests available. Check back later!`);
        return;
      }
      
      const quest = quests[0]; // Get first available quest
      await this.sendMessage(networkId, channel, `📜 ${quest.description}`);
      return;
    }

    const action = args[0].toLowerCase();
    
    switch (action) {
      case 'list':
        const quests = this.questSystem.getActiveQuests();
        const questList = quests.slice(0, 5).map(q => `• ${q.name} (Level ${q.level})`).join('\n');
        await this.sendMessage(networkId, channel, `📜 Active Quests:\n${questList}`);
        break;
        
      case 'accept':
        // Quest acceptance logic
        await this.sendMessage(networkId, channel, `✅ Quest accepted! Good luck, ${user}!`);
        break;
        
      default:
        await this.sendMessage(networkId, channel, `❓ Usage: !quest [list|accept]`);
    }
  }

  /**
   * Handle battle command
   * @param {Array} args - Command arguments
   * @param {string} user - Username
   * @param {string} networkId - Network ID
   * @param {string} channel - Channel name
   */
  async handleBattleCommand(args, user, networkId, channel) {
    if (args.length === 0) {
      await this.sendMessage(networkId, channel, `⚔️ Usage: !battle [pve|pvp|challenge] [opponent]`);
      return;
    }

    const type = args[0].toLowerCase();
    const opponent = args[1];

    switch (type) {
      case 'pve':
        try {
          const playerData = { level: 1, hp: 100, attack: 50, defense: 25 };
          const battle = await this.battleSystem.startPvEBattle(user, playerData);
          await this.sendMessage(networkId, channel, `⚔️ PvE battle started! You're fighting a ${battle.monster.name}!`);
        } catch (error) {
          await this.sendMessage(networkId, channel, `❌ Failed to start PvE battle: ${error.message}`);
        }
        break;
        
      case 'pvp':
        if (!opponent) {
          await this.sendMessage(networkId, channel, `❌ Please specify an opponent: !battle pvp <opponent>`);
          return;
        }
        
        try {
          const player1Data = { level: 1, hp: 100, attack: 50, defense: 25 };
          const player2Data = { level: 1, hp: 100, attack: 50, defense: 25 };
          const battle = await this.battleSystem.startPvPBattle(user, opponent, player1Data, player2Data);
          await this.sendMessage(networkId, channel, `⚔️ PvP battle started! ${user} vs ${opponent}!`);
        } catch (error) {
          await this.sendMessage(networkId, channel, `❌ Failed to start PvP battle: ${error.message}`);
        }
        break;
        
      case 'challenge':
        // Challenge logic
        await this.sendMessage(networkId, channel, `🎯 Challenge system coming soon!`);
        break;
        
      default:
        await this.sendMessage(networkId, channel, `❓ Unknown battle type: ${type}`);
    }
  }

  /**
   * Handle tournament command
   * @param {Array} args - Command arguments
   * @param {string} user - Username
   * @param {string} networkId - Network ID
   * @param {string} channel - Channel name
   */
  async handleTournamentCommand(args, user, networkId, channel) {
    if (args.length === 0) {
      const stats = this.tournamentSystem.getTournamentStats();
      await this.sendMessage(networkId, channel, `🏆 Tournaments: ${stats.activeTournaments} active, ${stats.scheduledTournaments} scheduled`);
      return;
    }

    const action = args[0].toLowerCase();
    
    switch (action) {
      case 'list':
        const stats = this.tournamentSystem.getTournamentStats();
        await this.sendMessage(networkId, channel, `🏆 Active: ${stats.activeTournaments}, Scheduled: ${stats.scheduledTournaments}`);
        break;
        
      case 'join':
        // Tournament joining logic
        await this.sendMessage(networkId, channel, `🎯 Tournament joining coming soon!`);
        break;
        
      default:
        await this.sendMessage(networkId, channel, `❓ Usage: !tournament [list|join]`);
    }
  }

  /**
   * Handle leaderboard command
   * @param {Array} args - Command arguments
   * @param {string} user - Username
   * @param {string} networkId - Network ID
   * @param {string} channel - Channel name
   */
  async handleLeaderboardCommand(args, user, networkId, channel) {
    const limit = parseInt(args[0]) || 10;
    const leaderboard = this.matchmaking.getLeaderboard({ limit });
    
    if (leaderboard.length === 0) {
      await this.sendMessage(networkId, channel, `📊 No leaderboard data available yet.`);
      return;
    }

    const leaderboardText = leaderboard.map((entry, index) => 
      `${index + 1}. ${entry.playerId} - Rank ${entry.rank} (${entry.wins}W/${entry.losses}L)`
    ).join('\n');

    await this.sendMessage(networkId, channel, `🏆 Leaderboard (Top ${limit}):\n${leaderboardText}`);
  }

  /**
   * Handle achievements command
   * @param {string} user - Username
   * @param {string} networkId - Network ID
   * @param {string} channel - Channel name
   */
  async handleAchievementsCommand(user, networkId, channel) {
    const achievements = this.levelProgression.getPlayerAchievements(user);
    
    if (achievements.length === 0) {
      await this.sendMessage(networkId, channel, `🏆 No achievements yet, ${user}. Keep playing!`);
      return;
    }

    const achievementList = achievements.slice(0, 5).map(ach => `• ${ach.name}`).join('\n');
    await this.sendMessage(networkId, channel, `🏆 Your Achievements (${achievements.length}):\n${achievementList}`);
  }

  /**
   * Trigger auto-battle
   * @param {Object} playerData - Player data
   * @param {string} networkId - Network ID
   * @param {Object} networkConfig - Network configuration
   */
  async triggerAutoBattle(playerData, networkId, networkConfig) {
    try {
      const battle = await this.battleSystem.startPvEBattle(networkConfig.irc.nick, playerData);
      this.logger.info(`⚔️ Auto-battle started: ${networkConfig.irc.nick} vs ${battle.monster.name}`);
    } catch (error) {
      this.logger.error('Auto-battle error:', error);
    }
  }

  /**
   * Trigger auto-quest
   * @param {Object} playerData - Player data
   * @param {string} networkId - Network ID
   * @param {Object} networkConfig - Network configuration
   */
  async triggerAutoQuest(playerData, networkId, networkConfig) {
    try {
      const quest = this.questSystem.generateQuest({ level: playerData.level });
      this.logger.info(`📜 Auto-quest generated: ${quest.name}`);
    } catch (error) {
      this.logger.error('Auto-quest error:', error);
    }
  }

  /**
   * Send message to network
   * @param {string} networkId - Network ID
   * @param {string} channel - Channel name
   * @param {string} message - Message to send
   */
  async sendMessage(networkId, channel, message) {
    const client = this.clients.get(networkId);
    if (client) {
      client.irc.privmsg(channel, message);
    }
  }

  /**
   * Get help message
   */
  getHelpMessage() {
    return [
      `🎮 ENHANCED MULTIRPG BOT COMMANDS`,
      `📊 !status - Show bot status`,
      `📈 !level - Show your level`,
      `📜 !quest - Show available quests`,
      `⚔️ !battle pve - Start PvE battle`,
      `⚔️ !battle pvp <opponent> - Challenge player`,
      `🏆 !tournament - Show tournament info`,
      `🏅 !leaderboard [limit] - Show leaderboard`,
      `🏆 !achievements - Show your achievements`,
      `❓ !help - Show this help`
    ].join('\n');
  }

  /**
   * Get status message
   */
  async getStatusMessage() {
    const stats = this.globalSync.getGlobalStats();
    const levelStats = this.levelProgression.getLevelStats();
    const battleStats = this.battleSystem.getBattleStats();
    const tournamentStats = this.tournamentSystem.getTournamentStats();
    
    return [
      `🤖 BOT STATUS`,
      `🌐 Networks: ${stats.connectedNetworks}/${stats.totalNetworks}`,
      `👥 Players: ${stats.totalPlayers}`,
      `📈 Average Level: ${levelStats.averageLevel}`,
      `⚔️ Active Battles: ${battleStats.activeBattles}`,
      `🏆 Active Tournaments: ${tournamentStats.activeTournaments}`,
      `📜 Active Quests: ${this.questSystem.getActiveQuests().length}`,
      `⏰ Uptime: ${this.getUptime()}`
    ].join('\n');
  }

  /**
   * Get bot uptime
   */
  getUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Global sync events
    this.globalSync.on('broadcast', (data) => {
      this.logger.info(`📢 Global broadcast: ${data.message}`);
    });

    this.globalSync.on('playerUpdate', (playerData) => {
      this.logger.debug(`👤 Player updated: ${playerData.globalId}`);
    });

    // Battle system events
    this.battleSystem.on('battleStarted', (battle) => {
      this.logger.info(`⚔️ Battle started: ${battle.id}`);
    });

    this.battleSystem.on('battleEnded', (battle) => {
      this.logger.info(`⚔️ Battle ended: ${battle.id}, Winner: ${battle.winner}`);
    });

    // Tournament system events
    this.tournamentSystem.on('tournamentScheduled', (tournament) => {
      this.logger.info(`🏆 Tournament scheduled: ${tournament.name}`);
    });

    this.tournamentSystem.on('tournamentStarted', (tournament) => {
      this.logger.info(`🏆 Tournament started: ${tournament.name}`);
    });

    this.tournamentSystem.on('tournamentCompleted', (tournament) => {
      this.logger.info(`🏆 Tournament completed: ${tournament.name}, Winner: ${tournament.winner}`);
    });

    // Quest system events
    this.questSystem.on('questGenerated', (quest) => {
      this.logger.info(`📜 Quest generated: ${quest.name}`);
    });

    this.questSystem.on('questCompleted', (quest) => {
      this.logger.info(`✅ Quest completed: ${quest.name} by ${quest.completedBy}`);
    });

    // Level progression events
    this.levelProgression.on('levelUp', (data) => {
      this.logger.info(`📈 Level up: ${data.playerId} -> ${data.newLevel}`);
    });

    // Process exit handlers
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', error);
      this.shutdown('uncaughtException');
    });
  }

  /**
   * Shutdown the bot
   * @param {string} reason - Shutdown reason
   */
  async shutdown(reason = 'manual') {
    this.logger.info(`🛑 Shutting down bot (${reason})...`);
    
    this.isRunning = false;
    
    // Broadcast shutdown message
    if (this.globalSync) {
      await this.globalSync.broadcast(
        `🛑 Bot shutting down (${reason}). Goodbye! 🛑`,
        'shutdown',
        { reason }
      );
    }
    
    // Cleanup systems
    if (this.globalSync) await this.globalSync.cleanup();
    if (this.matchmaking) this.matchmaking.cleanup();
    if (this.questSystem) this.questSystem.cleanup();
    if (this.levelProgression) this.levelProgression.cleanup();
    if (this.battleSystem) this.battleSystem.cleanup();
    if (this.tournamentSystem) this.tournamentSystem.cleanup();
    if (this.adminTools) this.adminTools.cleanup();
    if (this.database) await this.database.close();
    
    this.logger.info('✅ Bot shutdown complete');
    process.exit(0);
  }
}

// Start the bot
if (require.main === module) {
  const bot = new MultiRPGBot();
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    bot.shutdown('unhandledRejection');
  });
}

module.exports = MultiRPGBot;