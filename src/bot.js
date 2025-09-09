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
const PlayerClasses = require('./core/PlayerClasses');
const GuildSystem = require('./core/GuildSystem');
const InfiniteSystems = require('./core/InfiniteSystems');
const GlobalPlayerSystem = require('./core/GlobalPlayerSystem');
const MessageSystem = require('./core/MessageSystem');

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
    this.playerClasses = null;
    this.guildSystem = null;
    this.infiniteSystems = null;
    this.globalPlayerSystem = null;
    this.messageSystem = null;
    
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
    
    // Initialize message system
    this.messageSystem = new MessageSystem(this.config);
    
    // Initialize player classes
    this.playerClasses = new PlayerClasses(this.config, this.globalSync);
    
    // Initialize guild system
    this.guildSystem = new GuildSystem(this.config, this.globalSync, this.playerClasses);
    
    // Initialize global player system
    this.globalPlayerSystem = new GlobalPlayerSystem(this.config, this.globalSync, this.playerClasses, this.guildSystem);
    
    // Initialize other systems
    this.matchmaking = new Matchmaking(this.config, this.globalSync);
    this.questSystem = new QuestSystem(this.config, this.globalSync);
    this.levelProgression = new LevelProgression(this.config, this.globalSync);
    this.battleSystem = new BattleSystem(this.config, this.globalSync, this.matchmaking);
    this.tournamentSystem = new TournamentSystem(this.config, this.globalSync, this.battleSystem, this.matchmaking);
    this.infiniteSystems = new InfiniteSystems(this.config, this.globalSync, this.questSystem, this.battleSystem, this.levelProgression, this.guildSystem);
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

    // On private messages (game commands and help)
    this.api.hookEvent(networkId, 'privmsg', async (message) => {
      if (message.nickname === networkConfig.game.nickname && message.target === networkConfig.irc.nick) {
        await this.handleGameMessage(message, networkId, networkConfig);
      } else if (message.target === networkConfig.irc.nick) {
        // Handle private messages for help commands
        await this.handlePrivateMessage(message, networkId, networkConfig);
      }
    });

    // On channel messages (only show help about private messages)
    this.api.hookEvent(networkId, 'privmsg', async (message) => {
      if (networkConfig.irc.channels.includes(message.target)) {
        await this.handleChannelMessage(message, networkId, networkConfig);
      }
    });

    // On admin channel messages (only show help about private messages)
    this.api.hookEvent(networkId, 'privmsg', async (message) => {
      if (networkConfig.irc.adminChannel && message.target === networkConfig.irc.adminChannel) {
        await this.handleAdminChannelMessage(message, networkId, networkConfig);
      }
    });
  }

  /**
   * Handle private messages (help commands)
   * @param {Object} message - IRC message
   * @param {string} networkId - Network ID
   * @param {Object} networkConfig - Network configuration
   */
  async handlePrivateMessage(message, networkId, networkConfig) {
    const msg = message.message.trim();
    const user = message.nickname;
    
    // Check if user is banned
    if (this.adminTools.bannedUsers.has(user.toLowerCase())) {
      return;
    }

    // Handle help commands via private message
    if (msg.startsWith('!')) {
      await this.handlePrivateCommand(msg, user, networkId, networkConfig);
    }
  }

  /**
   * Handle private commands
   * @param {string} command - Command string
   * @param {string} user - Username
   * @param {string} networkId - Network ID
   * @param {Object} networkConfig - Network configuration
   */
  async handlePrivateCommand(command, user, networkId, networkConfig) {
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    try {
      switch (cmd) {
        case '!help':
          await this.sendPrivateMessage(networkId, user, this.getHelpMessage());
          break;
          
        case '!adminhelp':
          if (this.isAdmin(user)) {
            await this.sendPrivateMessage(networkId, user, this.getAdminHelpMessage());
          } else {
            await this.sendPrivateMessage(networkId, user, '❌ You do not have admin permissions.');
          }
          break;
          
        case '!userhelp':
          await this.sendPrivateMessage(networkId, user, this.getUserHelpMessage());
          break;
          
        case '!status':
          if (args.length > 0) {
            // Show specific player status
            const targetPlayer = args[0];
            await this.sendPrivateMessage(networkId, user, await this.getPlayerStatusMessage(targetPlayer));
          } else {
            // Show bot status
            await this.sendPrivateMessage(networkId, user, await this.getStatusMessage());
          }
          break;
          
        case '!level':
          const playerLevel = this.levelProgression.getPlayerLevel(user);
          await this.sendPrivateMessage(networkId, user, `📊 Your level: ${playerLevel}`);
          break;
          
        case '!class':
          await this.handleClassCommand(user, networkId, user);
          break;
          
        case '!guild':
          await this.handleGuildCommand(args, user, networkId, user);
          break;
          
        case '!quest':
          await this.handleQuestCommand(args, user, networkId, user);
          break;
          
        case '!battle':
          await this.handleBattleCommand(args, user, networkId, user);
          break;
          
        case '!tournament':
          await this.handleTournamentCommand(args, user, networkId, user);
          break;
          
        case '!leaderboard':
          await this.handleLeaderboardCommand(args, user, networkId, user);
          break;
          
        case '!achievements':
          await this.handleAchievementsCommand(user, networkId, user);
          break;
          
        case '!chain':
          await this.handleChainCommand(args, user, networkId, user);
          break;
          
        case '!infinite':
          await this.handleInfiniteCommand(args, user, networkId, user);
          break;
          
        case '!players':
          await this.handlePlayersCommand(args, user, networkId);
          break;
          
        case '!networks':
          await this.handleNetworksCommand(user, networkId);
          break;
          
        case '!search':
          await this.handleSearchCommand(args, user, networkId);
          break;
          
        case '!social':
          await this.handleSocialCommand(args, user, networkId);
          break;
          
        case '!cross':
          await this.handleCrossNetworkCommand(args, user, networkId);
          break;
          
        default:
          await this.sendPrivateMessage(networkId, user, this.messageSystem.formatMessage('error_generic', {
            message: `Unknown command: ${cmd}. Use !help for available commands.`
          }));
      }
    } catch (error) {
      this.logger.error(`Error handling private command ${cmd}:`, error);
      await this.sendPrivateMessage(networkId, user, `❌ Error executing command: ${error.message}`);
    }
  }

  /**
   * Check if user is admin
   * @param {string} user - Username
   * @returns {boolean} - Is admin
   */
  isAdmin(user) {
    // Check against admin list in config
    const adminUsers = this.config.get('admin.users', []);
    return adminUsers.includes(user.toLowerCase()) || 
           this.config.get('admin.permissions', []).some(perm => 
             this.adminTools.hasPermission(user, perm)
           );
  }

  /**
   * Send private message
   * @param {string} networkId - Network ID
   * @param {string} user - Username
   * @param {string} message - Message to send
   */
  async sendPrivateMessage(networkId, user, message) {
    const client = this.clients.get(networkId);
    if (client) {
      client.irc.privmsg(user, message);
    }
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

      // Register player globally if not exists
      let globalPlayer = this.globalPlayerSystem.getGlobalPlayer(networkConfig.irc.nick, networkId);
      if (!globalPlayer) {
        globalPlayer = await this.globalPlayerSystem.registerGlobalPlayer(networkConfig.irc.nick, networkId, playerData);
      } else {
        // Update existing player
        globalPlayer = await this.globalPlayerSystem.updatePlayerSession(networkConfig.irc.nick, networkId, playerData);
      }

      // Auto-level up if applicable
      if (playerData.level > globalPlayer.level) {
        await this.globalPlayerSystem.levelUpPlayer(networkConfig.irc.nick, playerData.level, {
          exp: (playerData.level - globalPlayer.level) * 1000,
          gold: (playerData.level - globalPlayer.level) * 100
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
   * Handle channel messages (only show help about private messages)
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

    // Only respond to help requests in channel, everything else via private message
    if (msg.toLowerCase() === '!help' || msg.toLowerCase() === 'help') {
      await this.sendMessage(networkId, message.target, 
        `👋 Hi ${user}! To avoid channel penalties, please use private messages for all commands. ` +
        `Send me a private message: /msg ${networkConfig.irc.nick} !help`
      );
    } else if (msg.startsWith('!')) {
      // Silently ignore other commands in channel to avoid penalties
      return;
    }
  }

  /**
   * Handle admin channel messages (only show help about private messages)
   * @param {Object} message - IRC message
   * @param {string} networkId - Network ID
   * @param {Object} networkConfig - Network configuration
   */
  async handleAdminChannelMessage(message, networkId, networkConfig) {
    const msg = message.message.trim();
    const user = message.nickname;
    
    // Only respond to help requests in admin channel, everything else via private message
    if (msg.toLowerCase() === '!help' || msg.toLowerCase() === '!adminhelp' || msg.toLowerCase() === 'help') {
      await this.sendMessage(networkId, message.target, 
        `👋 Hi ${user}! To avoid channel penalties, please use private messages for all admin commands. ` +
        `Send me a private message: /msg ${networkConfig.irc.nick} !adminhelp`
      );
    } else if (msg.startsWith('!')) {
      // Silently ignore other commands in channel to avoid penalties
      return;
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
    const globalPlayer = this.globalPlayerSystem.getGlobalPlayer(user, networkId);
    if (!globalPlayer) {
      await this.sendMessage(networkId, channel, this.messageSystem.formatMessage('error_not_found', {
        item: 'Player'
      }));
      return;
    }

    const achievements = globalPlayer.stats.achievements || [];
    
    if (achievements.length === 0) {
      await this.sendMessage(networkId, channel, this.messageSystem.formatMessage('achievement_unlocked', {
        playerName: user,
        achievementName: 'Keep Playing!',
        description: 'No achievements yet, but keep playing to unlock amazing rewards!'
      }));
      return;
    }

    const achievementList = achievements.slice(0, 5).map(ach => `• ${ach.name}`).join('\n');
    await this.sendMessage(networkId, channel, `🏆 Your Achievements (${achievements.length}):\n${achievementList}`);
  }

  /**
   * Handle class command
   * @param {string} user - Username
   * @param {string} networkId - Network ID
   * @param {string} channel - Channel name
   */
  async handleClassCommand(user, networkId, channel) {
    const globalPlayer = this.globalPlayerSystem.getGlobalPlayer(user, networkId);
    if (!globalPlayer) {
      await this.sendMessage(networkId, channel, this.messageSystem.formatMessage('error_not_found', {
        item: 'Player'
      }));
      return;
    }

    const playerClass = this.playerClasses.getPlayerClass(globalPlayer.globalId);
    if (!playerClass) {
      await this.sendMessage(networkId, channel, `❌ No class assigned. Use !class choose <class> to select one.`);
      return;
    }

    const classInfo = [
      `${this.messageSystem.formatPlayerName(user, playerClass.className)}`,
      `📊 Level: ${playerClass.level}`,
      `⚔️ Attack: ${playerClass.stats.attack}`,
      `🛡️ Defense: ${playerClass.stats.defense}`,
      `❤️ HP: ${playerClass.stats.hp}`,
      `🔮 Magic: ${playerClass.stats.magic}`,
      `⚡ Speed: ${playerClass.stats.speed}`
    ].join('\n');

    await this.sendMessage(networkId, channel, classInfo);
  }

  /**
   * Handle guild command
   * @param {Array} args - Command arguments
   * @param {string} user - Username
   * @param {string} networkId - Network ID
   * @param {string} channel - Channel name
   */
  async handleGuildCommand(args, user, networkId, channel) {
    const globalPlayer = this.globalPlayerSystem.getGlobalPlayer(user, networkId);
    if (!globalPlayer) {
      await this.sendMessage(networkId, channel, this.messageSystem.formatMessage('error_not_found', {
        item: 'Player'
      }));
      return;
    }

    if (args.length === 0) {
      const guild = this.guildSystem.getPlayerGuild(globalPlayer.globalId);
      if (!guild) {
        await this.sendMessage(networkId, channel, `🏰 You are not in a guild. Use !guild join <guild> to join one!`);
        return;
      }

      const guildInfo = this.messageSystem.formatGuild(guild);
      await this.sendMessage(networkId, channel, guildInfo);
      return;
    }

    const action = args[0].toLowerCase();
    
    switch (action) {
      case 'join':
        const guildName = args.slice(1).join(' ');
        if (!guildName) {
          await this.sendMessage(networkId, channel, `❌ Please specify guild name: !guild join <guild>`);
          return;
        }
        
        try {
          const guild = await this.guildSystem.joinGuild(globalPlayer.globalId, guildName);
          await this.sendMessage(networkId, channel, this.messageSystem.formatMessage('guild_joined', {
            playerName: user,
            guildName: guild.name
          }));
        } catch (error) {
          await this.sendMessage(networkId, channel, this.messageSystem.formatMessage('error_generic', {
            message: error.message
          }));
        }
        break;
        
      case 'leave':
        try {
          await this.guildSystem.leaveGuild(globalPlayer.globalId);
          await this.sendMessage(networkId, channel, `👥 You have left your guild.`);
        } catch (error) {
          await this.sendMessage(networkId, channel, this.messageSystem.formatMessage('error_generic', {
            message: error.message
          }));
        }
        break;
        
      case 'list':
        const leaderboard = this.guildSystem.getGuildLeaderboard(10);
        const guildList = leaderboard.map((guild, index) => 
          `${index + 1}. ${guild.name} (Level ${guild.level})`
        ).join('\n');
        await this.sendMessage(networkId, channel, `🏰 Top Guilds:\n${guildList}`);
        break;
        
      default:
        await this.sendMessage(networkId, channel, `❓ Usage: !guild [join|leave|list]`);
    }
  }

  /**
   * Handle chain command
   * @param {Array} args - Command arguments
   * @param {string} user - Username
   * @param {string} networkId - Network ID
   * @param {string} channel - Channel name
   */
  async handleChainCommand(args, user, networkId, channel) {
    if (args.length === 0) {
      await this.sendMessage(networkId, channel, `❓ Usage: !chain [start|list|progress] <chain>`);
      return;
    }

    const action = args[0].toLowerCase();
    
    switch (action) {
      case 'start':
        const chainId = args[1] || 'dragon_slayer';
        try {
          const chainData = await this.infiniteSystems.startChainQuest(user, chainId);
          await this.sendMessage(networkId, channel, this.messageSystem.formatMessage('chain_quest_start', {
            playerName: user,
            questName: chainData.name
          }));
        } catch (error) {
          await this.sendMessage(networkId, channel, this.messageSystem.formatMessage('error_generic', {
            message: error.message
          }));
        }
        break;
        
      case 'list':
        await this.sendMessage(networkId, channel, `📜 Available Chain Quests: Dragon Slayer, Shadow Walker, Guild Master`);
        break;
        
      case 'progress':
        await this.sendMessage(networkId, channel, `📊 Chain quest progress coming soon!`);
        break;
        
      default:
        await this.sendMessage(networkId, channel, `❓ Usage: !chain [start|list|progress] <chain>`);
    }
  }

  /**
   * Handle infinite command
   * @param {Array} args - Command arguments
   * @param {string} user - Username
   * @param {string} networkId - Network ID
   * @param {string} channel - Channel name
   */
  async handleInfiniteCommand(args, user, networkId, channel) {
    if (args.length === 0) {
      await this.sendPrivateMessage(networkId, user, `❓ Usage: !infinite [battle|quest|event] <type>`);
      return;
    }

    const action = args[0].toLowerCase();
    
    switch (action) {
      case 'battle':
        const battleType = args[1] || 'dragon_horde';
        try {
          const battleData = await this.infiniteSystems.startInfiniteBattle(user, battleType);
          await this.sendPrivateMessage(networkId, user, `♾️ Infinite battle started: ${battleData.name}! Endless waves await!`);
        } catch (error) {
          await this.sendPrivateMessage(networkId, user, this.messageSystem.formatMessage('error_generic', {
            message: error.message
          }));
        }
        break;
        
      case 'quest':
        await this.sendPrivateMessage(networkId, user, `📜 Use !chain start to begin infinite chain quests!`);
        break;
        
      case 'event':
        await this.sendPrivateMessage(networkId, user, `🎉 Global events are automatically triggered! Watch for announcements!`);
        break;
        
      default:
        await this.sendPrivateMessage(networkId, user, `❓ Usage: !infinite [battle|quest|event] <type>`);
    }
  }

  /**
   * Handle players command
   * @param {Array} args - Command arguments
   * @param {string} user - Username
   * @param {string} networkId - Network ID
   */
  async handlePlayersCommand(args, user, networkId) {
    const limit = parseInt(args[0]) || 20;
    const onlinePlayers = await this.globalPlayerSystem.getOnlinePlayers(limit);
    
    if (onlinePlayers.length === 0) {
      await this.sendPrivateMessage(networkId, user, [
        `👥 **Online Players** 👥`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `No players are currently online.`,
        `💡 Check back later or invite friends to join!`
      ].join('\n'));
      return;
    }

    const playerList = onlinePlayers.map((player, index) => {
      const playerClass = this.playerClasses.getPlayerClass(player.globalId);
      const networkInfo = this.networks.get(player.networkId);
      const classDisplay = playerClass ? `[${playerClass.className}]` : '[No Class]';
      const networkDisplay = networkInfo ? networkInfo.name : 'Unknown';
      
      return `${index + 1}. **${player.name}** ${classDisplay} - Level ${player.level} (${networkDisplay})`;
    }).join('\n');

    await this.sendPrivateMessage(networkId, user, [
      `👥 **Online Players** (${onlinePlayers.length}) 👥`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      playerList,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💡 Use !status <player> to see detailed player info!`
    ].join('\n'));
  }

  /**
   * Handle networks command
   * @param {string} user - Username
   * @param {string} networkId - Network ID
   */
  async handleNetworksCommand(user, networkId) {
    const networkStats = [];
    
    for (const [id, network] of this.networks) {
      const isConnected = this.globalSync.isNetworkConnected(id);
      const playerCount = await this.globalPlayerSystem.getNetworkPlayerCount(id);
      
      networkStats.push([
        `🌐 **${network.name}**`,
        `   📍 Server: ${network.irc.server}:${network.irc.port}`,
        `   🔗 Status: ${isConnected ? '🟢 Connected' : '🔴 Disconnected'}`,
        `   👥 Players: ${playerCount}`,
        `   📺 Channels: ${network.irc.channels.join(', ')}`
      ].join('\n'));
    }

    await this.sendPrivateMessage(networkId, user, [
      `🌐 **Network Status** 🌐`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      networkStats.join('\n\n'),
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💡 Players can play across all connected networks!`
    ].join('\n'));
  }

  /**
   * Handle search command
   * @param {Array} args - Command arguments
   * @param {string} user - Username
   * @param {string} networkId - Network ID
   */
  async handleSearchCommand(args, user, networkId) {
    if (args.length === 0) {
      await this.sendPrivateMessage(networkId, user, [
        `🔍 **Search Commands** 🔍`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `• !search player <name> - Search for a player`,
        `• !search guild <name> - Search for a guild`,
        `• !search class <class> - Search players by class`,
        `• !search network <network> - Search players in network`,
        `• !search level <min>-<max> - Search by level range`
      ].join('\n'));
      return;
    }

    const searchType = args[0].toLowerCase();
    const searchTerm = args.slice(1).join(' ');

    switch (searchType) {
      case 'player':
        if (!searchTerm) {
          await this.sendPrivateMessage(networkId, user, `❌ Please specify a player name to search for.`);
          return;
        }
        await this.sendPrivateMessage(networkId, user, await this.getPlayerStatusMessage(searchTerm));
        break;
        
      case 'guild':
        if (!searchTerm) {
          await this.sendPrivateMessage(networkId, user, `❌ Please specify a guild name to search for.`);
          return;
        }
        const guild = this.guildSystem.findGuild(searchTerm);
        if (guild) {
          const members = this.guildSystem.getGuildMembers(guild.id);
          await this.sendPrivateMessage(networkId, user, [
            `🏰 **Guild: ${guild.name}** 🏰`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `📊 **Level:** ${guild.level}`,
            `👥 **Members:** ${members.length}`,
            `💎 **Total Experience:** ${guild.totalExperience || 0}`,
            `🏆 **Achievements:** ${guild.achievements?.length || 0}`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `💡 Use !guild join ${guild.name} to join this guild!`
          ].join('\n'));
        } else {
          await this.sendPrivateMessage(networkId, user, `❌ Guild "${searchTerm}" not found.`);
        }
        break;
        
      case 'class':
        if (!searchTerm) {
          await this.sendPrivateMessage(networkId, user, `❌ Please specify a class name to search for.`);
          return;
        }
        const classPlayers = await this.globalPlayerSystem.getPlayersByClass(searchTerm);
        if (classPlayers.length === 0) {
          await this.sendPrivateMessage(networkId, user, `❌ No players found with class "${searchTerm}".`);
          return;
        }
        
        const classList = classPlayers.slice(0, 10).map((player, index) => 
          `${index + 1}. **${player.name}** - Level ${player.level}`
        ).join('\n');
        
        await this.sendPrivateMessage(networkId, user, [
          `🎭 **Players with Class: ${searchTerm}** 🎭`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          classList,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `💡 Showing ${Math.min(10, classPlayers.length)} of ${classPlayers.length} players.`
        ].join('\n'));
        break;
        
      default:
        await this.sendPrivateMessage(networkId, user, `❌ Unknown search type: ${searchType}. Use !search for help.`);
    }
  }

  /**
   * Handle social command
   * @param {Array} args - Command arguments
   * @param {string} user - Username
   * @param {string} networkId - Network ID
   */
  async handleSocialCommand(args, user, networkId) {
    if (args.length === 0) {
      await this.sendPrivateMessage(networkId, user, [
        `👥 **Social Commands** 👥`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `• !social friends - Show your friends list`,
        `• !social add <player> - Add a player as friend`,
        `• !social remove <player> - Remove a friend`,
        `• !social rivals - Show your rivals`,
        `• !social challenge <player> - Challenge a player`,
        `• !social message <player> <message> - Send message to player`,
        `• !social stats - Show your social statistics`
      ].join('\n'));
      return;
    }

    const action = args[0].toLowerCase();
    
    switch (action) {
      case 'friends':
        const friends = await this.globalPlayerSystem.getFriends(user);
        if (friends.length === 0) {
          await this.sendPrivateMessage(networkId, user, [
            `👥 **Your Friends** 👥`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `You don't have any friends yet.`,
            `💡 Use !social add <player> to add friends!`
          ].join('\n'));
          return;
        }
        
        const friendsList = friends.map((friend, index) => 
          `${index + 1}. **${friend.name}** - Level ${friend.level} (${friend.network})`
        ).join('\n');
        
        await this.sendPrivateMessage(networkId, user, [
          `👥 **Your Friends** (${friends.length}) 👥`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          friendsList,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `💡 Use !social challenge <player> to challenge friends!`
        ].join('\n'));
        break;
        
      case 'add':
        const friendName = args[1];
        if (!friendName) {
          await this.sendPrivateMessage(networkId, user, `❌ Please specify a player name to add as friend.`);
          return;
        }
        
        try {
          await this.globalPlayerSystem.addFriend(user, friendName);
          await this.sendPrivateMessage(networkId, user, `✅ Added ${friendName} as a friend!`);
        } catch (error) {
          await this.sendPrivateMessage(networkId, user, `❌ Failed to add friend: ${error.message}`);
        }
        break;
        
      case 'stats':
        const socialStats = await this.globalPlayerSystem.getSocialStats(user);
        await this.sendPrivateMessage(networkId, user, [
          `📊 **Your Social Statistics** 📊`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `👥 **Friends:** ${socialStats.friends}`,
          `⚔️ **Challenges Sent:** ${socialStats.challengesSent}`,
          `🏆 **Challenges Won:** ${socialStats.challengesWon}`,
          `💬 **Messages Sent:** ${socialStats.messagesSent}`,
          `🌟 **Reputation:** ${socialStats.reputation}`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `💡 Keep playing to improve your social stats!`
        ].join('\n'));
        break;
        
      default:
        await this.sendPrivateMessage(networkId, user, `❌ Unknown social command: ${action}. Use !social for help.`);
    }
  }

  /**
   * Handle cross-network command
   * @param {Array} args - Command arguments
   * @param {string} user - Username
   * @param {string} networkId - Network ID
   */
  async handleCrossNetworkCommand(args, user, networkId) {
    if (args.length === 0) {
      await this.sendPrivateMessage(networkId, user, [
        `🌐 **Cross-Network Commands** 🌐`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `• !cross battle <player> - Challenge player from any network`,
        `• !cross message <player> <message> - Send message across networks`,
        `• !cross guild <action> - Cross-network guild actions`,
        `• !cross tournament - Join cross-network tournaments`,
        `• !cross leaderboard - Global leaderboard across all networks`,
        `• !cross events - Cross-network events and activities`
      ].join('\n'));
      return;
    }

    const action = args[0].toLowerCase();
    
    switch (action) {
      case 'battle':
        const opponent = args[1];
        if (!opponent) {
          await this.sendPrivateMessage(networkId, user, `❌ Please specify an opponent to challenge.`);
          return;
        }
        
        try {
          const battle = await this.battleSystem.startCrossNetworkBattle(user, opponent);
          await this.sendPrivateMessage(networkId, user, [
            `⚔️ **Cross-Network Battle Started!** ⚔️`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `🎯 **Challenger:** ${user}`,
            `🎯 **Opponent:** ${opponent}`,
            `🌐 **Battle ID:** ${battle.id}`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `💡 Battle results will be announced when complete!`
          ].join('\n'));
        } catch (error) {
          await this.sendPrivateMessage(networkId, user, `❌ Failed to start cross-network battle: ${error.message}`);
        }
        break;
        
      case 'leaderboard':
        const globalLeaderboard = await this.globalPlayerSystem.getGlobalLeaderboard(20);
        const leaderboardList = globalLeaderboard.map((player, index) => 
          `${index + 1}. **${player.name}** [${player.class}] - Level ${player.level} (${player.network})`
        ).join('\n');
        
        await this.sendPrivateMessage(networkId, user, [
          `🏆 **Global Leaderboard** 🏆`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          leaderboardList,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `💡 Compete with players from all networks!`
        ].join('\n'));
        break;
        
      case 'events':
        const events = await this.globalSync.getActiveEvents();
        if (events.length === 0) {
          await this.sendPrivateMessage(networkId, user, [
            `🎉 **Cross-Network Events** 🎉`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `No active cross-network events at the moment.`,
            `💡 Check back later for exciting global events!`
          ].join('\n'));
          return;
        }
        
        const eventsList = events.map((event, index) => 
          `${index + 1}. **${event.name}** - ${event.description}`
        ).join('\n');
        
        await this.sendPrivateMessage(networkId, user, [
          `🎉 **Active Cross-Network Events** 🎉`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          eventsList,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `💡 Participate in events to earn rewards!`
        ].join('\n'));
        break;
        
      default:
        await this.sendPrivateMessage(networkId, user, `❌ Unknown cross-network command: ${action}. Use !cross for help.`);
    }
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
      '🎮 **Enhanced MultiRPG Bot Help** 🎮',
      '',
      '⚠️ **IMPORTANT: ALL COMMANDS MUST BE SENT VIA PRIVATE MESSAGE!** ⚠️',
      'Using commands in channels will result in penalties!',
      '',
      '**📋 Available Commands (Private Message Only):**',
      '• !help - Show this help message',
      '• !userhelp - User-specific help',
      '• !adminhelp - Admin commands (admin only)',
      '• !status [player] - Bot status or specific player status',
      '• !level - Your current level',
      '• !class - Your character class info',
      '• !guild - Guild information and management',
      '• !quest - Available quests and quest management',
      '• !battle - Start battles (PvE/PvP)',
      '• !tournament - Tournament information',
      '• !leaderboard - Global leaderboards',
      '• !achievements - Your achievements',
      '• !chain - Chain quest system',
      '• !infinite - Infinite battles and events',
      '• !players - Show online players across all networks',
      '• !networks - Show network status and information',
      '• !search - Search for players, guilds, and more',
      '• !social - Social features and friend system',
      '• !cross - Cross-network gameplay features',
      '',
      '**🎯 How to Use (PRIVATE MESSAGES ONLY):**',
      '• Send ALL commands as private messages: /msg <botname> !command',
      '• Example: /msg MultiRPGBot !status',
      '• Example: /msg MultiRPGBot !level',
      '• Example: /msg MultiRPGBot !guild join Warriors',
      '• All gameplay is automated - the bot handles everything!',
      '• Your character will automatically level up, fight, and progress',
      '• Join guilds, complete quests, and participate in tournaments',
      '',
      '**⚡ Quick Start (Private Messages):**',
      '• /msg <botname> !status - See bot status',
      '• /msg <botname> !level - Check your level',
      '• /msg <botname> !guild - Join a guild',
      '• /msg <botname> !quest - Start questing',
      '',
      '**❓ Need More Help? (Private Messages):**',
      '• /msg <botname> !userhelp - Detailed user commands',
      '• /msg <botname> !adminhelp - Admin commands (if you have permissions)',
      '• The bot runs 24/7 with full automation!',
      '',
      '**🚫 NEVER use commands in channels - you will be penalized!**'
    ].join('\n');
  }

  /**
   * Get user help message
   */
  getUserHelpMessage() {
    return [
      '👤 **User Commands Help** 👤',
      '',
      '⚠️ **ALL COMMANDS MUST BE SENT VIA PRIVATE MESSAGE!** ⚠️',
      'Use: /msg <botname> !command',
      '',
      '**🎮 Game Commands (Private Message Only):**',
      '• /msg <botname> !status - Show detailed bot status and statistics',
      '• /msg <botname> !status <player> - Show another player\'s status',
      '• /msg <botname> !level - Display your current level and experience',
      '• /msg <botname> !class - Show your character class and abilities',
      '',
      '**🏰 Guild Commands (Private Message Only):**',
      '• /msg <botname> !guild - Show your current guild information',
      '• /msg <botname> !guild join <name> - Join a specific guild',
      '• /msg <botname> !guild leave - Leave your current guild',
      '• /msg <botname> !guild list - List top guilds',
      '',
      '**📜 Quest Commands (Private Message Only):**',
      '• /msg <botname> !quest - Show available quests',
      '• /msg <botname> !quest list - List all active quests',
      '• /msg <botname> !quest accept - Accept the current quest',
      '',
      '**⚔️ Battle Commands (Private Message Only):**',
      '• /msg <botname> !battle pve - Start a PvE battle against monsters',
      '• /msg <botname> !battle pvp <player> - Challenge another player',
      '• /msg <botname> !battle challenge - Challenge random opponent',
      '',
      '**🏆 Tournament Commands (Private Message Only):**',
      '• /msg <botname> !tournament - Show tournament information',
      '• /msg <botname> !tournament list - List active tournaments',
      '• /msg <botname> !tournament join - Join current tournament',
      '',
      '**📊 Information Commands (Private Message Only):**',
      '• /msg <botname> !leaderboard - Show global leaderboard',
      '• /msg <botname> !leaderboard <number> - Show top N players',
      '• /msg <botname> !achievements - Display your achievements',
      '',
      '**♾️ Advanced Commands (Private Message Only):**',
      '• /msg <botname> !chain start <type> - Start a chain quest',
      '• /msg <botname> !chain list - List available chain quests',
      '• /msg <botname> !chain progress - Check your chain progress',
      '• /msg <botname> !infinite battle <type> - Start infinite battle',
      '• /msg <botname> !infinite quest - Start infinite questing',
      '• /msg <botname> !infinite event - Check global events',
      '',
      '**👥 Social Commands (Private Message Only):**',
      '• /msg <botname> !players - Show online players across all networks',
      '• /msg <botname> !networks - Show network status and information',
      '• /msg <botname> !search player <name> - Search for a specific player',
      '• /msg <botname> !search guild <name> - Search for a guild',
      '• /msg <botname> !search class <class> - Find players by class',
      '• /msg <botname> !social friends - Show your friends list',
      '• /msg <botname> !social add <player> - Add a player as friend',
      '• /msg <botname> !social stats - Show your social statistics',
      '',
      '**🌐 Cross-Network Commands (Private Message Only):**',
      '• /msg <botname> !cross battle <player> - Challenge player from any network',
      '• /msg <botname> !cross leaderboard - Global leaderboard across all networks',
      '• /msg <botname> !cross events - Cross-network events and activities',
      '• /msg <botname> !cross message <player> <message> - Send message across networks',
      '',
      '**💡 Important Tips:**',
      '• 🚫 NEVER use commands in channels - you will be penalized!',
      '• ✅ ALWAYS use private messages: /msg <botname> !command',
      '• 🤖 The bot handles all gameplay automatically',
      '• 📈 Your character progresses even when offline',
      '• 🏰 Join guilds for bonuses and team play',
      '• 📜 Complete quests for rewards and experience',
      '• ⚔️ Battles and tournaments happen automatically',
      '',
      '**Example Usage:**',
      '• /msg MultiRPGBot !status',
      '• /msg MultiRPGBot !guild join Warriors',
      '• /msg MultiRPGBot !battle pve'
    ].join('\n');
  }

  /**
   * Get admin help message
   */
  getAdminHelpMessage() {
    return [
      '👑 **Admin Commands Help** 👑',
      '',
      '⚠️ **ALL ADMIN COMMANDS MUST BE SENT VIA PRIVATE MESSAGE!** ⚠️',
      'Use: /msg <botname> !command',
      '',
      '**📢 Broadcasting Commands (Private Message Only):**',
      '• /msg <botname> !broadcast <message> - Broadcast to all networks',
      '• /msg <botname> !announce <message> - Make an announcement',
      '• /msg <botname> !global <message> - Send global message',
      '• /msg <botname> !network <network> <message> - Send to specific network',
      '',
      '**👥 Player Management (Private Message Only):**',
      '• /msg <botname> !ban <player> [reason] - Ban a player',
      '• /msg <botname> !unban <player> - Unban a player',
      '• /msg <botname> !kick <player> [reason] - Kick a player',
      '• /msg <botname> !mute <player> [duration] - Mute a player',
      '• /msg <botname> !unmute <player> - Unmute a player',
      '• /msg <botname> !warn <player> <reason> - Warn a player',
      '• /msg <botname> !playerinfo <player> - Get player information',
      '',
      '**🎉 Event Management (Private Message Only):**',
      '• /msg <botname> !event start <name> - Start a global event',
      '• /msg <botname> !event stop <name> - Stop a global event',
      '• /msg <botname> !event list - List active events',
      '• /msg <botname> !event create <name> <type> - Create new event',
      '',
      '**🏆 Tournament Management (Private Message Only):**',
      '• /msg <botname> !tournament create <name> - Create tournament',
      '• /msg <botname> !tournament start <id> - Start tournament',
      '• /msg <botname> !tournament stop <id> - Stop tournament',
      '• /msg <botname> !tournament list - List all tournaments',
      '• /msg <botname> !tournament add <id> <player> - Add player to tournament',
      '• /msg <botname> !tournament remove <id> <player> - Remove player',
      '',
      '**⚙️ System Management (Private Message Only):**',
      '• /msg <botname> !restart - Restart the bot',
      '• /msg <botname> !shutdown - Shutdown the bot',
      '• /msg <botname> !reload - Reload configuration',
      '• /msg <botname> !status - Show detailed system status',
      '• /msg <botname> !networks - Show network status',
      '• /msg <botname> !players - Show player statistics',
      '• /msg <botname> !battles - Show battle statistics',
      '• /msg <botname> !quests - Show quest statistics',
      '',
      '**🔧 Configuration (Private Message Only):**',
      '• /msg <botname> !config get <key> - Get configuration value',
      '• /msg <botname> !config set <key> <value> - Set configuration value',
      '• /msg <botname> !config reload - Reload configuration file',
      '• /msg <botname> !config save - Save current configuration',
      '',
      '**📊 Monitoring (Private Message Only):**',
      '• /msg <botname> !logs - Show recent logs',
      '• /msg <botname> !errors - Show recent errors',
      '• /msg <botname> !performance - Show performance metrics',
      '• /msg <botname> !memory - Show memory usage',
      '• /msg <botname> !uptime - Show bot uptime',
      '',
      '**🛡️ Security (Private Message Only):**',
      '• /msg <botname> !permissions <user> - Check user permissions',
      '• /msg <botname> !grant <user> <permission> - Grant permission',
      '• /msg <botname> !revoke <user> <permission> - Revoke permission',
      '• /msg <botname> !audit - Show audit log',
      '',
      '**💡 Important Admin Tips:**',
      '• 🚫 NEVER use admin commands in channels - you will be penalized!',
      '• ✅ ALWAYS use private messages: /msg <botname> !command',
      '• 🔍 Use !status for detailed system information',
      '• 📊 Monitor logs for any issues',
      '• 🎉 Use events to engage players',
      '• 🏆 Regular tournaments keep players active',
      '• 🛡️ Be careful with ban/kick commands',
      '',
      '**Example Admin Usage:**',
      '• /msg MultiRPGBot !status',
      '• /msg MultiRPGBot !broadcast Welcome to the server!',
      '• /msg MultiRPGBot !ban troublemaker Spamming',
      '• /msg MultiRPGBot !event start Dragon Invasion'
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
      `🤖 **Enhanced MultiRPG Bot Status** 🤖`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🌐 **Networks:** ${stats.connectedNetworks}/${stats.totalNetworks} connected`,
      `👥 **Players:** ${stats.totalPlayers} total across all networks`,
      `📈 **Average Level:** ${levelStats.averageLevel}`,
      `⚔️ **Active Battles:** ${battleStats.activeBattles}`,
      `🏆 **Active Tournaments:** ${tournamentStats.activeTournaments}`,
      `📜 **Active Quests:** ${this.questSystem.getActiveQuests().length}`,
      `⏰ **Uptime:** ${this.getUptime()}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💡 Use !status <player> to check another player's status!`
    ].join('\n');
  }

  /**
   * Get player status message
   * @param {string} playerName - Player name to check
   */
  async getPlayerStatusMessage(playerName) {
    try {
      // Search for player across all networks
      const playerData = await this.globalPlayerSystem.findPlayer(playerName);
      
      if (!playerData) {
        return [
          `❌ **Player Not Found** ❌`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `Player "${playerName}" was not found in any network.`,
          `💡 Make sure the player name is spelled correctly.`,
          `💡 Use !players to see online players.`
        ].join('\n');
      }

      const playerClass = this.playerClasses.getPlayerClass(playerData.globalId);
      const guild = this.guildSystem.getPlayerGuild(playerData.globalId);
      const networkInfo = this.networks.get(playerData.networkId);
      
      return [
        `👤 **Player Status: ${playerData.name}** 👤`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🎭 **Character:** ${playerData.name} [${playerClass ? playerClass.className : 'No Class'}]`,
        `📊 **Level:** ${playerData.level}`,
        `💎 **Experience:** ${playerData.experience || 0}`,
        `💰 **Gold:** ${playerData.gold || 0}`,
        `🏦 **Bank:** ${playerData.bank || 0}`,
        `⚔️ **Battles Won:** ${playerData.stats?.battlesWon || 0}`,
        `🏆 **Tournaments Won:** ${playerData.stats?.tournamentsWon || 0}`,
        `📜 **Quests Completed:** ${playerData.stats?.questsCompleted || 0}`,
        `🏰 **Guild:** ${guild ? guild.name : 'No Guild'}`,
        `🌐 **Network:** ${networkInfo ? networkInfo.name : 'Unknown'}`,
        `🕐 **Last Seen:** ${this.formatLastSeen(playerData.lastSeen)}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `💡 Use !players to see all online players!`
      ].join('\n');
    } catch (error) {
      this.logger.error('Error getting player status:', error);
      return [
        `❌ **Error** ❌`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Failed to retrieve player status for "${playerName}".`,
        `💡 Please try again later.`
      ].join('\n');
    }
  }

  /**
   * Format last seen time
   * @param {Date} lastSeen - Last seen timestamp
   */
  formatLastSeen(lastSeen) {
    if (!lastSeen) return 'Never';
    
    const now = new Date();
    const diff = now - new Date(lastSeen);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
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