/**
 * Player Classes System for IRC MultiRPG Bot
 * Handles different character classes with unique attributes and abilities
 */

const EventEmitter = require('events');
const winston = require('winston');
const _ = require('lodash');

class PlayerClasses extends EventEmitter {
  constructor(config, globalSync) {
    super();
    this.config = config;
    this.globalSync = globalSync;
    this.playerClasses = new Map(); // playerId -> class data
    this.classDefinitions = new Map();
    
    this.logger = winston.createLogger({
      level: this.config.get('global.logLevel', 'info'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'player-classes' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.init();
  }

  /**
   * Initialize player classes system
   */
  init() {
    this.setupClassDefinitions();
    this.setupEventHandlers();
    
    this.logger.info('⚔️ Player classes system initialized');
  }

  /**
   * Setup class definitions with unique attributes and abilities
   */
  setupClassDefinitions() {
    this.classDefinitions = new Map([
      ['warrior', {
        name: 'Warrior',
        description: 'A mighty fighter specializing in close combat and physical strength',
        emoji: '⚔️',
        baseStats: {
          hp: 120,
          attack: 80,
          defense: 60,
          speed: 40,
          magic: 20,
          mana: 50
        },
        statGrowth: {
          hp: 15,
          attack: 12,
          defense: 10,
          speed: 5,
          magic: 2,
          mana: 3
        },
        abilities: [
          {
            name: 'Berserker Rage',
            description: 'Increases attack power by 50% for 3 turns',
            level: 5,
            cooldown: 300000, // 5 minutes
            effect: 'attack_boost',
            value: 0.5,
            duration: 3
          },
          {
            name: 'Shield Wall',
            description: 'Reduces incoming damage by 30% for 2 turns',
            level: 10,
            cooldown: 240000, // 4 minutes
            effect: 'damage_reduction',
            value: 0.3,
            duration: 2
          },
          {
            name: 'Whirlwind Strike',
            description: 'Attacks all enemies with 75% normal damage',
            level: 15,
            cooldown: 180000, // 3 minutes
            effect: 'area_attack',
            value: 0.75,
            targets: 'all'
          }
        ],
        specializations: ['Berserker', 'Guardian', 'Champion'],
        guildBonus: 'Guild members gain +10% attack power'
      }],

      ['mage', {
        name: 'Mage',
        description: 'A master of arcane arts with powerful magical abilities',
        emoji: '🔮',
        baseStats: {
          hp: 80,
          attack: 40,
          defense: 30,
          speed: 50,
          magic: 100,
          mana: 150
        },
        statGrowth: {
          hp: 8,
          attack: 4,
          defense: 3,
          speed: 6,
          magic: 15,
          mana: 20
        },
        abilities: [
          {
            name: 'Fireball',
            description: 'Launches a powerful fireball dealing 150% magic damage',
            level: 3,
            cooldown: 120000, // 2 minutes
            effect: 'magic_attack',
            value: 1.5,
            element: 'fire'
          },
          {
            name: 'Ice Shield',
            description: 'Creates a protective barrier that absorbs 200 damage',
            level: 8,
            cooldown: 300000, // 5 minutes
            effect: 'damage_absorption',
            value: 200,
            duration: 5
          },
          {
            name: 'Lightning Storm',
            description: 'Calls down lightning on all enemies for 100% magic damage',
            level: 12,
            cooldown: 240000, // 4 minutes
            effect: 'area_magic',
            value: 1.0,
            element: 'lightning',
            targets: 'all'
          }
        ],
        specializations: ['Elementalist', 'Necromancer', 'Enchanter'],
        guildBonus: 'Guild members gain +15% magic power'
      }],

      ['paladin', {
        name: 'Paladin',
        description: 'A holy warrior combining martial prowess with divine magic',
        emoji: '🛡️',
        baseStats: {
          hp: 110,
          attack: 60,
          defense: 70,
          speed: 45,
          magic: 60,
          mana: 100
        },
        statGrowth: {
          hp: 12,
          attack: 8,
          defense: 12,
          speed: 5,
          magic: 8,
          mana: 12
        },
        abilities: [
          {
            name: 'Divine Strike',
            description: 'A holy attack that deals 120% damage and heals for 25% of damage dealt',
            level: 4,
            cooldown: 150000, // 2.5 minutes
            effect: 'holy_attack',
            value: 1.2,
            heal: 0.25
          },
          {
            name: 'Blessing of Light',
            description: 'Heals all allies for 50% of their max HP',
            level: 9,
            cooldown: 300000, // 5 minutes
            effect: 'group_heal',
            value: 0.5,
            targets: 'allies'
          },
          {
            name: 'Divine Protection',
            description: 'Makes all allies immune to negative effects for 2 turns',
            level: 14,
            cooldown: 360000, // 6 minutes
            effect: 'immunity',
            duration: 2,
            targets: 'allies'
          }
        ],
        specializations: ['Crusader', 'Templar', 'Inquisitor'],
        guildBonus: 'Guild members gain +12% defense and healing'
      }],

      ['rogue', {
        name: 'Rogue',
        description: 'A stealthy assassin with high speed and critical hit potential',
        emoji: '🗡️',
        baseStats: {
          hp: 90,
          attack: 70,
          defense: 40,
          speed: 80,
          magic: 30,
          mana: 60
        },
        statGrowth: {
          hp: 9,
          attack: 10,
          defense: 4,
          speed: 12,
          magic: 3,
          mana: 6
        },
        abilities: [
          {
            name: 'Stealth',
            description: 'Becomes invisible for 2 turns, next attack deals 200% damage',
            level: 3,
            cooldown: 180000, // 3 minutes
            effect: 'stealth',
            duration: 2,
            next_attack: 2.0
          },
          {
            name: 'Poison Blade',
            description: 'Attacks with a poisoned weapon dealing damage over 3 turns',
            level: 7,
            cooldown: 120000, // 2 minutes
            effect: 'poison',
            value: 0.3,
            duration: 3
          },
          {
            name: 'Shadow Strike',
            description: 'Teleports behind enemy and deals 150% damage with 50% crit chance',
            level: 11,
            cooldown: 240000, // 4 minutes
            effect: 'teleport_attack',
            value: 1.5,
            crit_chance: 0.5
          }
        ],
        specializations: ['Assassin', 'Thief', 'Shadowblade'],
        guildBonus: 'Guild members gain +20% critical hit chance'
      }],

      ['druid', {
        name: 'Druid',
        description: 'A nature guardian with healing and transformation abilities',
        emoji: '🌿',
        baseStats: {
          hp: 100,
          attack: 50,
          defense: 50,
          speed: 55,
          magic: 80,
          mana: 120
        },
        statGrowth: {
          hp: 11,
          attack: 6,
          defense: 6,
          speed: 7,
          magic: 12,
          mana: 15
        },
        abilities: [
          {
            name: 'Healing Touch',
            description: 'Heals target for 80% of their max HP',
            level: 2,
            cooldown: 90000, // 1.5 minutes
            effect: 'heal',
            value: 0.8
          },
          {
            name: 'Nature\'s Wrath',
            description: 'Summons vines that deal 100% magic damage and slow enemies',
            level: 6,
            cooldown: 150000, // 2.5 minutes
            effect: 'nature_attack',
            value: 1.0,
            slow: 0.5
          },
          {
            name: 'Wild Shape',
            description: 'Transforms into a bear gaining +50% HP and attack for 4 turns',
            level: 10,
            cooldown: 300000, // 5 minutes
            effect: 'transform',
            hp_boost: 0.5,
            attack_boost: 0.5,
            duration: 4
          }
        ],
        specializations: ['Beastmaster', 'Shaman', 'Guardian'],
        guildBonus: 'Guild members gain +15% HP regeneration'
      }],

      ['archer', {
        name: 'Archer',
        description: 'A ranged fighter with precision and long-distance combat skills',
        emoji: '🏹',
        baseStats: {
          hp: 85,
          attack: 75,
          defense: 35,
          speed: 70,
          magic: 40,
          mana: 70
        },
        statGrowth: {
          hp: 8,
          attack: 11,
          defense: 3,
          speed: 10,
          magic: 4,
          mana: 7
        },
        abilities: [
          {
            name: 'Precision Shot',
            description: 'A guaranteed critical hit dealing 150% damage',
            level: 4,
            cooldown: 120000, // 2 minutes
            effect: 'guaranteed_crit',
            value: 1.5
          },
          {
            name: 'Multi-Shot',
            description: 'Fires 3 arrows at different targets dealing 80% damage each',
            level: 8,
            cooldown: 180000, // 3 minutes
            effect: 'multi_attack',
            value: 0.8,
            count: 3
          },
          {
            name: 'Explosive Arrow',
            description: 'Fires an arrow that explodes dealing 120% damage to all enemies',
            level: 13,
            cooldown: 240000, // 4 minutes
            effect: 'explosive_attack',
            value: 1.2,
            targets: 'all'
          }
        ],
        specializations: ['Ranger', 'Sniper', 'Beast Hunter'],
        guildBonus: 'Guild members gain +25% accuracy'
      }],

      ['necromancer', {
        name: 'Necromancer',
        description: 'A dark mage who commands the undead and drains life force',
        emoji: '💀',
        baseStats: {
          hp: 95,
          attack: 45,
          defense: 45,
          speed: 50,
          magic: 90,
          mana: 130
        },
        statGrowth: {
          hp: 10,
          attack: 5,
          defense: 5,
          speed: 6,
          magic: 14,
          mana: 18
        },
        abilities: [
          {
            name: 'Life Drain',
            description: 'Drains 60% of damage dealt as HP from target',
            level: 3,
            cooldown: 120000, // 2 minutes
            effect: 'life_drain',
            value: 0.6
          },
          {
            name: 'Summon Skeleton',
            description: 'Summons a skeleton minion to fight alongside you',
            level: 7,
            cooldown: 300000, // 5 minutes
            effect: 'summon',
            minion: 'skeleton',
            duration: 10
          },
          {
            name: 'Death Ray',
            description: 'Fires a beam of death dealing 200% magic damage',
            level: 12,
            cooldown: 360000, // 6 minutes
            effect: 'death_attack',
            value: 2.0,
            element: 'death'
          }
        ],
        specializations: ['Lich', 'Bone Lord', 'Soul Reaper'],
        guildBonus: 'Guild members gain +20% mana regeneration'
      }],

      ['monk', {
        name: 'Monk',
        description: 'A martial artist with incredible speed and unarmed combat mastery',
        emoji: '🥋',
        baseStats: {
          hp: 105,
          attack: 65,
          defense: 55,
          speed: 85,
          magic: 50,
          mana: 80
        },
        statGrowth: {
          hp: 11,
          attack: 9,
          defense: 7,
          speed: 14,
          magic: 6,
          mana: 10
        },
        abilities: [
          {
            name: 'Flying Kick',
            description: 'A high-speed kick dealing 130% damage with 30% chance to stun',
            level: 4,
            cooldown: 120000, // 2 minutes
            effect: 'kick_attack',
            value: 1.3,
            stun_chance: 0.3
          },
          {
            name: 'Meditation',
            description: 'Restores 50% of max HP and mana over 3 turns',
            level: 8,
            cooldown: 300000, // 5 minutes
            effect: 'meditation',
            hp_restore: 0.5,
            mana_restore: 0.5,
            duration: 3
          },
          {
            name: 'Dragon Punch',
            description: 'A devastating punch dealing 180% damage with 25% crit chance',
            level: 12,
            cooldown: 240000, // 4 minutes
            effect: 'dragon_punch',
            value: 1.8,
            crit_chance: 0.25
          }
        ],
        specializations: ['Dragon Master', 'Zen Warrior', 'Iron Fist'],
        guildBonus: 'Guild members gain +18% speed and evasion'
      }]
    ]);
  }

  /**
   * Assign class to player
   * @param {string} playerId - Player ID
   * @param {string} className - Class name
   * @param {Object} playerData - Player data
   */
  async assignClass(playerId, className, playerData = {}) {
    const classDef = this.classDefinitions.get(className.toLowerCase());
    if (!classDef) {
      throw new Error(`Unknown class: ${className}`);
    }

    const classData = {
      playerId,
      className: classDef.name,
      classKey: className.toLowerCase(),
      level: 1,
      experience: 0,
      stats: { ...classDef.baseStats },
      abilities: classDef.abilities.map(ability => ({
        ...ability,
        learned: false,
        cooldownEnd: 0
      })),
      specializations: classDef.specializations,
      guildBonus: classDef.guildBonus,
      assignedAt: Date.now()
    };

    this.playerClasses.set(playerId, classData);
    
    this.logger.info(`⚔️ Class assigned: ${playerId} -> ${classDef.name}`);
    this.emit('classAssigned', { playerId, className: classDef.name, classData });
    
    return classData;
  }

  /**
   * Get player class
   * @param {string} playerId - Player ID
   */
  getPlayerClass(playerId) {
    return this.playerClasses.get(playerId);
  }

  /**
   * Level up player class
   * @param {string} playerId - Player ID
   * @param {number} levels - Number of levels to gain
   */
  async levelUpClass(playerId, levels = 1) {
    const classData = this.playerClasses.get(playerId);
    if (!classData) {
      throw new Error(`Player ${playerId} has no class assigned`);
    }

    const classDef = this.classDefinitions.get(classData.classKey);
    if (!classDef) {
      throw new Error(`Class definition not found: ${classData.classKey}`);
    }

    const oldLevel = classData.level;
    classData.level += levels;
    classData.experience += levels * 100;

    // Apply stat growth
    for (let i = 0; i < levels; i++) {
      for (const [stat, growth] of Object.entries(classDef.statGrowth)) {
        classData.stats[stat] += growth;
      }
    }

    // Learn new abilities
    const newAbilities = classDef.abilities.filter(ability => 
      ability.level <= classData.level && 
      !classData.abilities.find(a => a.name === ability.name)
    );

    for (const ability of newAbilities) {
      classData.abilities.push({
        ...ability,
        learned: true,
        cooldownEnd: 0
      });
    }

    this.logger.info(`📈 Class leveled up: ${playerId} -> ${classData.className} Level ${classData.level}`);
    this.emit('classLevelUp', { playerId, oldLevel, newLevel: classData.level, classData });

    return classData;
  }

  /**
   * Get available classes
   */
  getAvailableClasses() {
    return Array.from(this.classDefinitions.values()).map(classDef => ({
      key: classDef.name.toLowerCase(),
      name: classDef.name,
      description: classDef.description,
      emoji: classDef.emoji,
      baseStats: classDef.baseStats
    }));
  }

  /**
   * Get class statistics
   */
  getClassStats() {
    const stats = {
      totalPlayers: this.playerClasses.size,
      classDistribution: {},
      averageLevel: 0,
      totalExperience: 0
    };

    let totalLevel = 0;
    let totalExp = 0;

    for (const classData of this.playerClasses.values()) {
      const className = classData.className;
      stats.classDistribution[className] = (stats.classDistribution[className] || 0) + 1;
      totalLevel += classData.level;
      totalExp += classData.experience;
    }

    if (this.playerClasses.size > 0) {
      stats.averageLevel = Math.floor(totalLevel / this.playerClasses.size);
      stats.totalExperience = totalExp;
    }

    return stats;
  }

  /**
   * Get class leaderboard
   * @param {string} className - Class name (optional)
   * @param {number} limit - Limit results
   */
  getClassLeaderboard(className = null, limit = 10) {
    let players = Array.from(this.playerClasses.values());

    if (className) {
      players = players.filter(p => p.className.toLowerCase() === className.toLowerCase());
    }

    players.sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return b.experience - a.experience;
    });

    return players.slice(0, limit);
  }

  /**
   * Calculate class-based stats
   * @param {string} playerId - Player ID
   * @param {number} baseLevel - Base player level
   */
  calculateClassStats(playerId, baseLevel = 1) {
    const classData = this.getPlayerClass(playerId);
    if (!classData) {
      return null;
    }

    const classDef = this.classDefinitions.get(classData.classKey);
    const stats = { ...classData.stats };

    // Apply level scaling
    const levelDiff = baseLevel - classData.level;
    if (levelDiff > 0) {
      for (const [stat, growth] of Object.entries(classDef.statGrowth)) {
        stats[stat] += growth * levelDiff;
      }
    }

    return stats;
  }

  /**
   * Get class abilities
   * @param {string} playerId - Player ID
   */
  getPlayerAbilities(playerId) {
    const classData = this.getPlayerClass(playerId);
    if (!classData) {
      return [];
    }

    return classData.abilities.filter(ability => ability.learned);
  }

  /**
   * Check if ability is on cooldown
   * @param {string} playerId - Player ID
   * @param {string} abilityName - Ability name
   */
  isAbilityOnCooldown(playerId, abilityName) {
    const classData = this.getPlayerClass(playerId);
    if (!classData) {
      return true;
    }

    const ability = classData.abilities.find(a => a.name === abilityName);
    if (!ability) {
      return true;
    }

    return Date.now() < ability.cooldownEnd;
  }

  /**
   * Use ability
   * @param {string} playerId - Player ID
   * @param {string} abilityName - Ability name
   */
  useAbility(playerId, abilityName) {
    const classData = this.getPlayerClass(playerId);
    if (!classData) {
      throw new Error(`Player ${playerId} has no class assigned`);
    }

    const ability = classData.abilities.find(a => a.name === abilityName);
    if (!ability) {
      throw new Error(`Ability not found: ${abilityName}`);
    }

    if (!ability.learned) {
      throw new Error(`Ability not learned: ${abilityName}`);
    }

    if (this.isAbilityOnCooldown(playerId, abilityName)) {
      throw new Error(`Ability on cooldown: ${abilityName}`);
    }

    // Set cooldown
    ability.cooldownEnd = Date.now() + ability.cooldown;

    this.logger.info(`⚡ Ability used: ${playerId} -> ${abilityName}`);
    this.emit('abilityUsed', { playerId, abilityName, ability });

    return ability;
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.on('classAssigned', (data) => {
      this.logger.info(`Class assigned: ${data.playerId} -> ${data.className}`);
    });

    this.on('classLevelUp', (data) => {
      this.logger.info(`Class leveled up: ${data.playerId} -> Level ${data.newLevel}`);
    });

    this.on('abilityUsed', (data) => {
      this.logger.info(`Ability used: ${data.playerId} -> ${data.abilityName}`);
    });
  }

  /**
   * Cleanup and close
   */
  cleanup() {
    this.logger.info('🧹 Player classes cleanup completed');
  }
}

module.exports = PlayerClasses;