/**
 * Infinite Quest System for IRC MultiRPG Bot
 * Generates dynamic quests with scaling rewards and chain events
 */

const EventEmitter = require('events');
const winston = require('winston');
const _ = require('lodash');

class QuestSystem extends EventEmitter {
  constructor(config, globalSync) {
    super();
    this.config = config;
    this.globalSync = globalSync;
    this.activeQuests = new Map();
    this.completedQuests = new Map();
    this.questTemplates = [];
    this.playerQuests = new Map(); // playerId -> active quests
    this.questRewards = new Map(); // questId -> rewards
    
    this.logger = winston.createLogger({
      level: this.config.get('global.logLevel', 'info'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'quest-system' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.init();
  }

  /**
   * Initialize quest system
   */
  init() {
    this.setupQuestTemplates();
    this.startQuestGeneration();
    this.setupEventHandlers();
    
    this.logger.info('📜 Infinite quest system initialized');
  }

  /**
   * Setup quest templates for infinite generation
   */
  setupQuestTemplates() {
    this.questTemplates = [
      // Combat Quests
      {
        type: 'combat',
        templates: [
          'Defeat {count} {monster} in the {location}',
          'Slay the legendary {monster} of {location}',
          'Clear the {location} of {count} {monster}',
          'Face the {monster} champion in {location}',
          'Eliminate {count} {monster} from {location}'
        ],
        monsters: [
          'Shadow Beast', 'Dragon', 'Lich', 'Demon', 'Goblin King',
          'Troll', 'Orc Warlord', 'Undead Knight', 'Fire Elemental',
          'Ice Giant', 'Storm Dragon', 'Dark Wizard', 'Vampire Lord',
          'Werewolf Alpha', 'Skeleton King', 'Ghost Queen', 'Spider Queen',
          'Minotaur', 'Cyclops', 'Harpy', 'Basilisk', 'Chimera',
          'Griffin', 'Phoenix', 'Kraken', 'Leviathan', 'Behemoth'
        ],
        locations: [
          'Dark Forest', 'Crystal Caves', 'Frozen Peaks', 'Volcanic Wasteland',
          'Shadow Realm', 'Ancient Ruins', 'Mystic Valley', 'Thunder Plains',
          'Desert of Souls', 'Ocean Depths', 'Sky Citadel', 'Underworld',
          'Celestial Realm', 'Void Dimension', 'Time Rift', 'Dreamscape',
          'Nightmare Realm', 'Paradise Gardens', 'Infernal Abyss', 'Heavenly Gates'
        ]
      },
      
      // Collection Quests
      {
        type: 'collection',
        templates: [
          'Gather {count} {item} from {location}',
          'Collect {count} {item} for the {npc}',
          'Find {count} {item} scattered across {location}',
          'Retrieve {count} {item} from the {location}',
          'Gather {count} {item} to complete the ritual'
        ],
        items: [
          'Crystal Shards', 'Magic Herbs', 'Ancient Coins', 'Dragon Scales',
          'Phoenix Feathers', 'Unicorn Horns', 'Mermaid Pearls', 'Demon Hearts',
          'Angel Wings', 'Titan Bones', 'Elven Gems', 'Dwarven Ore',
          'Mystic Scrolls', 'Sacred Relics', 'Cursed Artifacts', 'Blessed Tokens',
          'Elemental Cores', 'Soul Fragments', 'Time Crystals', 'Void Essence'
        ],
        npcs: [
          'Wise Sage', 'Mystic Merchant', 'Ancient Wizard', 'Celestial Being',
          'Guardian Spirit', 'Oracle', 'Alchemist', 'Enchanter',
          'Temple Priest', 'Village Elder', 'Royal Advisor', 'Mystic Scholar'
        ]
      },
      
      // Exploration Quests
      {
        type: 'exploration',
        templates: [
          'Explore the {location} and discover its secrets',
          'Journey to {location} and map the area',
          'Investigate the mysterious {location}',
          'Venture into the {location} and return safely',
          'Discover the hidden {location}'
        ]
      },
      
      // Social Quests
      {
        type: 'social',
        templates: [
          'Help {npc} with their problem in {location}',
          'Deliver a message to {npc} in {location}',
          'Escort {npc} safely to {location}',
          'Negotiate peace between {faction1} and {faction2}',
          'Organize a festival in {location}'
        ],
        factions: [
          'Elven Council', 'Dwarven Clans', 'Human Kingdoms', 'Orc Tribes',
          'Dragon Riders', 'Shadow Assassins', 'Light Guardians', 'Mystic Order',
          'Pirate Guild', 'Merchant Alliance', 'Scholar Society', 'Warrior Brotherhood'
        ]
      },
      
      // Chain Quests
      {
        type: 'chain',
        templates: [
          'Complete the {quest_series} questline',
          'Unlock the secrets of the {artifact}',
          'Restore the {location} to its former glory',
          'Defeat the {boss} and claim the {treasure}',
          'Master the {skill} and prove your worth'
        ],
        quest_series: [
          'Ancient Prophecy', 'Dragon Slayer', 'Shadow Walker', 'Crystal Guardian',
          'Time Keeper', 'Void Walker', 'Soul Reaper', 'Light Bringer'
        ],
        artifacts: [
          'Crystal of Power', 'Sword of Legends', 'Staff of Wisdom', 'Crown of Kings',
          'Amulet of Souls', 'Ring of Time', 'Orb of Elements', 'Tome of Knowledge'
        ],
        bosses: [
          'Shadow Lord', 'Dragon Emperor', 'Void King', 'Time Master',
          'Soul Reaper', 'Light Destroyer', 'Chaos Bringer', 'Order Breaker'
        ],
        treasures: [
          'Eternal Crown', 'Infinite Sword', 'Omnipotent Staff', 'Universal Amulet',
          'Timeless Ring', 'Elemental Orb', 'Knowledge Tome', 'Power Crystal'
        ],
        skills: [
          'Dragon Slaying', 'Shadow Walking', 'Time Manipulation', 'Soul Binding',
          'Light Mastery', 'Void Control', 'Elemental Fusion', 'Knowledge Absorption'
        ]
      }
    ];
  }

  /**
   * Generate a new quest
   * @param {Object} options - Quest generation options
   */
  generateQuest(options = {}) {
    const questType = options.type || this.getRandomQuestType();
    const template = this.getQuestTemplate(questType);
    const quest = this.buildQuest(template, options);
    
    quest.id = this.generateQuestId();
    quest.timestamp = Date.now();
    quest.status = 'active';
    quest.participants = new Set();
    quest.rewards = this.calculateRewards(quest);
    
    this.activeQuests.set(quest.id, quest);
    
    this.logger.info(`📜 Generated quest: ${quest.name}`);
    this.emit('questGenerated', quest);
    
    return quest;
  }

  /**
   * Get random quest type based on weights
   */
  getRandomQuestType() {
    const weights = {
      combat: 0.4,
      collection: 0.2,
      exploration: 0.15,
      social: 0.15,
      chain: 0.1
    };
    
    const random = Math.random();
    let cumulative = 0;
    
    for (const [type, weight] of Object.entries(weights)) {
      cumulative += weight;
      if (random <= cumulative) {
        return type;
      }
    }
    
    return 'combat';
  }

  /**
   * Get quest template for type
   * @param {string} type - Quest type
   */
  getQuestTemplate(type) {
    return this.questTemplates.find(template => template.type === type);
  }

  /**
   * Build quest from template
   * @param {Object} template - Quest template
   * @param {Object} options - Generation options
   */
  buildQuest(template, options) {
    const questTemplate = _.sample(template.templates);
    let questName = questTemplate;
    
    // Replace placeholders
    questName = questName.replace('{count}', this.getRandomCount());
    questName = questName.replace('{monster}', _.sample(template.monsters || []));
    questName = questName.replace('{location}', _.sample(template.locations || []));
    questName = questName.replace('{item}', _.sample(template.items || []));
    questName = questName.replace('{npc}', _.sample(template.npcs || []));
    questName = questName.replace('{faction1}', _.sample(template.factions || []));
    questName = questName.replace('{faction2}', _.sample(template.factions || []));
    questName = questName.replace('{quest_series}', _.sample(template.quest_series || []));
    questName = questName.replace('{artifact}', _.sample(template.artifacts || []));
    questName = questName.replace('{boss}', _.sample(template.bosses || []));
    questName = questName.replace('{treasure}', _.sample(template.treasures || []));
    questName = questName.replace('{skill}', _.sample(template.skills || []));
    
    return {
      name: questName,
      type: template.type,
      description: this.generateDescription(template.type, questName),
      difficulty: this.calculateDifficulty(options),
      level: options.level || this.getRandomLevel(),
      timeLimit: this.calculateTimeLimit(template.type),
      requirements: this.generateRequirements(template.type)
    };
  }

  /**
   * Generate quest description
   * @param {string} type - Quest type
   * @param {string} name - Quest name
   */
  generateDescription(type, name) {
    const descriptions = {
      combat: `⚔️ A dangerous quest awaits! ${name}. Prepare for battle and prove your might!`,
      collection: `📦 A gathering quest! ${name}. Search carefully and collect what you need!`,
      exploration: `🗺️ An adventure calls! ${name}. Discover new lands and uncover secrets!`,
      social: `🤝 A diplomatic mission! ${name}. Use your charm and wisdom to succeed!`,
      chain: `🔗 A legendary questline! ${name}. This is just the beginning of an epic journey!`
    };
    
    return descriptions[type] || `📜 A new quest: ${name}. Good luck, adventurer!`;
  }

  /**
   * Calculate quest difficulty
   * @param {Object} options - Generation options
   */
  calculateDifficulty(options) {
    const baseDifficulty = options.difficulty || Math.floor(Math.random() * 5) + 1;
    const levelModifier = Math.floor((options.level || 1) / 10);
    return Math.min(10, baseDifficulty + levelModifier);
  }

  /**
   * Get random level for quest
   */
  getRandomLevel() {
    const maxLevel = this.config.get('gameplay.maxLevel', 9999);
    return Math.floor(Math.random() * Math.min(100, maxLevel)) + 1;
  }

  /**
   * Calculate time limit for quest
   * @param {string} type - Quest type
   */
  calculateTimeLimit(type) {
    const baseTime = {
      combat: 3600000,      // 1 hour
      collection: 7200000,  // 2 hours
      exploration: 10800000, // 3 hours
      social: 5400000,      // 1.5 hours
      chain: 86400000       // 24 hours
    };
    
    return baseTime[type] || 3600000;
  }

  /**
   * Generate quest requirements
   * @param {string} type - Quest type
   */
  generateRequirements(type) {
    const requirements = {
      combat: ['Weapon', 'Armor', 'Health Potions'],
      collection: ['Backpack', 'Detection Skills', 'Patience'],
      exploration: ['Map', 'Compass', 'Survival Gear'],
      social: ['Charisma', 'Diplomacy', 'Knowledge'],
      chain: ['Previous Quest Completion', 'High Level', 'Special Items']
    };
    
    return requirements[type] || ['Basic Equipment'];
  }

  /**
   * Calculate quest rewards
   * @param {Object} quest - Quest data
   */
  calculateRewards(quest) {
    const baseReward = 100;
    const levelMultiplier = quest.level * 10;
    const difficultyMultiplier = quest.difficulty * 5;
    const typeMultiplier = this.getTypeMultiplier(quest.type);
    
    const gold = Math.floor((baseReward + levelMultiplier + difficultyMultiplier) * typeMultiplier);
    const exp = Math.floor(gold * 1.5);
    
    return {
      gold,
      exp,
      items: this.generateRewardItems(quest),
      special: this.generateSpecialRewards(quest)
    };
  }

  /**
   * Get type multiplier for rewards
   * @param {string} type - Quest type
   */
  getTypeMultiplier(type) {
    const multipliers = {
      combat: 1.5,
      collection: 1.0,
      exploration: 1.2,
      social: 0.8,
      chain: 3.0
    };
    
    return multipliers[type] || 1.0;
  }

  /**
   * Generate reward items
   * @param {Object} quest - Quest data
   */
  generateRewardItems(quest) {
    const items = [];
    const itemChance = 0.3 + (quest.difficulty * 0.1);
    
    if (Math.random() < itemChance) {
      items.push({
        name: this.getRandomItem(quest.type),
        rarity: this.getRandomRarity(quest.difficulty),
        value: Math.floor(quest.rewards.gold * 0.1)
      });
    }
    
    return items;
  }

  /**
   * Generate special rewards
   * @param {Object} quest - Quest data
   */
  generateSpecialRewards(quest) {
    const special = [];
    
    if (quest.type === 'chain' && quest.difficulty >= 8) {
      special.push({
        type: 'title',
        name: this.getRandomTitle(),
        description: 'A prestigious title earned through legendary deeds'
      });
    }
    
    if (quest.difficulty >= 9) {
      special.push({
        type: 'achievement',
        name: this.getRandomAchievement(),
        description: 'A rare achievement for completing difficult quests'
      });
    }
    
    return special;
  }

  /**
   * Get random item for quest type
   * @param {string} type - Quest type
   */
  getRandomItem(type) {
    const items = {
      combat: ['Sword', 'Shield', 'Armor', 'Helmet', 'Gauntlets'],
      collection: ['Bag', 'Pouch', 'Container', 'Chest', 'Vault'],
      exploration: ['Map', 'Compass', 'Telescope', 'Rope', 'Torch'],
      social: ['Diplomat Badge', 'Medal', 'Certificate', 'Scroll', 'Document'],
      chain: ['Legendary Weapon', 'Mystic Artifact', 'Ancient Relic', 'Divine Item', 'Epic Treasure']
    };
    
    const typeItems = items[type] || items.combat;
    return _.sample(typeItems);
  }

  /**
   * Get random rarity based on difficulty
   * @param {number} difficulty - Quest difficulty
   */
  getRandomRarity(difficulty) {
    const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
    const maxIndex = Math.min(difficulty - 1, rarities.length - 1);
    return rarities[Math.floor(Math.random() * (maxIndex + 1))];
  }

  /**
   * Get random title
   */
  getRandomTitle() {
    const titles = [
      'Dragon Slayer', 'Shadow Walker', 'Light Bringer', 'Void Master',
      'Time Keeper', 'Soul Reaper', 'Crystal Guardian', 'Storm Lord',
      'Ice Queen', 'Fire King', 'Earth Shaker', 'Wind Rider',
      'Mystic Sage', 'Ancient One', 'Eternal Champion', 'Legendary Hero'
    ];
    
    return _.sample(titles);
  }

  /**
   * Get random achievement
   */
  getRandomAchievement() {
    const achievements = [
      'Quest Master', 'Adventure Seeker', 'Legendary Explorer', 'Epic Hero',
      'Mystic Wanderer', 'Ancient Scholar', 'Eternal Warrior', 'Divine Champion',
      'Void Walker', 'Time Traveler', 'Soul Binder', 'Crystal Keeper'
    ];
    
    return _.sample(achievements);
  }

  /**
   * Get random count for quests
   */
  getRandomCount() {
    const counts = [1, 2, 3, 5, 10, 15, 20, 25, 50, 100];
    return _.sample(counts);
  }

  /**
   * Start quest generation loop
   */
  startQuestGeneration() {
    // Generate initial quests
    for (let i = 0; i < 5; i++) {
      this.generateQuest();
    }
    
    // Generate new quests periodically
    setInterval(() => {
      if (this.activeQuests.size < 10) {
        this.generateQuest();
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.on('questGenerated', (quest) => {
      this.logger.info(`📜 Quest generated: ${quest.name}`);
    });
  }

  /**
   * Generate unique quest ID
   */
  generateQuestId() {
    return `quest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get active quests
   */
  getActiveQuests() {
    return Array.from(this.activeQuests.values());
  }

  /**
   * Get quest by ID
   * @param {string} questId - Quest ID
   */
  getQuest(questId) {
    return this.activeQuests.get(questId);
  }

  /**
   * Complete quest
   * @param {string} questId - Quest ID
   * @param {string} playerId - Player ID
   */
  completeQuest(questId, playerId) {
    const quest = this.activeQuests.get(questId);
    if (!quest) return null;
    
    quest.status = 'completed';
    quest.completedBy = playerId;
    quest.completedAt = Date.now();
    
    this.activeQuests.delete(questId);
    this.completedQuests.set(questId, quest);
    
    this.logger.info(`✅ Quest completed: ${quest.name} by ${playerId}`);
    this.emit('questCompleted', quest);
    
    return quest;
  }

  /**
   * Cleanup and close
   */
  cleanup() {
    this.logger.info('🧹 Quest system cleanup completed');
  }
}

module.exports = QuestSystem;