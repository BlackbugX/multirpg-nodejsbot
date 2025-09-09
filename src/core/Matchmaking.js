/**
 * Advanced Matchmaking System
 * Handles player matching with level brackets, ranking, and cross-network support
 */

const EventEmitter = require('events');
const winston = require('winston');
const _ = require('lodash');

class Matchmaking extends EventEmitter {
  constructor(config, globalSync) {
    super();
    this.config = config;
    this.globalSync = globalSync;
    this.matchQueue = new Map(); // playerId -> matchRequest
    this.rankings = new Map(); // playerId -> ranking data
    this.levelBrackets = new Map(); // bracketId -> players
    this.matchHistory = new Map(); // playerId -> recent matches
    
    this.logger = winston.createLogger({
      level: this.config.get('global.logLevel', 'info'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'matchmaking' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.init();
  }

  /**
   * Initialize matchmaking system
   */
  init() {
    this.setupLevelBrackets();
    this.startMatchmakingLoop();
    this.setupEventHandlers();
    
    this.logger.info('🎯 Advanced matchmaking system initialized');
  }

  /**
   * Setup level brackets based on configuration
   */
  setupLevelBrackets() {
    const bracketSize = this.config.get('gameplay.matchmaking.levelBracketSize', 10);
    const maxLevel = this.config.get('gameplay.maxLevel', 9999);
    
    for (let level = 1; level <= maxLevel; level += bracketSize) {
      const bracketId = `bracket_${level}_${Math.min(level + bracketSize - 1, maxLevel)}`;
      this.levelBrackets.set(bracketId, {
        minLevel: level,
        maxLevel: Math.min(level + bracketSize - 1, maxLevel),
        players: new Set()
      });
    }
  }

  /**
   * Request a match for a player
   * @param {Object} player - Player data
   * @param {Object} options - Matchmaking options
   */
  async requestMatch(player, options = {}) {
    const matchRequest = {
      id: this.generateMatchId(),
      player,
      timestamp: Date.now(),
      criteria: {
        levelBracket: options.levelBracket || this.getLevelBracket(player.level),
        minLevel: options.minLevel || player.level - 5,
        maxLevel: options.maxLevel || player.level + 5,
        preferCrossNetwork: options.preferCrossNetwork !== false,
        maxWaitTime: options.maxWaitTime || this.config.get('gameplay.matchmaking.maxMatchmakingTime', 300000),
        rankingRange: options.rankingRange || 100
      },
      status: 'queued'
    };

    this.matchQueue.set(player.globalId, matchRequest);
    this.addPlayerToBracket(player);
    
    this.logger.info(`🎯 Match requested for ${player.name} (Level ${player.level})`);
    this.emit('matchRequested', matchRequest);
    
    return matchRequest;
  }

  /**
   * Get level bracket for a given level
   * @param {number} level - Player level
   */
  getLevelBracket(level) {
    const bracketSize = this.config.get('gameplay.matchmaking.levelBracketSize', 10);
    const minLevel = Math.floor((level - 1) / bracketSize) * bracketSize + 1;
    const maxLevel = Math.min(minLevel + bracketSize - 1, this.config.get('gameplay.maxLevel', 9999));
    return `bracket_${minLevel}_${maxLevel}`;
  }

  /**
   * Add player to appropriate level bracket
   * @param {Object} player - Player data
   */
  addPlayerToBracket(player) {
    const bracketId = this.getLevelBracket(player.level);
    const bracket = this.levelBrackets.get(bracketId);
    
    if (bracket) {
      bracket.players.add(player.globalId);
    }
  }

  /**
   * Remove player from level bracket
   * @param {string} playerId - Player global ID
   */
  removePlayerFromBracket(playerId) {
    for (const [bracketId, bracket] of this.levelBrackets) {
      bracket.players.delete(playerId);
    }
  }

  /**
   * Find best match for a player
   * @param {Object} matchRequest - Match request
   */
  async findMatch(matchRequest) {
    const { player, criteria } = matchRequest;
    const potentialOpponents = [];

    // Get players from same level bracket
    const bracketId = criteria.levelBracket;
    const bracket = this.levelBrackets.get(bracketId);
    
    if (bracket) {
      for (const opponentId of bracket.players) {
        if (opponentId === player.globalId) continue;
        
        const opponent = this.globalSync.getPlayerState(
          opponentId.split(':')[1], 
          opponentId.split(':')[0]
        );
        
        if (opponent && this.isValidOpponent(player, opponent, criteria)) {
          potentialOpponents.push(opponent);
        }
      }
    }

    // If no opponents in same bracket, expand search
    if (potentialOpponents.length === 0) {
      const allPlayers = this.globalSync.getAllPlayers({
        minLevel: criteria.minLevel,
        maxLevel: criteria.maxLevel
      });
      
      potentialOpponents.push(...allPlayers.filter(opponent => 
        opponent.globalId !== player.globalId && 
        this.isValidOpponent(player, opponent, criteria)
      ));
    }

    if (potentialOpponents.length === 0) {
      return null;
    }

    // Score and rank potential opponents
    const scoredOpponents = potentialOpponents.map(opponent => ({
      player: opponent,
      score: this.calculateMatchScore(player, opponent, criteria)
    }));

    // Sort by score (higher is better)
    scoredOpponents.sort((a, b) => b.score - a.score);

    return scoredOpponents[0].player;
  }

  /**
   * Check if opponent is valid for match
   * @param {Object} player - Requesting player
   * @param {Object} opponent - Potential opponent
   * @param {Object} criteria - Match criteria
   */
  isValidOpponent(player, opponent, criteria) {
    // Don't match with same player
    if (opponent.globalId === player.globalId) return false;
    
    // Check level range
    if (opponent.level < criteria.minLevel || opponent.level > criteria.maxLevel) {
      return false;
    }

    // Check if recently matched
    const recentMatches = this.matchHistory.get(player.globalId) || [];
    const recentOpponents = recentMatches.slice(-5).map(match => match.opponentId);
    if (recentOpponents.includes(opponent.globalId)) {
      return false;
    }

    // Check ranking range if enabled
    if (this.config.get('gameplay.matchmaking.enableRanking', true)) {
      const playerRank = this.getPlayerRank(player.globalId);
      const opponentRank = this.getPlayerRank(opponent.globalId);
      
      if (Math.abs(playerRank - opponentRank) > criteria.rankingRange) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate match score for opponent selection
   * @param {Object} player - Requesting player
   * @param {Object} opponent - Potential opponent
   * @param {Object} criteria - Match criteria
   */
  calculateMatchScore(player, opponent, criteria) {
    let score = 0;

    // Level proximity bonus (closer levels = higher score)
    const levelDiff = Math.abs(player.level - opponent.level);
    score += Math.max(0, 100 - levelDiff * 2);

    // Cross-network bonus
    if (criteria.preferCrossNetwork && player.networkId !== opponent.networkId) {
      score += 50;
    }

    // Ranking proximity bonus
    if (this.config.get('gameplay.matchmaking.enableRanking', true)) {
      const playerRank = this.getPlayerRank(player.globalId);
      const opponentRank = this.getPlayerRank(opponent.globalId);
      const rankDiff = Math.abs(playerRank - opponentRank);
      score += Math.max(0, 50 - rankDiff);
    }

    // Activity bonus (more active players get slight preference)
    const playerActivity = this.getPlayerActivity(player.globalId);
    const opponentActivity = this.getPlayerActivity(opponent.globalId);
    score += (playerActivity + opponentActivity) * 10;

    // Random factor to prevent always matching same players
    score += Math.random() * 20;

    return score;
  }

  /**
   * Get player ranking
   * @param {string} playerId - Player global ID
   */
  getPlayerRank(playerId) {
    const ranking = this.rankings.get(playerId);
    return ranking ? ranking.rank : 1000; // Default rank for new players
  }

  /**
   * Get player activity score
   * @param {string} playerId - Player global ID
   */
  getPlayerActivity(playerId) {
    const recentMatches = this.matchHistory.get(playerId) || [];
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    return recentMatches.filter(match => match.timestamp > oneDayAgo).length;
  }

  /**
   * Process matchmaking queue
   */
  async processMatchmaking() {
    const now = Date.now();
    const maxWaitTime = this.config.get('gameplay.matchmaking.maxMatchmakingTime', 300000);
    
    for (const [playerId, matchRequest] of this.matchQueue) {
      // Check if match request has expired
      if (now - matchRequest.timestamp > maxWaitTime) {
        this.matchQueue.delete(playerId);
        this.removePlayerFromBracket(playerId);
        this.emit('matchExpired', matchRequest);
        continue;
      }

      // Try to find a match
      const opponent = await this.findMatch(matchRequest);
      
      if (opponent) {
        await this.createMatch(matchRequest, opponent);
        this.matchQueue.delete(playerId);
        this.removePlayerFromBracket(playerId);
      }
    }
  }

  /**
   * Create a match between two players
   * @param {Object} matchRequest - Match request
   * @param {Object} opponent - Opponent player
   */
  async createMatch(matchRequest, opponent) {
    const match = {
      id: this.generateMatchId(),
      player1: matchRequest.player,
      player2: opponent,
      timestamp: Date.now(),
      status: 'created',
      network1: matchRequest.player.networkId,
      network2: opponent.networkId
    };

    // Record match in history
    this.recordMatch(matchRequest.player.globalId, {
      opponentId: opponent.globalId,
      timestamp: match.timestamp,
      result: 'pending'
    });
    
    this.recordMatch(opponent.globalId, {
      opponentId: matchRequest.player.globalId,
      timestamp: match.timestamp,
      result: 'pending'
    });

    this.logger.info(`⚔️ Match created: ${matchRequest.player.name} vs ${opponent.name}`);
    this.emit('matchCreated', match);
    
    return match;
  }

  /**
   * Record match in player history
   * @param {string} playerId - Player global ID
   * @param {Object} match - Match data
   */
  recordMatch(playerId, match) {
    if (!this.matchHistory.has(playerId)) {
      this.matchHistory.set(playerId, []);
    }
    
    const history = this.matchHistory.get(playerId);
    history.push(match);
    
    // Keep only last 50 matches
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  /**
   * Update player ranking after match
   * @param {string} winnerId - Winner's global ID
   * @param {string} loserId - Loser's global ID
   * @param {Object} matchData - Match details
   */
  updateRankings(winnerId, loserId, matchData) {
    const winnerRank = this.getPlayerRank(winnerId);
    const loserRank = this.getPlayerRank(loserId);
    
    // Calculate ranking change based on ELO-like system
    const expectedWinner = 1 / (1 + Math.pow(10, (loserRank - winnerRank) / 400));
    const expectedLoser = 1 - expectedWinner;
    
    const kFactor = 32; // Standard K-factor
    const winnerChange = Math.round(kFactor * (1 - expectedWinner));
    const loserChange = Math.round(kFactor * (0 - expectedLoser));
    
    // Update winner ranking
    this.updatePlayerRank(winnerId, winnerChange);
    
    // Update loser ranking
    this.updatePlayerRank(loserId, loserChange);
    
    this.logger.info(`📊 Rankings updated: ${winnerId} +${winnerChange}, ${loserId} ${loserChange}`);
  }

  /**
   * Update individual player ranking
   * @param {string} playerId - Player global ID
   * @param {number} change - Ranking change
   */
  updatePlayerRank(playerId, change) {
    if (!this.rankings.has(playerId)) {
      this.rankings.set(playerId, {
        rank: 1000,
        wins: 0,
        losses: 0,
        winRate: 0
      });
    }
    
    const ranking = this.rankings.get(playerId);
    ranking.rank = Math.max(0, ranking.rank + change);
    
    // Apply ranking decay
    const decay = this.config.get('gameplay.matchmaking.rankingDecay', 0.95);
    ranking.rank = Math.round(ranking.rank * decay);
  }

  /**
   * Get leaderboard
   * @param {Object} options - Leaderboard options
   */
  getLeaderboard(options = {}) {
    const limit = options.limit || 10;
    const networkId = options.networkId;
    
    let rankings = Array.from(this.rankings.entries()).map(([playerId, data]) => ({
      playerId,
      ...data
    }));
    
    // Filter by network if specified
    if (networkId) {
      rankings = rankings.filter(ranking => 
        ranking.playerId.startsWith(`${networkId}:`)
      );
    }
    
    // Sort by rank (lower is better)
    rankings.sort((a, b) => a.rank - b.rank);
    
    return rankings.slice(0, limit);
  }

  /**
   * Get match statistics
   */
  getMatchStats() {
    return {
      queuedMatches: this.matchQueue.size,
      totalRankings: this.rankings.size,
      levelBrackets: this.levelBrackets.size,
      totalMatches: Array.from(this.matchHistory.values())
        .reduce((total, history) => total + history.length, 0)
    };
  }

  /**
   * Start matchmaking processing loop
   */
  startMatchmakingLoop() {
    setInterval(async () => {
      await this.processMatchmaking();
    }, 2000); // Every 2 seconds
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.on('matchRequested', (matchRequest) => {
      this.logger.debug(`Match requested: ${matchRequest.player.name}`);
    });

    this.on('matchCreated', (match) => {
      this.logger.info(`Match created: ${match.player1.name} vs ${match.player2.name}`);
    });

    this.on('matchExpired', (matchRequest) => {
      this.logger.warn(`Match expired: ${matchRequest.player.name}`);
    });
  }

  /**
   * Generate unique match ID
   */
  generateMatchId() {
    return `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup and close
   */
  cleanup() {
    this.logger.info('🧹 Matchmaking cleanup completed');
  }
}

module.exports = Matchmaking;