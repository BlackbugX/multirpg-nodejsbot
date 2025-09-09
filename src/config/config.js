/**
 * Enhanced MultiRPG Bot Configuration
 * Supports multi-network gameplay with global synchronization
 */

const Joi = require('joi');

// Configuration validation schema
const configSchema = Joi.object({
  global: Joi.object({
    botName: Joi.string().required(),
    version: Joi.string().default('2.0.0'),
    language: Joi.string().default('en'),
    timezone: Joi.string().default('UTC'),
    logLevel: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    enableWebInterface: Joi.boolean().default(true),
    webPort: Joi.number().port().default(3000),
    enableRedis: Joi.boolean().default(true),
    redisUrl: Joi.string().default('redis://localhost:6379'),
    enableDatabase: Joi.boolean().default(true),
    databasePath: Joi.string().default('./data/game.db')
  }).required(),
  
  networks: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    enabled: Joi.boolean().default(true),
    priority: Joi.number().min(1).max(10).default(5),
    irc: Joi.object({
      server: Joi.string().required(),
      port: Joi.number().port().default(6667),
      secure: Joi.boolean().default(false),
      nick: Joi.string().required(),
      user: Joi.string().required(),
      realname: Joi.string().required(),
      password: Joi.string().allow('').default(''),
      channels: Joi.array().items(Joi.string()).min(1).required(),
      gameChannel: Joi.string().required(),
      adminChannel: Joi.string().required()
    }).required(),
    game: Joi.object({
      nickname: Joi.string().required(),
      password: Joi.string().required(),
      alignment: Joi.string().valid('priest', 'warrior', 'rogue').default('priest'),
      autoLogin: Joi.boolean().default(true),
      autoReconnect: Joi.boolean().default(true),
      reconnectDelay: Joi.number().min(1000).default(5000)
    }).required()
  })).min(1).required(),
  
  gameplay: Joi.object({
    enableGlobalSync: Joi.boolean().default(true),
    enableCrossNetworkBattles: Joi.boolean().default(true),
    enableTournaments: Joi.boolean().default(true),
    enableQuests: Joi.boolean().default(true),
    enableMilestones: Joi.boolean().default(true),
    enableChainEvents: Joi.boolean().default(true),
    maxLevel: Joi.number().min(1000).default(9999),
    levelScaling: Joi.object({
      baseExp: Joi.number().min(100).default(1000),
      scalingFactor: Joi.number().min(1.1).max(3.0).default(1.5),
      milestoneLevels: Joi.array().items(Joi.number()).default([10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000])
    }).required(),
    matchmaking: Joi.object({
      enableLevelBrackets: Joi.boolean().default(true),
      levelBracketSize: Joi.number().min(5).max(50).default(10),
      enableRanking: Joi.boolean().default(true),
      rankingDecay: Joi.number().min(0).max(1).default(0.95),
      maxMatchmakingTime: Joi.number().min(30000).default(300000),
      enableRandomMatching: Joi.boolean().default(true)
    }).required(),
    tournaments: Joi.object({
      autoSchedule: Joi.boolean().default(true),
      scheduleInterval: Joi.string().default('0 0 */6 * *'), // Every 6 hours
      minParticipants: Joi.number().min(2).default(4),
      maxParticipants: Joi.number().min(8).default(32),
      entryFee: Joi.number().min(0).default(100),
      prizePool: Joi.object({
        first: Joi.number().min(0).default(0.5),
        second: Joi.number().min(0).default(0.3),
        third: Joi.number().min(0).default(0.2)
      }).required()
    }).required()
  }).required(),
  
  admin: Joi.object({
    enabled: Joi.boolean().default(true),
    commands: Joi.object({
      enableBroadcast: Joi.boolean().default(true),
      enablePlayerManagement: Joi.boolean().default(true),
      enableEventManagement: Joi.boolean().default(true),
      enableTournamentManagement: Joi.boolean().default(true),
      enableGlobalEvents: Joi.boolean().default(true)
    }).required(),
    permissions: Joi.array().items(Joi.string()).default(['admin', 'moderator']),
    logActions: Joi.boolean().default(true)
  }).required(),
  
  messages: Joi.object({
    language: Joi.string().default('en'),
    enableEmojis: Joi.boolean().default(true),
    enableRichFormatting: Joi.boolean().default(true),
    tone: Joi.string().valid('friendly', 'professional', 'casual').default('friendly'),
    customMessages: Joi.object().default({})
  }).required()
});

class ConfigManager {
  constructor() {
    this.config = null;
    this.loaded = false;
  }

  /**
   * Load configuration from file or environment
   * @param {string} configPath - Path to config file
   */
  load(configPath = './config.json') {
    try {
      let configData;
      
      // Try to load from file first
      try {
        configData = require(configPath);
      } catch (fileError) {
        // Fallback to example config
        configData = require('./example-config.js');
      }

      // Validate configuration
      const { error, value } = configSchema.validate(configData, {
        abortEarly: false,
        allowUnknown: false
      });

      if (error) {
        throw new Error(`Configuration validation failed: ${error.details.map(d => d.message).join(', ')}`);
      }

      this.config = value;
      this.loaded = true;
      
      console.log('✅ Configuration loaded successfully');
      return this.config;
    } catch (error) {
      console.error('❌ Failed to load configuration:', error.message);
      throw error;
    }
  }

  /**
   * Get configuration value by path
   * @param {string} path - Dot notation path (e.g., 'global.botName')
   * @param {*} defaultValue - Default value if path not found
   */
  get(path, defaultValue = undefined) {
    if (!this.loaded) {
      throw new Error('Configuration not loaded');
    }

    return path.split('.').reduce((obj, key) => {
      return obj && obj[key] !== undefined ? obj[key] : defaultValue;
    }, this.config);
  }

  /**
   * Get all networks configuration
   */
  getNetworks() {
    return this.get('networks', []);
  }

  /**
   * Get enabled networks only
   */
  getEnabledNetworks() {
    return this.getNetworks().filter(network => network.enabled);
  }

  /**
   * Get network by ID
   * @param {string} networkId - Network identifier
   */
  getNetwork(networkId) {
    return this.getNetworks().find(network => network.id === networkId);
  }

  /**
   * Check if feature is enabled
   * @param {string} feature - Feature path (e.g., 'gameplay.enableGlobalSync')
   */
  isFeatureEnabled(feature) {
    return this.get(feature, false);
  }

  /**
   * Get all configuration
   */
  getAll() {
    if (!this.loaded) {
      throw new Error('Configuration not loaded');
    }
    return this.config;
  }

  /**
   * Reload configuration
   * @param {string} configPath - Path to config file
   */
  reload(configPath = './config.json') {
    this.loaded = false;
    return this.load(configPath);
  }
}

module.exports = new ConfigManager();