/**
 * Infinite Level Progression System for IRC MultiRPG Bot
 * Handles infinite leveling with milestone rewards and dynamic scaling
 */

const EventEmitter = require('events');
const winston = require('winston');
const _ = require('lodash');

class LevelProgression extends EventEmitter {
  constructor(config, globalSync) {
    super();
    this.config = config;
    this.globalSync = globalSync;
    this.playerLevels = new Map(); // playerId -> level data
    this.milestones = new Map(); // milestone level -> rewards
    this.levelRewards = new Map(); // level -> rewards
    this.achievements = new Map(); // playerId -> achievements
    
    this.logger = winston.createLogger({
      level: this.config.get('global.logLevel', 'info'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'level-progression' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.init();
  }

  /**
   * Initialize level progression system
   */
  init() {
    this.setupMilestones();
    this.setupLevelRewards();
    this.setupEventHandlers();
    
    this.logger.info('📈 Infinite level progression system initialized');
  }

  /**
   * Setup milestone levels and rewards
   */
  setupMilestones() {
    const milestoneLevels = this.config.get('gameplay.levelScaling.milestoneLevels', [
      10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000
    ]);

    milestoneLevels.forEach(level => {
      this.milestones.set(level, {
        level,
        rewards: this.generateMilestoneRewards(level),
        title: this.generateMilestoneTitle(level),
        description: this.generateMilestoneDescription(level)
      });
    });
  }

  /**
   * Setup level rewards for every level
   */
  setupLevelRewards() {
    const maxLevel = this.config.get('gameplay.maxLevel', 9999);
    
    for (let level = 1; level <= maxLevel; level++) {
      this.levelRewards.set(level, {
        exp: this.calculateExpForLevel(level),
        gold: this.calculateGoldForLevel(level),
        items: this.generateLevelItems(level),
        special: this.generateSpecialRewards(level)
      });
    }
  }

  /**
   * Calculate experience required for level
   * @param {number} level - Target level
   */
  calculateExpForLevel(level) {
    const baseExp = this.config.get('gameplay.levelScaling.baseExp', 1000);
    const scalingFactor = this.config.get('gameplay.levelScaling.scalingFactor', 1.5);
    
    return Math.floor(baseExp * Math.pow(scalingFactor, level - 1));
  }

  /**
   * Calculate gold reward for level
   * @param {number} level - Level
   */
  calculateGoldForLevel(level) {
    const baseGold = 100;
    const levelMultiplier = level * 10;
    const milestoneBonus = this.isMilestoneLevel(level) ? level * 50 : 0;
    
    return baseGold + levelMultiplier + milestoneBonus;
  }

  /**
   * Generate milestone rewards
   * @param {number} level - Milestone level
   */
  generateMilestoneRewards(level) {
    const rewards = {
      gold: level * 1000,
      exp: level * 5000,
      items: this.generateMilestoneItems(level),
      special: this.generateMilestoneSpecial(level)
    };
    
    return rewards;
  }

  /**
   * Generate milestone items
   * @param {number} level - Milestone level
   */
  generateMilestoneItems(level) {
    const items = [];
    
    // Every 100 levels, get a special item
    if (level % 100 === 0) {
      items.push({
        name: this.getMilestoneItemName(level),
        rarity: 'Legendary',
        value: level * 1000,
        description: `A legendary item earned at level ${level}`
      });
    }
    
    // Every 50 levels, get a rare item
    if (level % 50 === 0) {
      items.push({
        name: this.getRareItemName(level),
        rarity: 'Epic',
        value: level * 500,
        description: `An epic item earned at level ${level}`
      });
    }
    
    // Every 25 levels, get a good item
    if (level % 25 === 0) {
      items.push({
        name: this.getGoodItemName(level),
        rarity: 'Rare',
        value: level * 250,
        description: `A rare item earned at level ${level}`
      });
    }
    
    return items;
  }

  /**
   * Generate milestone special rewards
   * @param {number} level - Milestone level
   */
  generateMilestoneSpecial(level) {
    const special = [];
    
    // Every 1000 levels, get a title
    if (level % 1000 === 0) {
      special.push({
        type: 'title',
        name: this.getMilestoneTitle(level),
        description: `A prestigious title earned at level ${level}`
      });
    }
    
    // Every 500 levels, get an achievement
    if (level % 500 === 0) {
      special.push({
        type: 'achievement',
        name: this.getMilestoneAchievement(level),
        description: `A rare achievement earned at level ${level}`
      });
    }
    
    // Every 100 levels, get a special ability
    if (level % 100 === 0) {
      special.push({
        type: 'ability',
        name: this.getMilestoneAbility(level),
        description: `A special ability unlocked at level ${level}`
      });
    }
    
    return special;
  }

  /**
   * Generate milestone title
   * @param {number} level - Milestone level
   */
  generateMilestoneTitle(level) {
    const titles = {
      100: 'Centurion',
      250: 'Champion',
      500: 'Master',
      1000: 'Legend',
      2500: 'Mythic Hero',
      5000: 'Eternal Champion',
      10000: 'Divine Being'
    };
    
    return titles[level] || `Level ${level} Hero`;
  }

  /**
   * Generate milestone description
   * @param {number} level - Milestone level
   */
  generateMilestoneDescription(level) {
    const descriptions = {
      10: 'You have proven yourself as a capable adventurer!',
      25: 'Your skills are growing, and legends speak your name!',
      50: 'You are becoming a force to be reckoned with!',
      100: 'You have achieved the status of a true hero!',
      250: 'Your power is legendary across all realms!',
      500: 'You are a master of your craft and beyond!',
      1000: 'You have transcended mortal limitations!',
      2500: 'You are a living legend, spoken of in hushed tones!',
      5000: 'You have achieved near-divine status!',
      10000: 'You have become a god among mortals!'
    };
    
    return descriptions[level] || `You have reached the incredible level ${level}!`;
  }

  /**
   * Generate level items for regular levels
   * @param {number} level - Level
   */
  generateLevelItems(level) {
    const items = [];
    
    // Every 10 levels, get a random item
    if (level % 10 === 0) {
      items.push({
        name: this.getRandomItem(level),
        rarity: this.getRandomRarity(level),
        value: level * 10,
        description: `A random item earned at level ${level}`
      });
    }
    
    return items;
  }

  /**
   * Generate special rewards for regular levels
   * @param {number} level - Level
   */
  generateSpecialRewards(level) {
    const special = [];
    
    // Every 5 levels, get a small bonus
    if (level % 5 === 0) {
      special.push({
        type: 'bonus',
        name: 'Level Bonus',
        description: `A small bonus for reaching level ${level}`,
        value: level * 5
      });
    }
    
    return special;
  }

  /**
   * Get milestone item name
   * @param {number} level - Milestone level
   */
  getMilestoneItemName(level) {
    const items = [
      'Crown of Legends', 'Sword of Eternity', 'Staff of Power',
      'Armor of the Gods', 'Shield of Invincibility', 'Ring of Omniscience',
      'Amulet of Immortality', 'Cloak of Shadows', 'Boots of Speed',
      'Gauntlets of Strength', 'Helmet of Wisdom', 'Belt of Endurance'
    ];
    
    return _.sample(items);
  }

  /**
   * Get rare item name
   * @param {number} level - Level
   */
  getRareItemName(level) {
    const items = [
      'Enchanted Sword', 'Mystic Staff', 'Blessed Armor',
      'Magic Shield', 'Power Ring', 'Wisdom Amulet',
      'Shadow Cloak', 'Speed Boots', 'Strength Gauntlets',
      'Wisdom Helmet', 'Endurance Belt', 'Luck Charm'
    ];
    
    return _.sample(items);
  }

  /**
   * Get good item name
   * @param {number} level - Level
   */
  getGoodItemName(level) {
    const items = [
      'Iron Sword', 'Wooden Staff', 'Leather Armor',
      'Steel Shield', 'Bronze Ring', 'Silver Amulet',
      'Wool Cloak', 'Leather Boots', 'Iron Gauntlets',
      'Steel Helmet', 'Leather Belt', 'Copper Charm'
    ];
    
    return _.sample(items);
  }

  /**
   * Get random item for level
   * @param {number} level - Level
   */
  getRandomItem(level) {
    const items = [
      'Health Potion', 'Mana Potion', 'Strength Potion',
      'Speed Potion', 'Defense Potion', 'Luck Potion',
      'Experience Scroll', 'Gold Coin', 'Magic Gem',
      'Ancient Rune', 'Mystic Crystal', 'Divine Essence'
    ];
    
    return _.sample(items);
  }

  /**
   * Get random rarity based on level
   * @param {number} level - Level
   */
  getRandomRarity(level) {
    const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
    const maxIndex = Math.min(Math.floor(level / 100), rarities.length - 1);
    return rarities[Math.floor(Math.random() * (maxIndex + 1))];
  }

  /**
   * Get milestone title
   * @param {number} level - Milestone level
   */
  getMilestoneTitle(level) {
    const titles = [
      'Dragon Slayer', 'Shadow Walker', 'Light Bringer',
      'Void Master', 'Time Keeper', 'Soul Reaper',
      'Crystal Guardian', 'Storm Lord', 'Ice Queen',
      'Fire King', 'Earth Shaker', 'Wind Rider'
    ];
    
    return _.sample(titles);
  }

  /**
   * Get milestone achievement
   * @param {number} level - Milestone level
   */
  getMilestoneAchievement(level) {
    const achievements = [
      'Level Master', 'Experience Hunter', 'Power Seeker',
      'Legend Builder', 'Myth Creator', 'Epic Achiever',
      'Infinite Warrior', 'Eternal Hero', 'Divine Champion'
    ];
    
    return _.sample(achievements);
  }

  /**
   * Get milestone ability
   * @param {number} level - Milestone level
   */
  getMilestoneAbility(level) {
    const abilities = [
      'Double Experience', 'Gold Multiplier', 'Item Finder',
      'Speed Boost', 'Strength Surge', 'Defense Aura',
      'Luck Charm', 'Wisdom Insight', 'Power Burst'
    ];
    
    return _.sample(abilities);
  }

  /**
   * Check if level is a milestone
   * @param {number} level - Level to check
   */
  isMilestoneLevel(level) {
    return this.milestones.has(level);
  }

  /**
   * Level up a player
   * @param {string} playerId - Player ID
   * @param {Object} playerData - Player data
   */
  async levelUp(playerId, playerData) {
    const currentLevel = this.getPlayerLevel(playerId);
    const newLevel = currentLevel + 1;
    
    // Update player level
    this.playerLevels.set(playerId, {
      level: newLevel,
      exp: 0,
      totalExp: this.calculateTotalExp(newLevel),
      lastLevelUp: Date.now(),
      networkId: playerData.networkId
    });
    
    // Get rewards for new level
    const rewards = this.levelRewards.get(newLevel);
    
    // Check for milestone rewards
    if (this.isMilestoneLevel(newLevel)) {
      const milestone = this.milestones.get(newLevel);
      await this.processMilestone(playerId, milestone);
    }
    
    // Process regular level rewards
    await this.processLevelRewards(playerId, newLevel, rewards);
    
    // Emit level up event
    this.emit('levelUp', {
      playerId,
      oldLevel: currentLevel,
      newLevel,
      rewards,
      isMilestone: this.isMilestoneLevel(newLevel)
    });
    
    this.logger.info(`📈 Player ${playerId} leveled up to ${newLevel}`);
    
    return {
      level: newLevel,
      rewards,
      isMilestone: this.isMilestoneLevel(newLevel)
    };
  }

  /**
   * Process milestone rewards
   * @param {string} playerId - Player ID
   * @param {Object} milestone - Milestone data
   */
  async processMilestone(playerId, milestone) {
    // Add milestone achievement
    this.addAchievement(playerId, {
      name: milestone.title,
      description: milestone.description,
      level: milestone.level,
      timestamp: Date.now()
    });
    
    // Broadcast milestone achievement
    await this.globalSync.broadcast(
      `🌟 MILESTONE ACHIEVED! ${playerId} has reached level ${milestone.level} and earned the title "${milestone.title}"! ${milestone.description} 🌟`,
      'milestone',
      { playerId, milestone }
    );
    
    this.logger.info(`🌟 Milestone achieved: ${playerId} reached level ${milestone.level}`);
  }

  /**
   * Process level rewards
   * @param {string} playerId - Player ID
   * @param {number} level - Level
   * @param {Object} rewards - Rewards data
   */
  async processLevelRewards(playerId, level, rewards) {
    // Broadcast level up
    await this.globalSync.broadcast(
      `🎉 Congratulations, ${playerId}! You've reached level ${level}! Your power grows ever stronger! 🎉`,
      'levelup',
      { playerId, level, rewards }
    );
    
    this.logger.info(`🎉 Level up: ${playerId} reached level ${level}`);
  }

  /**
   * Add achievement to player
   * @param {string} playerId - Player ID
   * @param {Object} achievement - Achievement data
   */
  addAchievement(playerId, achievement) {
    if (!this.achievements.has(playerId)) {
      this.achievements.set(playerId, []);
    }
    
    const playerAchievements = this.achievements.get(playerId);
    playerAchievements.push(achievement);
    
    // Keep only last 100 achievements
    if (playerAchievements.length > 100) {
      playerAchievements.splice(0, playerAchievements.length - 100);
    }
  }

  /**
   * Get player level
   * @param {string} playerId - Player ID
   */
  getPlayerLevel(playerId) {
    const playerData = this.playerLevels.get(playerId);
    return playerData ? playerData.level : 1;
  }

  /**
   * Get player achievements
   * @param {string} playerId - Player ID
   */
  getPlayerAchievements(playerId) {
    return this.achievements.get(playerId) || [];
  }

  /**
   * Calculate total experience for level
   * @param {number} level - Level
   */
  calculateTotalExp(level) {
    let totalExp = 0;
    for (let i = 1; i < level; i++) {
      totalExp += this.calculateExpForLevel(i);
    }
    return totalExp;
  }

  /**
   * Get level statistics
   */
  getLevelStats() {
    const stats = {
      totalPlayers: this.playerLevels.size,
      averageLevel: 0,
      maxLevel: 0,
      milestoneCounts: {},
      totalAchievements: 0
    };
    
    if (this.playerLevels.size > 0) {
      let totalLevels = 0;
      for (const playerData of this.playerLevels.values()) {
        totalLevels += playerData.level;
        stats.maxLevel = Math.max(stats.maxLevel, playerData.level);
      }
      stats.averageLevel = Math.floor(totalLevels / this.playerLevels.size);
    }
    
    // Count milestone achievements
    for (const milestone of this.milestones.values()) {
      stats.milestoneCounts[milestone.level] = 0;
    }
    
    for (const achievements of this.achievements.values()) {
      stats.totalAchievements += achievements.length;
      for (const achievement of achievements) {
        if (achievement.level && stats.milestoneCounts[achievement.level] !== undefined) {
          stats.milestoneCounts[achievement.level]++;
        }
      }
    }
    
    return stats;
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.on('levelUp', (data) => {
      this.logger.info(`Level up: ${data.playerId} -> ${data.newLevel}`);
    });
  }

  /**
   * Cleanup and close
   */
  cleanup() {
    this.logger.info('🧹 Level progression cleanup completed');
  }
}

module.exports = LevelProgression;