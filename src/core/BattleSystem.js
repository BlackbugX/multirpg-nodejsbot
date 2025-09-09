/**
 * PvE and PvP Battle System for IRC MultiRPG Bot
 * Handles cross-network battles with advanced combat mechanics
 */

const EventEmitter = require('events');
const winston = require('winston');
const _ = require('lodash');

class BattleSystem extends EventEmitter {
  constructor(config, globalSync, matchmaking) {
    super();
    this.config = config;
    this.globalSync = globalSync;
    this.matchmaking = matchmaking;
    this.activeBattles = new Map(); // battleId -> battle data
    this.battleHistory = new Map(); // playerId -> battle history
    this.monsters = new Map(); // monsterId -> monster data
    this.battleQueue = [];
    
    this.logger = winston.createLogger({
      level: this.config.get('global.logLevel', 'info'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'battle-system' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.init();
  }

  /**
   * Initialize battle system
   */
  init() {
    this.setupMonsters();
    this.setupBattleTypes();
    this.setupEventHandlers();
    this.startBattleProcessing();
    
    this.logger.info('⚔️ Battle system initialized');
  }

  /**
   * Setup monster database for PvE battles
   */
  setupMonsters() {
    const monsterTemplates = [
      // Low level monsters (1-50)
      { name: 'Goblin', level: 5, hp: 50, attack: 15, defense: 5, exp: 25, gold: 10 },
      { name: 'Orc', level: 10, hp: 100, attack: 25, defense: 10, exp: 50, gold: 20 },
      { name: 'Skeleton', level: 15, hp: 150, attack: 35, defense: 15, exp: 75, gold: 30 },
      { name: 'Troll', level: 25, hp: 300, attack: 60, defense: 30, exp: 150, gold: 60 },
      { name: 'Ogre', level: 35, hp: 500, attack: 90, defense: 45, exp: 250, gold: 100 },
      
      // Mid level monsters (51-200)
      { name: 'Dragon', level: 75, hp: 1000, attack: 150, defense: 75, exp: 500, gold: 200 },
      { name: 'Lich', level: 100, hp: 1500, attack: 200, defense: 100, exp: 750, gold: 300 },
      { name: 'Demon', level: 150, hp: 2500, attack: 300, defense: 150, exp: 1250, gold: 500 },
      { name: 'Vampire Lord', level: 200, hp: 4000, attack: 400, defense: 200, exp: 2000, gold: 800 },
      
      // High level monsters (201-500)
      { name: 'Ancient Dragon', level: 300, hp: 6000, attack: 600, defense: 300, exp: 3000, gold: 1200 },
      { name: 'Shadow Lord', level: 400, hp: 8000, attack: 800, defense: 400, exp: 4000, gold: 1600 },
      { name: 'Void King', level: 500, hp: 10000, attack: 1000, defense: 500, exp: 5000, gold: 2000 },
      
      // Legendary monsters (501+)
      { name: 'Time Master', level: 750, hp: 15000, attack: 1500, defense: 750, exp: 7500, gold: 3000 },
      { name: 'Soul Reaper', level: 1000, hp: 20000, attack: 2000, defense: 1000, exp: 10000, gold: 4000 },
      { name: 'Divine Destroyer', level: 1500, hp: 30000, attack: 3000, defense: 1500, exp: 15000, gold: 6000 }
    ];

    monsterTemplates.forEach(monster => {
      this.monsters.set(monster.name, monster);
    });
  }

  /**
   * Setup battle types and mechanics
   */
  setupBattleTypes() {
    this.battleTypes = {
      pve: {
        name: 'Player vs Environment',
        description: 'Battle against monsters and creatures',
        maxParticipants: 1,
        rewards: ['exp', 'gold', 'items']
      },
      pvp: {
        name: 'Player vs Player',
        description: 'Battle against other players',
        maxParticipants: 2,
        rewards: ['exp', 'gold', 'ranking']
      },
      team: {
        name: 'Team Battle',
        description: 'Team-based combat',
        maxParticipants: 8,
        rewards: ['exp', 'gold', 'team_points']
      },
      tournament: {
        name: 'Tournament Battle',
        description: 'Competitive tournament matches',
        maxParticipants: 2,
        rewards: ['exp', 'gold', 'tournament_points', 'titles']
      }
    };
  }

  /**
   * Start a PvE battle
   * @param {string} playerId - Player ID
   * @param {Object} playerData - Player data
   * @param {Object} options - Battle options
   */
  async startPvEBattle(playerId, playerData, options = {}) {
    const monster = this.selectMonster(playerData.level, options);
    if (!monster) {
      throw new Error('No suitable monster found for battle');
    }

    const battle = {
      id: this.generateBattleId(),
      type: 'pve',
      participants: [playerId],
      monster: monster,
      status: 'active',
      startTime: Date.now(),
      turns: [],
      rewards: {}
    };

    this.activeBattles.set(battle.id, battle);
    
    this.logger.info(`⚔️ PvE battle started: ${playerId} vs ${monster.name}`);
    this.emit('battleStarted', battle);
    
    return battle;
  }

  /**
   * Start a PvP battle
   * @param {string} player1Id - First player ID
   * @param {string} player2Id - Second player ID
   * @param {Object} player1Data - First player data
   * @param {Object} player2Data - Second player data
   * @param {Object} options - Battle options
   */
  async startPvPBattle(player1Id, player2Id, player1Data, player2Data, options = {}) {
    const battle = {
      id: this.generateBattleId(),
      type: 'pvp',
      participants: [player1Id, player2Id],
      players: {
        [player1Id]: player1Data,
        [player2Id]: player2Data
      },
      status: 'active',
      startTime: Date.now(),
      turns: [],
      rewards: {}
    };

    this.activeBattles.set(battle.id, battle);
    
    this.logger.info(`⚔️ PvP battle started: ${player1Id} vs ${player2Id}`);
    this.emit('battleStarted', battle);
    
    return battle;
  }

  /**
   * Select appropriate monster for PvE battle
   * @param {number} playerLevel - Player level
   * @param {Object} options - Selection options
   */
  selectMonster(playerLevel, options = {}) {
    const levelRange = options.levelRange || 10;
    const minLevel = Math.max(1, playerLevel - levelRange);
    const maxLevel = playerLevel + levelRange;
    
    const suitableMonsters = Array.from(this.monsters.values()).filter(monster => 
      monster.level >= minLevel && monster.level <= maxLevel
    );
    
    if (suitableMonsters.length === 0) {
      return null;
    }
    
    // Weight selection towards monsters closer to player level
    const weightedMonsters = suitableMonsters.map(monster => ({
      ...monster,
      weight: 100 - Math.abs(monster.level - playerLevel)
    }));
    
    return this.weightedRandomSelect(weightedMonsters);
  }

  /**
   * Weighted random selection
   * @param {Array} items - Items with weight property
   */
  weightedRandomSelect(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const item of items) {
      random -= item.weight;
      if (random <= 0) {
        return item;
      }
    }
    
    return items[items.length - 1];
  }

  /**
   * Process battle turn
   * @param {string} battleId - Battle ID
   * @param {string} attackerId - Attacker ID
   * @param {Object} action - Action data
   */
  async processTurn(battleId, attackerId, action) {
    const battle = this.activeBattles.get(battleId);
    if (!battle) {
      throw new Error('Battle not found');
    }

    const turn = {
      attacker: attackerId,
      action: action,
      timestamp: Date.now(),
      damage: 0,
      result: 'miss'
    };

    if (battle.type === 'pve') {
      await this.processPvETurn(battle, turn);
    } else if (battle.type === 'pvp') {
      await this.processPvPTurn(battle, turn);
    }

    battle.turns.push(turn);
    
    // Check if battle is over
    if (this.isBattleOver(battle)) {
      await this.endBattle(battle);
    }
    
    this.emit('turnProcessed', { battle, turn });
  }

  /**
   * Process PvE turn
   * @param {Object} battle - Battle data
   * @param {Object} turn - Turn data
   */
  async processPvETurn(battle, turn) {
    const playerId = battle.participants[0];
    const monster = battle.monster;
    
    if (turn.action.type === 'attack') {
      const damage = this.calculateDamage(playerId, monster, turn.action);
      turn.damage = damage;
      turn.result = 'hit';
      
      // Apply damage to monster
      monster.hp = Math.max(0, monster.hp - damage);
      
      // Monster counter-attack
      if (monster.hp > 0) {
        const monsterDamage = this.calculateMonsterDamage(monster, playerId);
        turn.monsterDamage = monsterDamage;
        turn.monsterResult = 'hit';
      }
    }
  }

  /**
   * Process PvP turn
   * @param {Object} battle - Battle data
   * @param {Object} turn - Turn data
   */
  async processPvPTurn(battle, turn) {
    const attackerId = turn.attacker;
    const defenderId = battle.participants.find(id => id !== attackerId);
    
    if (turn.action.type === 'attack') {
      const damage = this.calculatePvPDamage(attackerId, defenderId, turn.action);
      turn.damage = damage;
      turn.result = 'hit';
      turn.defender = defenderId;
      
      // Apply damage to defender
      if (battle.players[defenderId]) {
        battle.players[defenderId].hp = Math.max(0, battle.players[defenderId].hp - damage);
      }
    }
  }

  /**
   * Calculate damage for PvE battle
   * @param {string} playerId - Player ID
   * @param {Object} monster - Monster data
   * @param {Object} action - Action data
   */
  calculateDamage(playerId, monster, action) {
    const baseDamage = action.damage || 50;
    const levelBonus = this.getPlayerLevel(playerId) * 2;
    const criticalChance = 0.1; // 10% critical hit chance
    const isCritical = Math.random() < criticalChance;
    
    let damage = baseDamage + levelBonus;
    
    if (isCritical) {
      damage *= 2;
      turn.critical = true;
    }
    
    // Apply monster defense
    damage = Math.max(1, damage - monster.defense);
    
    return Math.floor(damage);
  }

  /**
   * Calculate monster damage
   * @param {Object} monster - Monster data
   * @param {string} playerId - Player ID
   */
  calculateMonsterDamage(monster, playerId) {
    const baseDamage = monster.attack;
    const playerLevel = this.getPlayerLevel(playerId);
    const defense = playerLevel * 1.5; // Simple defense calculation
    
    let damage = baseDamage - defense;
    damage = Math.max(1, damage);
    
    return Math.floor(damage);
  }

  /**
   * Calculate damage for PvP battle
   * @param {string} attackerId - Attacker ID
   * @param {string} defenderId - Defender ID
   * @param {Object} action - Action data
   */
  calculatePvPDamage(attackerId, defenderId, action) {
    const attackerLevel = this.getPlayerLevel(attackerId);
    const defenderLevel = this.getPlayerLevel(defenderId);
    
    const baseDamage = action.damage || 50;
    const levelBonus = attackerLevel * 2;
    const levelPenalty = defenderLevel * 1.5;
    
    let damage = baseDamage + levelBonus - levelPenalty;
    damage = Math.max(1, damage);
    
    return Math.floor(damage);
  }

  /**
   * Check if battle is over
   * @param {Object} battle - Battle data
   */
  isBattleOver(battle) {
    if (battle.type === 'pve') {
      return battle.monster.hp <= 0;
    } else if (battle.type === 'pvp') {
      const players = battle.players;
      return Object.values(players).some(player => player.hp <= 0);
    }
    
    return false;
  }

  /**
   * End battle and distribute rewards
   * @param {Object} battle - Battle data
   */
  async endBattle(battle) {
    battle.status = 'completed';
    battle.endTime = Date.now();
    
    let winner = null;
    let rewards = {};
    
    if (battle.type === 'pve') {
      if (battle.monster.hp <= 0) {
        winner = battle.participants[0];
        rewards = this.calculatePvERewards(battle);
      }
    } else if (battle.type === 'pvp') {
      const players = battle.players;
      winner = Object.keys(players).find(playerId => players[playerId].hp > 0);
      rewards = this.calculatePvPRewards(battle, winner);
    }
    
    battle.winner = winner;
    battle.rewards = rewards;
    
    // Distribute rewards
    if (winner && rewards) {
      await this.distributeRewards(winner, rewards);
    }
    
    // Record battle in history
    this.recordBattle(battle);
    
    // Remove from active battles
    this.activeBattles.delete(battle.id);
    
    this.logger.info(`⚔️ Battle ended: ${battle.id}, Winner: ${winner}`);
    this.emit('battleEnded', battle);
    
    return battle;
  }

  /**
   * Calculate PvE rewards
   * @param {Object} battle - Battle data
   */
  calculatePvERewards(battle) {
    const monster = battle.monster;
    const playerLevel = this.getPlayerLevel(battle.participants[0]);
    
    const exp = Math.floor(monster.exp * (1 + playerLevel * 0.1));
    const gold = Math.floor(monster.gold * (1 + playerLevel * 0.05));
    
    return {
      exp,
      gold,
      items: this.generateBattleItems(monster.level)
    };
  }

  /**
   * Calculate PvP rewards
   * @param {Object} battle - Battle data
   * @param {string} winner - Winner ID
   */
  calculatePvPRewards(battle, winner) {
    const winnerLevel = this.getPlayerLevel(winner);
    const loserLevel = this.getPlayerLevel(battle.participants.find(id => id !== winner));
    
    const exp = Math.floor((winnerLevel + loserLevel) * 10);
    const gold = Math.floor((winnerLevel + loserLevel) * 5);
    
    return {
      exp,
      gold,
      ranking: this.calculateRankingChange(winner, battle.participants.find(id => id !== winner))
    };
  }

  /**
   * Calculate ranking change for PvP
   * @param {string} winner - Winner ID
   * @param {string} loser - Loser ID
   */
  calculateRankingChange(winner, loser) {
    // Simple ranking change calculation
    return {
      winner: 10,
      loser: -5
    };
  }

  /**
   * Generate battle items
   * @param {number} level - Monster level
   */
  generateBattleItems(level) {
    const items = [];
    const itemChance = 0.3; // 30% chance for item drop
    
    if (Math.random() < itemChance) {
      items.push({
        name: this.getRandomItem(level),
        rarity: this.getRandomRarity(level),
        value: level * 10
      });
    }
    
    return items;
  }

  /**
   * Get random item for level
   * @param {number} level - Level
   */
  getRandomItem(level) {
    const items = [
      'Health Potion', 'Mana Potion', 'Strength Potion',
      'Defense Potion', 'Speed Potion', 'Luck Potion',
      'Magic Gem', 'Ancient Rune', 'Mystic Crystal'
    ];
    
    return _.sample(items);
  }

  /**
   * Get random rarity for level
   * @param {number} level - Level
   */
  getRandomRarity(level) {
    const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
    const maxIndex = Math.min(Math.floor(level / 100), rarities.length - 1);
    return rarities[Math.floor(Math.random() * (maxIndex + 1))];
  }

  /**
   * Distribute rewards to player
   * @param {string} playerId - Player ID
   * @param {Object} rewards - Rewards data
   */
  async distributeRewards(playerId, rewards) {
    // Update player state with rewards
    await this.globalSync.updatePlayerState(playerId, {
      exp: rewards.exp || 0,
      gold: rewards.gold || 0,
      items: rewards.items || []
    }, 'battle-system');
    
    // Broadcast rewards
    await this.globalSync.broadcast(
      `🎁 ${playerId} earned ${rewards.exp} EXP and ${rewards.gold} gold from battle! ${rewards.items.length > 0 ? 'Plus some items!' : ''} 🎁`,
      'battle',
      { playerId, rewards }
    );
  }

  /**
   * Record battle in history
   * @param {Object} battle - Battle data
   */
  recordBattle(battle) {
    for (const participantId of battle.participants) {
      if (!this.battleHistory.has(participantId)) {
        this.battleHistory.set(participantId, []);
      }
      
      const history = this.battleHistory.get(participantId);
      history.push({
        battleId: battle.id,
        type: battle.type,
        result: participantId === battle.winner ? 'win' : 'loss',
        timestamp: battle.endTime,
        rewards: battle.rewards
      });
      
      // Keep only last 100 battles
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }
    }
  }

  /**
   * Get player level (placeholder - should integrate with level system)
   * @param {string} playerId - Player ID
   */
  getPlayerLevel(playerId) {
    // This should integrate with the actual level system
    return 1; // Placeholder
  }

  /**
   * Start battle processing loop
   */
  startBattleProcessing() {
    setInterval(() => {
      this.processBattleQueue();
    }, 1000); // Every second
  }

  /**
   * Process battle queue
   */
  processBattleQueue() {
    // Process any queued battles
    while (this.battleQueue.length > 0) {
      const battleRequest = this.battleQueue.shift();
      this.processBattleRequest(battleRequest);
    }
  }

  /**
   * Process battle request
   * @param {Object} request - Battle request
   */
  async processBattleRequest(request) {
    try {
      if (request.type === 'pve') {
        await this.startPvEBattle(request.playerId, request.playerData, request.options);
      } else if (request.type === 'pvp') {
        await this.startPvPBattle(
          request.player1Id, 
          request.player2Id, 
          request.player1Data, 
          request.player2Data, 
          request.options
        );
      }
    } catch (error) {
      this.logger.error('Failed to process battle request:', error);
    }
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.on('battleStarted', (battle) => {
      this.logger.info(`Battle started: ${battle.id}`);
    });

    this.on('battleEnded', (battle) => {
      this.logger.info(`Battle ended: ${battle.id}, Winner: ${battle.winner}`);
    });

    this.on('turnProcessed', (data) => {
      this.logger.debug(`Turn processed in battle: ${data.battle.id}`);
    });
  }

  /**
   * Generate unique battle ID
   */
  generateBattleId() {
    return `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get battle statistics
   */
  getBattleStats() {
    return {
      activeBattles: this.activeBattles.size,
      totalBattles: Array.from(this.battleHistory.values())
        .reduce((total, history) => total + history.length, 0),
      queuedBattles: this.battleQueue.length,
      monsterCount: this.monsters.size
    };
  }

  /**
   * Cleanup and close
   */
  cleanup() {
    this.logger.info('🧹 Battle system cleanup completed');
  }
}

module.exports = BattleSystem;