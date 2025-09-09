/**
 * Simplified MultiRPG Bot for IRC Networks
 * Basic version that works with the 'irc' package
 */

const config = require('./config');
const irc = require('irc');

class SimpleMultiRPGBot {
  constructor() {
    this.config = config;
    this.clients = new Map();
    this.networks = new Map();
    this.isRunning = false;
    this.startTime = Date.now();
    
    console.log('🤖 MultiRPG Bot starting...');
    this.init();
  }

  /**
   * Initialize the bot
   */
  async init() {
    try {
      console.log('📋 Loading configuration...');
      
      // Configuration is already loaded
      console.log('✅ Configuration loaded successfully');
      
      // Start networks
      await this.startNetworks();
      
      this.isRunning = true;
      console.log('🚀 MultiRPG Bot is now running!');
      console.log('📝 Use Ctrl+C to stop the bot');
      
    } catch (error) {
      console.error('❌ Failed to initialize bot:', error.message);
      process.exit(1);
    }
  }

  /**
   * Start all configured networks
   */
  async startNetworks() {
    const networks = this.config.networks.filter(network => network.enabled);
    
    if (networks.length === 0) {
      console.log('⚠️ No enabled networks found in configuration');
      return;
    }

    console.log(`🌐 Starting ${networks.length} network(s)...`);

    for (const networkConfig of networks) {
      try {
        await this.setupNetwork(networkConfig);
      } catch (error) {
        console.error(`❌ Failed to setup network ${networkConfig.name}:`, error.message);
      }
    }
  }

  /**
   * Setup individual network
   * @param {Object} networkConfig - Network configuration
   */
  async setupNetwork(networkConfig) {
    console.log(`🔗 Connecting to ${networkConfig.name} (${networkConfig.irc.server})...`);

    const client = new irc.Client(networkConfig.irc.server, networkConfig.irc.nick, {
      userName: networkConfig.irc.user,
      realName: networkConfig.irc.realname,
      port: networkConfig.irc.port,
      password: networkConfig.irc.password,
      secure: networkConfig.irc.secure,
      channels: networkConfig.irc.channels,
      autoConnect: true,
      autoRejoin: true,
      retryCount: 5,
      retryDelay: 5000
    });

    this.clients.set(networkConfig.id, client);
    this.networks.set(networkConfig.id, networkConfig);

    // Setup event handlers
    this.setupNetworkHandlers(networkConfig.id, client, networkConfig);
  }

  /**
   * Setup network event handlers
   * @param {string} networkId - Network ID
   * @param {Object} client - IRC client
   * @param {Object} networkConfig - Network configuration
   */
  setupNetworkHandlers(networkId, client, networkConfig) {
    // On connect
    client.addListener('registered', () => {
      console.log(`✅ Connected to ${networkConfig.name} (${networkConfig.irc.server})`);
      
      // Join admin channel if specified
      if (networkConfig.irc.adminChannel) {
        client.join(networkConfig.irc.adminChannel);
        console.log(`👑 Joined admin channel: ${networkConfig.irc.adminChannel}`);
      }
      
      // Login to game service
      if (networkConfig.game.autoLogin) {
        client.say(networkConfig.game.nickname, `login ${networkConfig.irc.nick} ${networkConfig.game.password}`);
        console.log(`🎮 Logged into game service`);
      }
    });

    // On disconnect
    client.addListener('disconnect', () => {
      console.log(`⚠️ Disconnected from ${networkConfig.name}`);
    });

    // On error
    client.addListener('error', (error) => {
      console.error(`❌ Error on ${networkConfig.name}:`, error.message);
    });

    // On channel messages (player commands)
    client.addListener('message', (from, to, message) => {
      if (networkConfig.irc.channels.includes(to)) {
        this.handleChannelMessage(from, to, message, networkId, networkConfig);
      }
    });

    // On private messages
    client.addListener('pm', (from, message) => {
      this.handlePrivateMessage(from, message, networkId, networkConfig);
    });
  }

