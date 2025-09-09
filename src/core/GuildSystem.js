/**
 * Guild System for IRC MultiRPG Bot
 * Handles guild creation, management, and automatic recruitment
 */

const EventEmitter = require('events');
const winston = require('winston');
const _ = require('lodash');

class GuildSystem extends EventEmitter {
  constructor(config, globalSync, playerClasses) {
    super();
    this.config = config;
    this.globalSync = globalSync;
    this.playerClasses = playerClasses;
    this.guilds = new Map(); // guildId -> guild data
    this.playerGuilds = new Map(); // playerId -> guildId
    this.guildApplications = new Map(); // guildId -> applications
    this.guildWars = new Map(); // warId -> war data
    
    this.logger = winston.createLogger({
      level: this.config.get('global.logLevel', 'info'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'guild-system' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.init();
  }

  /**
   * Initialize guild system
   */
  init() {
    this.setupGuildTemplates();
    this.setupEventHandlers();
    this.startGuildProcessing();
    
    this.logger.info('🏰 Guild system initialized');
  }

  /**
   * Setup guild templates and default guilds
   */
  setupGuildTemplates() {
    this.guildTemplates = [
      {
        name: 'The Eternal Guardians',
        description: 'A noble guild dedicated to protecting the realm from darkness',
        motto: 'Light shall prevail over darkness',
        emoji: '🛡️',
        type: 'good',
        focus: 'defense',
        requirements: { level: 5, class: ['paladin', 'warrior', 'monk'] },
        bonuses: { defense: 0.15, healing: 0.10 }
      },
      {
        name: 'Shadow Brotherhood',
        description: 'A secretive guild of assassins and rogues',
        motto: 'In shadows we strike',
        emoji: '🗡️',
        type: 'neutral',
        focus: 'stealth',
        requirements: { level: 3, class: ['rogue', 'archer', 'necromancer'] },
        bonuses: { speed: 0.20, crit_chance: 0.15 }
      },
      {
        name: 'Arcane Scholars',
        description: 'A guild of powerful mages and magic researchers',
        motto: 'Knowledge is power',
        emoji: '🔮',
        type: 'good',
        focus: 'magic',
        requirements: { level: 7, class: ['mage', 'druid', 'necromancer'] },
        bonuses: { magic: 0.25, mana: 0.20 }
      },
      {
        name: 'Wild Hunters',
        description: 'A guild of nature guardians and beast masters',
        motto: 'Nature\'s call guides us',
        emoji: '🌿',
        type: 'neutral',
        focus: 'nature',
        requirements: { level: 4, class: ['druid', 'archer', 'monk'] },
        bonuses: { hp_regen: 0.15, nature_damage: 0.20 }
      },
      {
        name: 'Iron Fist Clan',
        description: 'A martial arts guild focused on physical perfection',
        motto: 'Strength through discipline',
        emoji: '🥋',
        type: 'neutral',
        focus: 'martial',
        requirements: { level: 6, class: ['monk', 'warrior', 'paladin'] },
        bonuses: { attack: 0.18, speed: 0.12 }
      }
    ];
  }

  /**
   * Create a new guild
   * @param {string} leaderId - Guild leader ID
   * @param {string} guildName - Guild name
   * @param {Object} options - Guild options
   */
  async createGuild(leaderId, guildName, options = {}) {
    // Check if player is already in a guild
    if (this.playerGuilds.has(leaderId)) {
      throw new Error('You are already in a guild!');
    }

    // Check if guild name is taken
    const existingGuild = Array.from(this.guilds.values()).find(g => 
      g.name.toLowerCase() === guildName.toLowerCase()
    );
    if (existingGuild) {
      throw new Error('Guild name is already taken!');
    }

    const guildId = this.generateGuildId();
    const guild = {
      id: guildId,
      name: guildName,
      description: options.description || 'A newly formed guild',
      motto: options.motto || 'Together we are stronger',
      emoji: options.emoji || '🏰',
      type: options.type || 'neutral',
      focus: options.focus || 'general',
      level: 1,
      experience: 0,
      members: [leaderId],
      leader: leaderId,
      officers: [],
      maxMembers: 20,
      treasury: 0,
      bonuses: options.bonuses || {},
      requirements: options.requirements || { level: 1 },
      created: Date.now(),
      lastActivity: Date.now(),
      stats: {
        totalBattles: 0,
        totalWins: 0,
        totalLosses: 0,
        totalQuests: 0,
        totalExperience: 0
      }
    };

    this.guilds.set(guildId, guild);
    this.playerGuilds.set(leaderId, guildId);

    this.logger.info(`🏰 Guild created: ${guildName} by ${leaderId}`);
    this.emit('guildCreated', { guild, leaderId });

    // Broadcast guild creation
    await this.globalSync.broadcast(
      `🏰 New guild "${guildName}" has been formed by ${leaderId}! Join the adventure! 🏰`,
      'guild',
      { guild, leaderId }
    );

    return guild;
  }

  /**
   * Auto-recruit player to appropriate guild
   * @param {string} playerId - Player ID
   * @param {Object} playerData - Player data
   */
  async autoRecruitPlayer(playerId, playerData) {
    // Check if player is already in a guild
    if (this.playerGuilds.has(playerId)) {
      return;
    }

    const playerClass = this.playerClasses.getPlayerClass(playerId);
    const playerLevel = playerData.level || 1;

    // Find suitable guilds
    const suitableGuilds = Array.from(this.guilds.values()).filter(guild => {
      // Check level requirement
      if (guild.requirements.level && playerLevel < guild.requirements.level) {
        return false;
      }

      // Check class requirement
      if (guild.requirements.class && playerClass) {
        const playerClassName = playerClass.className.toLowerCase();
        if (!guild.requirements.class.includes(playerClassName)) {
          return false;
        }
      }

      // Check if guild has space
      if (guild.members.length >= guild.maxMembers) {
        return false;
      }

      return true;
    });

    if (suitableGuilds.length === 0) {
      // Create a default guild if none suitable
      await this.createDefaultGuild(playerId, playerData);
      return;
    }

    // Sort by guild level and member count
    suitableGuilds.sort((a, b) => {
      if (a.level !== b.level) return b.level - a.level;
      return a.members.length - b.members.length;
    });

    const selectedGuild = suitableGuilds[0];
    await this.joinGuild(playerId, selectedGuild.id);
  }

  /**
   * Create a default guild for player
   * @param {string} playerId - Player ID
   * @param {Object} playerData - Player data
   */
  async createDefaultGuild(playerId, playerData) {
    const playerClass = this.playerClasses.getPlayerClass(playerId);
    const className = playerClass ? playerClass.className.toLowerCase() : 'warrior';

    // Find appropriate template
    const template = this.guildTemplates.find(t => 
      t.requirements.class.includes(className)
    ) || this.guildTemplates[0];

    const guildName = `${playerId}'s ${template.name}`;
    const guild = await this.createGuild(playerId, guildName, {
      description: template.description,
      motto: template.motto,
      emoji: template.emoji,
      type: template.type,
      focus: template.focus,
      bonuses: template.bonuses,
      requirements: template.requirements
    });

    this.logger.info(`🏰 Default guild created for ${playerId}: ${guildName}`);
    return guild;
  }

  /**
   * Join a guild
   * @param {string} playerId - Player ID
   * @param {string} guildId - Guild ID
   */
  async joinGuild(playerId, guildId) {
    const guild = this.guilds.get(guildId);
    if (!guild) {
      throw new Error('Guild not found!');
    }

    if (this.playerGuilds.has(playerId)) {
      throw new Error('You are already in a guild!');
    }

    if (guild.members.length >= guild.maxMembers) {
      throw new Error('Guild is full!');
    }

    // Add player to guild
    guild.members.push(playerId);
    this.playerGuilds.set(playerId, guildId);
    guild.lastActivity = Date.now();

    this.logger.info(`👥 Player ${playerId} joined guild ${guild.name}`);
    this.emit('playerJoinedGuild', { playerId, guildId, guild });

    // Broadcast guild join
    await this.globalSync.broadcast(
      `👥 ${playerId} has joined the guild "${guild.name}"! Welcome to the team! 👥`,
      'guild',
      { playerId, guild }
    );

    return guild;
  }

  /**
   * Leave a guild
   * @param {string} playerId - Player ID
   */
  async leaveGuild(playerId) {
    const guildId = this.playerGuilds.get(playerId);
    if (!guildId) {
      throw new Error('You are not in a guild!');
    }

    const guild = this.guilds.get(guildId);
    if (!guild) {
      throw new Error('Guild not found!');
    }

    // Remove player from guild
    guild.members = guild.members.filter(id => id !== playerId);
    this.playerGuilds.delete(playerId);
    guild.lastActivity = Date.now();

    // If leader left, promote officer or disband
    if (guild.leader === playerId) {
      if (guild.officers.length > 0) {
        guild.leader = guild.officers[0];
        guild.officers = guild.officers.slice(1);
      } else if (guild.members.length > 0) {
        guild.leader = guild.members[0];
      } else {
        // Disband guild
        this.guilds.delete(guildId);
        this.logger.info(`🏰 Guild ${guild.name} disbanded`);
        return;
      }
    }

    this.logger.info(`👥 Player ${playerId} left guild ${guild.name}`);
    this.emit('playerLeftGuild', { playerId, guildId, guild });

    // Broadcast guild leave
    await this.globalSync.broadcast(
      `👥 ${playerId} has left the guild "${guild.name}". Farewell! 👥`,
      'guild',
      { playerId, guild }
    );

    return guild;
  }

  /**
   * Level up guild
   * @param {string} guildId - Guild ID
   * @param {number} experience - Experience gained
   */
  async levelUpGuild(guildId, experience) {
    const guild = this.guilds.get(guildId);
    if (!guild) {
      throw new Error('Guild not found!');
    }

    guild.experience += experience;
    guild.stats.totalExperience += experience;

    const oldLevel = guild.level;
    const newLevel = Math.floor(guild.experience / 1000) + 1;

    if (newLevel > oldLevel) {
      guild.level = newLevel;
      guild.maxMembers = Math.min(50, 20 + (newLevel - 1) * 2);
      
      // Apply level bonuses
      guild.bonuses = {
        ...guild.bonuses,
        attack: (guild.bonuses.attack || 0) + 0.02,
        defense: (guild.bonuses.defense || 0) + 0.02,
        magic: (guild.bonuses.magic || 0) + 0.02,
        speed: (guild.bonuses.speed || 0) + 0.01
      };

      this.logger.info(`📈 Guild leveled up: ${guild.name} -> Level ${newLevel}`);
      this.emit('guildLevelUp', { guildId, oldLevel, newLevel, guild });

      // Broadcast guild level up
      await this.globalSync.broadcast(
        `📈 Guild "${guild.name}" has reached level ${newLevel}! The guild grows stronger! 📈`,
        'guild',
        { guild }
      );
    }

    return guild;
  }

  /**
   * Get guild information
   * @param {string} guildId - Guild ID
   */
  getGuild(guildId) {
    return this.guilds.get(guildId);
  }

  /**
   * Get player's guild
   * @param {string} playerId - Player ID
   */
  getPlayerGuild(playerId) {
    const guildId = this.playerGuilds.get(playerId);
    return guildId ? this.guilds.get(guildId) : null;
  }

  /**
   * Get guild members
   * @param {string} guildId - Guild ID
   */
  getGuildMembers(guildId) {
    const guild = this.guilds.get(guildId);
    return guild ? guild.members : [];
  }

  /**
   * Get guild leaderboard
   * @param {number} limit - Limit results
   */
  getGuildLeaderboard(limit = 10) {
    const guilds = Array.from(this.guilds.values());
    guilds.sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return b.experience - a.experience;
    });

    return guilds.slice(0, limit);
  }

  /**
   * Get guild statistics
   */
  getGuildStats() {
    const stats = {
      totalGuilds: this.guilds.size,
      totalMembers: Array.from(this.guilds.values()).reduce((total, guild) => total + guild.members.length, 0),
      averageLevel: 0,
      totalExperience: 0,
      guildTypes: {},
      guildFocuses: {}
    };

    let totalLevel = 0;
    let totalExp = 0;

    for (const guild of this.guilds.values()) {
      totalLevel += guild.level;
      totalExp += guild.experience;
      
      stats.guildTypes[guild.type] = (stats.guildTypes[guild.type] || 0) + 1;
      stats.guildFocuses[guild.focus] = (stats.guildFocuses[guild.focus] || 0) + 1;
    }

    if (this.guilds.size > 0) {
      stats.averageLevel = Math.floor(totalLevel / this.guilds.size);
      stats.totalExperience = totalExp;
    }

    return stats;
  }

  /**
   * Start guild war
   * @param {string} guild1Id - First guild ID
   * @param {string} guild2Id - Second guild ID
   * @param {Object} options - War options
   */
  async startGuildWar(guild1Id, guild2Id, options = {}) {
    const guild1 = this.guilds.get(guild1Id);
    const guild2 = this.guilds.get(guild2Id);

    if (!guild1 || !guild2) {
      throw new Error('One or both guilds not found!');
    }

    const warId = this.generateWarId();
    const war = {
      id: warId,
      guild1: guild1Id,
      guild2: guild2Id,
      status: 'active',
      startTime: Date.now(),
      endTime: Date.now() + (options.duration || 3600000), // 1 hour default
      participants: {
        [guild1Id]: [],
        [guild2Id]: []
      },
      score: {
        [guild1Id]: 0,
        [guild2Id]: 0
      },
      winner: null,
      rewards: options.rewards || {}
    };

    this.guildWars.set(warId, war);

    this.logger.info(`⚔️ Guild war started: ${guild1.name} vs ${guild2.name}`);
    this.emit('guildWarStarted', { war, guild1, guild2 });

    // Broadcast guild war
    await this.globalSync.broadcast(
      `⚔️ GUILD WAR! ${guild1.name} vs ${guild2.name}! May the strongest guild prevail! ⚔️`,
      'guild',
      { war, guild1, guild2 }
    );

    return war;
  }

  /**
   * Start guild processing loop
   */
  startGuildProcessing() {
    setInterval(() => {
      this.processGuildWars();
      this.processGuildApplications();
    }, 30000); // Every 30 seconds
  }

  /**
   * Process guild wars
   */
  processGuildWars() {
    const now = Date.now();
    
    for (const [warId, war] of this.guildWars) {
      if (war.status === 'active' && now >= war.endTime) {
        this.endGuildWar(warId);
      }
    }
  }

  /**
   * Process guild applications
   */
  processGuildApplications() {
    // Process pending applications
    for (const [guildId, applications] of this.guildApplications) {
      for (const application of applications) {
        if (Date.now() - application.timestamp > 300000) { // 5 minutes
          // Auto-reject expired applications
          this.rejectApplication(guildId, application.playerId);
        }
      }
    }
  }

  /**
   * End guild war
   * @param {string} warId - War ID
   */
  async endGuildWar(warId) {
    const war = this.guildWars.get(warId);
    if (!war) return;

    war.status = 'ended';
    war.winner = war.score[war.guild1] > war.score[war.guild2] ? war.guild1 : war.guild2;

    const guild1 = this.guilds.get(war.guild1);
    const guild2 = this.guilds.get(war.guild2);

    this.logger.info(`⚔️ Guild war ended: ${guild1.name} vs ${guild2.name}, Winner: ${war.winner}`);
    this.emit('guildWarEnded', { war, guild1, guild2 });

    // Broadcast war end
    await this.globalSync.broadcast(
      `⚔️ Guild war ended! ${guild1.name} vs ${guild2.name} - Winner: ${war.winner}! ⚔️`,
      'guild',
      { war, guild1, guild2 }
    );

    this.guildWars.delete(warId);
  }

  /**
   * Generate unique guild ID
   */
  generateGuildId() {
    return `guild_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique war ID
   */
  generateWarId() {
    return `war_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.on('guildCreated', (data) => {
      this.logger.info(`Guild created: ${data.guild.name} by ${data.leaderId}`);
    });

    this.on('playerJoinedGuild', (data) => {
      this.logger.info(`Player joined guild: ${data.playerId} -> ${data.guild.name}`);
    });

    this.on('playerLeftGuild', (data) => {
      this.logger.info(`Player left guild: ${data.playerId} -> ${data.guild.name}`);
    });

    this.on('guildLevelUp', (data) => {
      this.logger.info(`Guild leveled up: ${data.guild.name} -> Level ${data.newLevel}`);
    });

    this.on('guildWarStarted', (data) => {
      this.logger.info(`Guild war started: ${data.guild1.name} vs ${data.guild2.name}`);
    });

    this.on('guildWarEnded', (data) => {
      this.logger.info(`Guild war ended: ${data.guild1.name} vs ${data.guild2.name}`);
    });
  }

  /**
   * Cleanup and close
   */
  cleanup() {
    this.logger.info('🧹 Guild system cleanup completed');
  }
}

module.exports = GuildSystem;