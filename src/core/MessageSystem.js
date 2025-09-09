/**
 * Polished Message System for IRC MultiRPG Bot
 * Handles all message formatting with proper English grammar and emoji integration
 */

const EventEmitter = require('events');
const winston = require('winston');
const _ = require('lodash');

class MessageSystem extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.messageTemplates = new Map();
    this.emojiLibrary = new Map();
    
    this.logger = winston.createLogger({
      level: this.config.get('global.logLevel', 'info'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'message-system' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.init();
  }

  /**
   * Initialize message system
   */
  init() {
    this.setupEmojiLibrary();
    this.setupMessageTemplates();
    this.setupEventHandlers();
    
    this.logger.info('💬 Polished message system initialized');
  }

  /**
   * Setup emoji library for consistent usage
   */
  setupEmojiLibrary() {
    this.emojiLibrary = new Map([
      // General
      ['success', '✅'],
      ['error', '❌'],
      ['warning', '⚠️'],
      ['info', 'ℹ️'],
      ['question', '❓'],
      ['celebration', '🎉'],
      ['fire', '🔥'],
      ['star', '⭐'],
      ['heart', '❤️'],
      ['thumbs_up', '👍'],
      ['thumbs_down', '👎'],
      
      // Game Elements
      ['sword', '⚔️'],
      ['shield', '🛡️'],
      ['magic', '🔮'],
      ['crown', '👑'],
      ['gem', '💎'],
      ['coin', '🪙'],
      ['chest', '📦'],
      ['key', '🗝️'],
      ['scroll', '📜'],
      ['potion', '🧪'],
      ['ring', '💍'],
      ['amulet', '🔮'],
      
      // Characters & Classes
      ['warrior', '⚔️'],
      ['mage', '🔮'],
      ['paladin', '🛡️'],
      ['rogue', '🗡️'],
      ['druid', '🌿'],
      ['archer', '🏹'],
      ['necromancer', '💀'],
      ['monk', '🥋'],
      
      // Monsters & Creatures
      ['dragon', '🐉'],
      ['skeleton', '💀'],
      ['ghost', '👻'],
      ['demon', '👹'],
      ['angel', '👼'],
      ['beast', '🐺'],
      ['spider', '🕷️'],
      ['snake', '🐍'],
      ['wolf', '🐺'],
      ['bear', '🐻'],
      ['eagle', '🦅'],
      ['phoenix', '🔥'],
      
      // Locations & Environments
      ['forest', '🌲'],
      ['mountain', '⛰️'],
      ['cave', '🕳️'],
      ['castle', '🏰'],
      ['tower', '🗼'],
      ['dungeon', '🏚️'],
      ['temple', '⛩️'],
      ['village', '🏘️'],
      ['city', '🏙️'],
      ['ocean', '🌊'],
      ['desert', '🏜️'],
      ['snow', '❄️'],
      
      // Actions & Events
      ['battle', '⚔️'],
      ['victory', '🏆'],
      ['defeat', '💀'],
      ['level_up', '📈'],
      ['quest', '📜'],
      ['tournament', '🏆'],
      ['guild', '🏰'],
      ['party', '🎉'],
      ['exploration', '🗺️'],
      ['discovery', '🔍'],
      ['treasure', '💰'],
      ['reward', '🎁'],
      
      // Status & Effects
      ['health', '❤️'],
      ['mana', '💙'],
      ['energy', '⚡'],
      ['poison', '☠️'],
      ['fire', '🔥'],
      ['ice', '❄️'],
      ['lightning', '⚡'],
      ['earth', '🌍'],
      ['wind', '💨'],
      ['water', '💧'],
      ['shadow', '🌑'],
      ['light', '☀️'],
      
      // Social & Communication
      ['welcome', '👋'],
      ['goodbye', '👋'],
      ['thanks', '🙏'],
      ['congratulations', '🎉'],
      ['good_luck', '🍀'],
      ['cheer', '📣'],
      ['shout', '📢'],
      ['whisper', '🤫'],
      ['laugh', '😂'],
      ['cry', '😢'],
      ['angry', '😠'],
      ['happy', '😊'],
      
      // Time & Progress
      ['clock', '🕐'],
      ['hourglass', '⏳'],
      ['timer', '⏰'],
      ['progress', '📊'],
      ['loading', '⏳'],
      ['complete', '✅'],
      ['pending', '⏳'],
      ['urgent', '🚨'],
      
      // Special & Rare
      ['legendary', '🌟'],
      ['epic', '💫'],
      ['rare', '✨'],
      ['unique', '💎'],
      ['divine', '👑'],
      ['infinite', '♾️'],
      ['eternal', '♾️'],
      ['ultimate', '💯'],
      ['perfect', '💯'],
      ['amazing', '🤩'],
      ['incredible', '🤯'],
      ['fantastic', '🎊']
    ]);
  }

  /**
   * Setup message templates for consistent formatting
   */
  setupMessageTemplates() {
    this.messageTemplates = new Map([
      // Player Registration & Welcome
      ['player_welcome', {
        template: '{emoji_welcome} Welcome to the Enhanced MultiRPG Universe, {playerName}! You can now play across all networks in our shared world! {emoji_celebration}',
        emojis: ['welcome', 'celebration']
      }],
      
      ['player_registration', {
        template: '{emoji_star} New adventurer {playerName} has joined the shared universe from {networkName}! Welcome to the epic journey! {emoji_heart}',
        emojis: ['star', 'heart']
      }],
      
      // Level Progression
      ['level_up', {
        template: '{emoji_level_up} Congratulations, {playerName}! You have reached level {newLevel}! Your power grows ever stronger! {emoji_celebration}',
        emojis: ['level_up', 'celebration']
      }],
      
      ['milestone_achieved', {
        template: '{emoji_legendary} MILESTONE ACHIEVED! {playerName} has reached level {level} and earned the title "{title}"! {description} {emoji_star}',
        emojis: ['legendary', 'star']
      }],
      
      ['class_level_up', {
        template: '{emoji_class} {playerName} has advanced their {className} class to level {classLevel}! New abilities unlocked! {emoji_magic}',
        emojis: ['class', 'magic']
      }],
      
      // Battles & Combat
      ['battle_start', {
        template: '{emoji_battle} Epic battle begins! {player1} vs {player2}! May the strongest warrior prevail! {emoji_sword}',
        emojis: ['battle', 'sword']
      }],
      
      ['battle_victory', {
        template: '{emoji_victory} VICTORY! {winner} has defeated {loser} in an epic battle! Glory and rewards await! {emoji_crown}',
        emojis: ['victory', 'crown']
      }],
      
      ['cross_network_battle', {
        template: '{emoji_battle} CROSS-NETWORK BATTLE! {player1} ({network1}) vs {player2} ({network2})! Epic clash across the universe! {emoji_fire}',
        emojis: ['battle', 'fire']
      }],
      
      ['pve_battle', {
        template: '{emoji_sword} {playerName} faces the mighty {monsterName}! A dangerous battle awaits! {emoji_dragon}',
        emojis: ['sword', 'dragon']
      }],
      
      ['pve_victory', {
        template: '{emoji_victory} {playerName} has slain the {monsterName}! Experience and gold earned! {emoji_treasure}',
        emojis: ['victory', 'treasure']
      }],
      
      // Quests & Adventures
      ['quest_available', {
        template: '{emoji_quest} New quest available: "{questName}"! {description} Rewards: {rewards} {emoji_gem}',
        emojis: ['quest', 'gem']
      }],
      
      ['quest_completed', {
        template: '{emoji_quest} Quest completed! {playerName} has finished "{questName}"! Rewards earned: {rewards} {emoji_celebration}',
        emojis: ['quest', 'celebration']
      }],
      
      ['chain_quest_start', {
        template: '{emoji_infinite} {playerName} has started the infinite chain quest "{questName}"! The epic journey begins! {emoji_star}',
        emojis: ['infinite', 'star']
      }],
      
      ['chain_quest_progress', {
        template: '{emoji_quest} {playerName} completed stage {stage} of "{questName}"! {stageName} - Rewards earned! {emoji_gem}',
        emojis: ['quest', 'gem']
      }],
      
      // Guilds & Social
      ['guild_created', {
        template: '{emoji_guild} New guild "{guildName}" has been formed by {leaderName}! Join the adventure! {emoji_crown}',
        emojis: ['guild', 'crown']
      }],
      
      ['guild_joined', {
        template: '{emoji_guild} {playerName} has joined the guild "{guildName}"! Welcome to the team! {emoji_heart}',
        emojis: ['guild', 'heart']
      }],
      
      ['guild_level_up', {
        template: '{emoji_guild} Guild "{guildName}" has reached level {level}! The guild grows stronger! {emoji_star}',
        emojis: ['guild', 'star']
      }],
      
      ['guild_war', {
        template: '{emoji_battle} GUILD WAR! {guild1} vs {guild2}! May the strongest guild prevail! {emoji_fire}',
        emojis: ['battle', 'fire']
      }],
      
      // Tournaments & Competitions
      ['tournament_start', {
        template: '{emoji_tournament} Tournament "{tournamentName}" has begun! {participants} participants ready for battle! {emoji_sword}',
        emojis: ['tournament', 'sword']
      }],
      
      ['tournament_winner', {
        template: '{emoji_crown} TOURNAMENT CHAMPION! {winner} has won "{tournamentName}"! Eternal glory achieved! {emoji_legendary}',
        emojis: ['crown', 'legendary']
      }],
      
      ['tournament_join', {
        template: '{emoji_tournament} {playerName} has joined tournament "{tournamentName}"! Good luck, warrior! {emoji_good_luck}',
        emojis: ['tournament', 'good_luck']
      }],
      
      // Rewards & Achievements
      ['reward_earned', {
        template: '{emoji_reward} {playerName} earned {amount} {currency} and {exp} experience! Plus some amazing items! {emoji_treasure}',
        emojis: ['reward', 'treasure']
      }],
      
      ['achievement_unlocked', {
        template: '{emoji_legendary} ACHIEVEMENT UNLOCKED! {playerName} has earned "{achievementName}"! {description} {emoji_star}',
        emojis: ['legendary', 'star']
      }],
      
      ['item_found', {
        template: '{emoji_treasure} {playerName} found a {rarity} {itemName}! What a fantastic discovery! {emoji_gem}',
        emojis: ['treasure', 'gem']
      }],
      
      // Global Events & Announcements
      ['global_event', {
        template: '{emoji_star} GLOBAL EVENT: {eventName}! {description} All players, join the epic adventure! {emoji_fire}',
        emojis: ['star', 'fire']
      }],
      
      ['admin_broadcast', {
        template: '{emoji_shout} ADMIN BROADCAST: {message} {emoji_info}',
        emojis: ['shout', 'info']
      }],
      
      ['system_announcement', {
        template: '{emoji_info} SYSTEM ANNOUNCEMENT: {message} {emoji_clock}',
        emojis: ['info', 'clock']
      }],
      
      // Error Messages
      ['error_generic', {
        template: '{emoji_error} Oops! Something went wrong: {message} Please try again! {emoji_question}',
        emojis: ['error', 'question']
      }],
      
      ['error_not_found', {
        template: '{emoji_error} {item} not found! Please check your input and try again! {emoji_question}',
        emojis: ['error', 'question']
      }],
      
      ['error_permission', {
        template: '{emoji_error} Access denied! You don\'t have permission to perform this action! {emoji_warning}',
        emojis: ['error', 'warning']
      }],
      
      // Help & Information
      ['help_general', {
        template: '{emoji_info} Available commands: {commands} Use !help <command> for more details! {emoji_question}',
        emojis: ['info', 'question']
      }],
      
      ['help_command', {
        template: '{emoji_info} {command}: {description} Usage: {usage} {emoji_question}',
        emojis: ['info', 'question']
      }],
      
      ['status_info', {
        template: '{emoji_info} Bot Status: {status} | Players: {players} | Networks: {networks} | Uptime: {uptime} {emoji_clock}',
        emojis: ['info', 'clock']
      }]
    ]);
  }

  /**
   * Format message with template and emojis
   * @param {string} templateKey - Template key
   * @param {Object} variables - Variables to replace
   * @param {Object} options - Formatting options
   */
  formatMessage(templateKey, variables = {}, options = {}) {
    const template = this.messageTemplates.get(templateKey);
    if (!template) {
      this.logger.warn(`Message template not found: ${templateKey}`);
      return `Message template not found: ${templateKey}`;
    }

    let message = template.template;
    
    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      message = message.replace(new RegExp(placeholder, 'g'), value || '');
    }
    
    // Replace emoji placeholders
    for (const emojiKey of template.emojis) {
      const emoji = this.getEmoji(emojiKey);
      const placeholder = `{emoji_${emojiKey}}`;
      message = message.replace(new RegExp(placeholder, 'g'), emoji);
    }
    
    // Apply formatting options
    if (options.capitalize) {
      message = this.capitalizeFirstLetter(message);
    }
    
    if (options.uppercase) {
      message = message.toUpperCase();
    }
    
    if (options.lowercase) {
      message = message.toLowerCase();
    }
    
    return message;
  }

  /**
   * Get emoji by key
   * @param {string} key - Emoji key
   */
  getEmoji(key) {
    return this.emojiLibrary.get(key) || '❓';
  }

  /**
   * Format player name with class emoji
   * @param {string} playerName - Player name
   * @param {string} className - Class name
   */
  formatPlayerName(playerName, className = null) {
    if (className) {
      const classEmoji = this.getEmoji(className.toLowerCase());
      return `${classEmoji} ${playerName}`;
    }
    return playerName;
  }

  /**
   * Format level with appropriate emoji
   * @param {number} level - Player level
   */
  formatLevel(level) {
    if (level >= 10000) return `♾️ Level ${level}`;
    if (level >= 5000) return `🌟 Level ${level}`;
    if (level >= 1000) return `💫 Level ${level}`;
    if (level >= 500) return `✨ Level ${level}`;
    if (level >= 100) return `⭐ Level ${level}`;
    return `📈 Level ${level}`;
  }

  /**
   * Format rewards with emojis
   * @param {Object} rewards - Rewards object
   */
  formatRewards(rewards) {
    const parts = [];
    
    if (rewards.exp) {
      parts.push(`${this.getEmoji('star')} ${rewards.exp} EXP`);
    }
    
    if (rewards.gold) {
      parts.push(`${this.getEmoji('coin')} ${rewards.gold} Gold`);
    }
    
    if (rewards.items && rewards.items.length > 0) {
      parts.push(`${this.getEmoji('gem')} ${rewards.items.length} Items`);
    }
    
    if (rewards.title) {
      parts.push(`${this.getEmoji('crown')} Title: ${rewards.title}`);
    }
    
    return parts.join(' | ');
  }

  /**
   * Format battle result with emojis
   * @param {Object} battleResult - Battle result
   */
  formatBattleResult(battleResult) {
    const { winner, loser, damage, critical, experience, gold } = battleResult;
    
    let message = `${this.getEmoji('victory')} ${winner} defeated ${loser}`;
    
    if (damage) {
      message += ` dealing ${damage} damage`;
    }
    
    if (critical) {
      message += ` (CRITICAL HIT!)`;
    }
    
    if (experience) {
      message += ` | ${this.getEmoji('star')} ${experience} EXP`;
    }
    
    if (gold) {
      message += ` | ${this.getEmoji('coin')} ${gold} Gold`;
    }
    
    return message;
  }

  /**
   * Format quest with emojis
   * @param {Object} quest - Quest object
   */
  formatQuest(quest) {
    const { name, description, type, difficulty, level, rewards } = quest;
    
    let message = `${this.getEmoji('quest')} ${name}`;
    
    if (description) {
      message += ` - ${description}`;
    }
    
    if (type) {
      message += ` (${type})`;
    }
    
    if (difficulty) {
      const difficultyEmoji = this.getDifficultyEmoji(difficulty);
      message += ` ${difficultyEmoji}`;
    }
    
    if (level) {
      message += ` | ${this.formatLevel(level)}`;
    }
    
    if (rewards) {
      message += ` | Rewards: ${this.formatRewards(rewards)}`;
    }
    
    return message;
  }

  /**
   * Get difficulty emoji
   * @param {string} difficulty - Difficulty level
   */
  getDifficultyEmoji(difficulty) {
    const difficultyEmojis = {
      'easy': '🟢',
      'normal': '🟡',
      'hard': '🟠',
      'epic': '🔴',
      'legendary': '🟣',
      'mythic': '⚫'
    };
    
    return difficultyEmojis[difficulty] || '❓';
  }

  /**
   * Format guild information with emojis
   * @param {Object} guild - Guild object
   */
  formatGuild(guild) {
    const { name, level, members, type, focus } = guild;
    
    let message = `${this.getEmoji('guild')} ${name}`;
    
    if (level) {
      message += ` | ${this.formatLevel(level)}`;
    }
    
    if (members) {
      message += ` | ${this.getEmoji('party')} ${members.length} members`;
    }
    
    if (type) {
      message += ` | ${type}`;
    }
    
    if (focus) {
      message += ` | ${focus}`;
    }
    
    return message;
  }

  /**
   * Format tournament information with emojis
   * @param {Object} tournament - Tournament object
   */
  formatTournament(tournament) {
    const { name, type, participants, status, prize } = tournament;
    
    let message = `${this.getEmoji('tournament')} ${name}`;
    
    if (type) {
      message += ` (${type})`;
    }
    
    if (participants) {
      message += ` | ${this.getEmoji('party')} ${participants.length} participants`;
    }
    
    if (status) {
      message += ` | ${status}`;
    }
    
    if (prize) {
      message += ` | ${this.getEmoji('treasure')} Prize: ${prize}`;
    }
    
    return message;
  }

  /**
   * Format leaderboard with emojis
   * @param {Array} leaderboard - Leaderboard data
   * @param {string} type - Leaderboard type
   */
  formatLeaderboard(leaderboard, type = 'general') {
    const typeEmojis = {
      'general': '🏆',
      'level': '📈',
      'gold': '💰',
      'battles': '⚔️',
      'wins': '👑',
      'quests': '📜',
      'guilds': '🏰'
    };
    
    const emoji = typeEmojis[type] || '🏆';
    let message = `${emoji} Leaderboard (${type}):\n`;
    
    leaderboard.forEach((entry, index) => {
      const position = index + 1;
      const positionEmoji = this.getPositionEmoji(position);
      message += `${positionEmoji} ${position}. ${entry.name || entry.playerId} - ${entry.value || entry.level || entry.score}\n`;
    });
    
    return message;
  }

  /**
   * Get position emoji
   * @param {number} position - Position number
   */
  getPositionEmoji(position) {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    if (position <= 10) return '🏅';
    return '📊';
  }

  /**
   * Capitalize first letter of string
   * @param {string} str - String to capitalize
   */
  capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Format time duration
   * @param {number} milliseconds - Duration in milliseconds
   */
  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Add any event handlers here
  }

  /**
   * Cleanup and close
   */
  cleanup() {
    this.logger.info('🧹 Message system cleanup completed');
  }
}

module.exports = MessageSystem;