  /**
   * Handle channel messages
   * @param {string} from - Sender nickname
   * @param {string} to - Channel name
   * @param {string} message - Message content
   * @param {string} networkId - Network ID
   * @param {Object} networkConfig - Network configuration
   */
  handleChannelMessage(from, to, message, networkId, networkConfig) {
    const msg = message.trim();
    
    // Basic command handling
    if (msg.startsWith('!help')) {
      this.sendMessage(networkId, to, '🎮 MultiRPG Bot Commands: !help, !status, !level, !class, !guild, !battle, !quest');
    } else if (msg.startsWith('!status')) {
      this.sendMessage(networkId, to, '🤖 MultiRPG Bot is running! Connected to ' + this.clients.size + ' network(s)');
    } else if (msg.startsWith('!level')) {
      this.sendMessage(networkId, to, `📊 ${from}, you are level 1 (0/1000 XP)`);
    } else if (msg.startsWith('!class')) {
      this.sendMessage(networkId, to, `⚔️ ${from}, you are a Warrior. Use !help for more commands.`);
    } else if (msg.startsWith('!guild')) {
      this.sendMessage(networkId, to, `🏰 ${from}, you are not in a guild yet. Use !guild join <name> to join one.`);
    } else if (msg.startsWith('!battle')) {
      this.sendMessage(networkId, to, `⚔️ ${from}, use !battle pve for PvE or !battle pvp <player> for PvP`);
    } else if (msg.startsWith('!quest')) {
      this.sendMessage(networkId, to, `📜 ${from}, no active quests. Use !quest list to see available quests.`);
    }
  }

  /**
   * Handle private messages
   * @param {string} from - Sender nickname
   * @param {string} message - Message content
   * @param {string} networkId - Network ID
   * @param {Object} networkConfig - Network configuration
   */
  handlePrivateMessage(from, message, networkId, networkConfig) {
    // Handle admin commands
    if (message.startsWith('!admin')) {
      this.sendMessage(networkId, from, '👑 Admin commands: !admin status, !admin broadcast <message>');
    } else if (message.startsWith('!admin status')) {
      this.sendMessage(networkId, from, '🤖 Bot Status: Running, Networks: ' + this.clients.size + ', Uptime: ' + this.getUptime());
    } else if (message.startsWith('!admin broadcast')) {
      const broadcastMsg = message.replace('!admin broadcast ', '');
      this.broadcastMessage(broadcastMsg);
    }
  }

  /**
   * Send message to channel or user
   * @param {string} networkId - Network ID
   * @param {string} target - Channel or user
   * @param {string} message - Message to send
   */
  sendMessage(networkId, target, message) {
    const client = this.clients.get(networkId);
    if (client) {
      client.say(target, message);
    }
  }

  /**
   * Broadcast message to all networks
   * @param {string} message - Message to broadcast
   */
  broadcastMessage(message) {
    console.log(`📢 Broadcasting: ${message}`);
    for (const [networkId, client] of this.clients) {
      const networkConfig = this.networks.get(networkId);
      for (const channel of networkConfig.irc.channels) {
        client.say(channel, `📢 ${message}`);
      }
    }
  }

  /**
   * Get bot uptime
   * @returns {string} Formatted uptime
   */
  getUptime() {
    const uptime = Date.now() - this.startTime;
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Shutdown the bot
   */
  shutdown() {
    console.log('🛑 Shutting down MultiRPG Bot...');
    
    for (const [networkId, client] of this.clients) {
      client.disconnect('Bot shutting down');
    }
    
    this.isRunning = false;
    console.log('✅ MultiRPG Bot stopped');
    process.exit(0);
  }
}

// Create and start the bot
const bot = new SimpleMultiRPGBot();

// Handle shutdown gracefully
process.on('SIGINT', () => {
  bot.shutdown();
});

process.on('SIGTERM', () => {
  bot.shutdown();
});

// Keep the process alive
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  bot.shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  bot.shutdown();
});