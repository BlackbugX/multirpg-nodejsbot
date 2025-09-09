/**
 * Tournament System for IRC MultiRPG Bot
 * Handles automated tournament scheduling and cross-network competitions
 */

const EventEmitter = require('events');
const winston = require('winston');
const cron = require('node-cron');
const _ = require('lodash');

class TournamentSystem extends EventEmitter {
  constructor(config, globalSync, battleSystem, matchmaking) {
    super();
    this.config = config;
    this.globalSync = globalSync;
    this.battleSystem = battleSystem;
    this.matchmaking = matchmaking;
    this.activeTournaments = new Map(); // tournamentId -> tournament data
    this.tournamentHistory = new Map(); // tournamentId -> results
    this.scheduledTournaments = new Map(); // scheduleId -> tournament data
    this.participants = new Map(); // tournamentId -> participants
    this.brackets = new Map(); // tournamentId -> bracket data
    
    this.logger = winston.createLogger({
      level: this.config.get('global.logLevel', 'info'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'tournament-system' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.init();
  }

  /**
   * Initialize tournament system
   */
  init() {
    this.setupTournamentTypes();
    this.setupScheduling();
    this.setupEventHandlers();
    
    this.logger.info('🏆 Tournament system initialized');
  }

  /**
   * Setup tournament types
   */
  setupTournamentTypes() {
    this.tournamentTypes = {
      daily: {
        name: 'Daily Tournament',
        description: 'Quick daily competition',
        maxParticipants: 16,
        entryFee: 50,
        duration: 3600000, // 1 hour
        prizePool: { first: 0.5, second: 0.3, third: 0.2 }
      },
      weekly: {
        name: 'Weekly Championship',
        description: 'Weekly major tournament',
        maxParticipants: 32,
        entryFee: 100,
        duration: 7200000, // 2 hours
        prizePool: { first: 0.4, second: 0.3, third: 0.2, fourth: 0.1 }
      },
      monthly: {
        name: 'Monthly Grand Championship',
        description: 'Monthly epic tournament',
        maxParticipants: 64,
        entryFee: 250,
        duration: 14400000, // 4 hours
        prizePool: { first: 0.35, second: 0.25, third: 0.2, fourth: 0.1, fifth: 0.05, sixth: 0.05 }
      },
      special: {
        name: 'Special Event Tournament',
        description: 'Special themed tournament',
        maxParticipants: 128,
        entryFee: 500,
        duration: 21600000, // 6 hours
        prizePool: { first: 0.3, second: 0.2, third: 0.15, fourth: 0.1, fifth: 0.08, sixth: 0.07, seventh: 0.05, eighth: 0.05 }
      }
    };
  }

  /**
   * Setup automated scheduling
   */
  setupScheduling() {
    if (this.config.get('gameplay.tournaments.autoSchedule', true)) {
      const scheduleInterval = this.config.get('gameplay.tournaments.scheduleInterval', '0 0 */6 * *');
      
      // Schedule regular tournaments
      cron.schedule(scheduleInterval, () => {
        this.scheduleRandomTournament();
      });
      
      // Schedule daily tournaments at midnight
      cron.schedule('0 0 * * *', () => {
        this.scheduleTournament('daily');
      });
      
      // Schedule weekly tournaments on Sundays
      cron.schedule('0 0 * * 0', () => {
        this.scheduleTournament('weekly');
      });
      
      // Schedule monthly tournaments on the 1st
      cron.schedule('0 0 1 * *', () => {
        this.scheduleTournament('monthly');
      });
    }
  }

  /**
   * Schedule a random tournament
   */
  async scheduleRandomTournament() {
    const types = ['daily', 'weekly'];
    const randomType = _.sample(types);
    await this.scheduleTournament(randomType);
  }

  /**
   * Schedule a tournament
   * @param {string} type - Tournament type
   * @param {Object} options - Tournament options
   */
  async scheduleTournament(type, options = {}) {
    const tournamentType = this.tournamentTypes[type];
    if (!tournamentType) {
      throw new Error(`Unknown tournament type: ${type}`);
    }

    const tournament = {
      id: this.generateTournamentId(),
      type: type,
      name: tournamentType.name,
      description: tournamentType.description,
      maxParticipants: options.maxParticipants || tournamentType.maxParticipants,
      entryFee: options.entryFee || tournamentType.entryFee,
      duration: options.duration || tournamentType.duration,
      prizePool: options.prizePool || tournamentType.prizePool,
      status: 'scheduled',
      startTime: Date.now() + (options.delay || 300000), // 5 minutes delay by default
      endTime: null,
      participants: [],
      bracket: null,
      winner: null,
      prizes: {}
    };

    this.scheduledTournaments.set(tournament.id, tournament);
    
    this.logger.info(`🏆 Tournament scheduled: ${tournament.name} (${tournament.id})`);
    this.emit('tournamentScheduled', tournament);
    
    // Broadcast tournament announcement
    await this.globalSync.broadcast(
      `🏆 NEW TOURNAMENT ANNOUNCED! ${tournament.name} - Entry Fee: ${tournament.entryFee} gold - Max Participants: ${tournament.maxParticipants} - Register now! 🏆`,
      'tournament',
      { tournament }
    );
    
    return tournament;
  }

  /**
   * Register player for tournament
   * @param {string} tournamentId - Tournament ID
   * @param {string} playerId - Player ID
   * @param {Object} playerData - Player data
   */
  async registerPlayer(tournamentId, playerId, playerData) {
    const tournament = this.scheduledTournaments.get(tournamentId) || this.activeTournaments.get(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.status !== 'scheduled' && tournament.status !== 'registration') {
      throw new Error('Tournament registration is closed');
    }

    if (tournament.participants.length >= tournament.maxParticipants) {
      throw new Error('Tournament is full');
    }

    if (tournament.participants.includes(playerId)) {
      throw new Error('Player already registered');
    }

    // Check entry fee (placeholder - should integrate with economy system)
    // if (playerData.gold < tournament.entryFee) {
    //   throw new Error('Insufficient gold for entry fee');
    // }

    tournament.participants.push(playerId);
    
    this.logger.info(`📝 Player ${playerId} registered for tournament ${tournamentId}`);
    this.emit('playerRegistered', { tournamentId, playerId });
    
    // Broadcast registration update
    await this.globalSync.broadcast(
      `📝 ${playerId} has registered for ${tournament.name}! (${tournament.participants.length}/${tournament.maxParticipants}) 📝`,
      'tournament',
      { tournamentId, playerId, participantCount: tournament.participants.length }
    );
    
    // Check if tournament should start
    if (tournament.participants.length >= tournament.maxParticipants) {
      await this.startTournament(tournamentId);
    }
    
    return tournament;
  }

  /**
   * Start tournament
   * @param {string} tournamentId - Tournament ID
   */
  async startTournament(tournamentId) {
    const tournament = this.scheduledTournaments.get(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.participants.length < this.config.get('gameplay.tournaments.minParticipants', 4)) {
      throw new Error('Not enough participants to start tournament');
    }

    // Move to active tournaments
    this.scheduledTournaments.delete(tournamentId);
    this.activeTournaments.set(tournamentId, tournament);
    
    tournament.status = 'active';
    tournament.startTime = Date.now();
    tournament.endTime = tournament.startTime + tournament.duration;
    
    // Create bracket
    tournament.bracket = this.createBracket(tournament.participants);
    this.brackets.set(tournamentId, tournament.bracket);
    
    this.logger.info(`🏆 Tournament started: ${tournament.name} (${tournamentId})`);
    this.emit('tournamentStarted', tournament);
    
    // Broadcast tournament start
    await this.globalSync.broadcast(
      `🏆 TOURNAMENT STARTED! ${tournament.name} with ${tournament.participants.length} participants! May the best warrior win! 🏆`,
      'tournament',
      { tournament }
    );
    
    // Start first round
    await this.startNextRound(tournamentId);
    
    return tournament;
  }

  /**
   * Create tournament bracket
   * @param {Array} participants - Participant IDs
   */
  createBracket(participants) {
    const bracket = {
      rounds: [],
      currentRound: 0,
      totalRounds: Math.ceil(Math.log2(participants.length)),
      participants: [...participants],
      matches: []
    };
    
    // Shuffle participants
    bracket.participants = _.shuffle(bracket.participants);
    
    // Create first round matches
    const firstRoundMatches = [];
    for (let i = 0; i < bracket.participants.length; i += 2) {
      if (i + 1 < bracket.participants.length) {
        firstRoundMatches.push({
          id: this.generateMatchId(),
          round: 0,
          player1: bracket.participants[i],
          player2: bracket.participants[i + 1],
          winner: null,
          status: 'pending'
        });
      } else {
        // Odd number of participants - bye for last player
        firstRoundMatches.push({
          id: this.generateMatchId(),
          round: 0,
          player1: bracket.participants[i],
          player2: null,
          winner: bracket.participants[i],
          status: 'bye'
        });
      }
    }
    
    bracket.matches = firstRoundMatches;
    bracket.rounds.push(firstRoundMatches);
    
    return bracket;
  }

  /**
   * Start next round of tournament
   * @param {string} tournamentId - Tournament ID
   */
  async startNextRound(tournamentId) {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    const bracket = this.brackets.get(tournamentId);
    if (!bracket) {
      throw new Error('Tournament bracket not found');
    }

    const currentRound = bracket.rounds[bracket.currentRound];
    const activeMatches = currentRound.filter(match => match.status === 'pending');
    
    if (activeMatches.length === 0) {
      // Round completed, start next round
      await this.completeRound(tournamentId);
      return;
    }

    // Start matches for current round
    for (const match of activeMatches) {
      if (match.player2) {
        await this.startTournamentMatch(tournamentId, match);
      } else {
        // Bye match
        match.status = 'completed';
        match.winner = match.player1;
      }
    }
    
    this.logger.info(`🏆 Round ${bracket.currentRound + 1} started for tournament ${tournamentId}`);
  }

  /**
   * Start tournament match
   * @param {string} tournamentId - Tournament ID
   * @param {Object} match - Match data
   */
  async startTournamentMatch(tournamentId, match) {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Get player data (placeholder - should integrate with player system)
    const player1Data = { level: 1, hp: 100, attack: 50, defense: 25 };
    const player2Data = { level: 1, hp: 100, attack: 50, defense: 25 };
    
    // Start PvP battle
    const battle = await this.battleSystem.startPvPBattle(
      match.player1,
      match.player2,
      player1Data,
      player2Data,
      { tournament: true }
    );
    
    match.battleId = battle.id;
    match.status = 'active';
    
    this.logger.info(`⚔️ Tournament match started: ${match.player1} vs ${match.player2}`);
    
    // Listen for battle completion
    this.battleSystem.once('battleEnded', (completedBattle) => {
      if (completedBattle.id === battle.id) {
        this.completeTournamentMatch(tournamentId, match, completedBattle.winner);
      }
    });
  }

  /**
   * Complete tournament match
   * @param {string} tournamentId - Tournament ID
   * @param {Object} match - Match data
   * @param {string} winner - Winner ID
   */
  async completeTournamentMatch(tournamentId, match, winner) {
    match.winner = winner;
    match.status = 'completed';
    
    this.logger.info(`⚔️ Tournament match completed: ${match.player1} vs ${match.player2}, Winner: ${winner}`);
    
    // Check if round is complete
    const bracket = this.brackets.get(tournamentId);
    const currentRound = bracket.rounds[bracket.currentRound];
    const remainingMatches = currentRound.filter(m => m.status === 'pending' || m.status === 'active');
    
    if (remainingMatches.length === 0) {
      await this.completeRound(tournamentId);
    }
  }

  /**
   * Complete tournament round
   * @param {string} tournamentId - Tournament ID
   */
  async completeRound(tournamentId) {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    const bracket = this.brackets.get(tournamentId);
    if (!bracket) {
      throw new Error('Tournament bracket not found');
    }

    const currentRound = bracket.rounds[bracket.currentRound];
    const winners = currentRound.map(match => match.winner).filter(winner => winner);
    
    if (winners.length === 1) {
      // Tournament complete
      await this.completeTournament(tournamentId, winners[0]);
      return;
    }
    
    // Create next round
    bracket.currentRound++;
    const nextRoundMatches = [];
    
    for (let i = 0; i < winners.length; i += 2) {
      if (i + 1 < winners.length) {
        nextRoundMatches.push({
          id: this.generateMatchId(),
          round: bracket.currentRound,
          player1: winners[i],
          player2: winners[i + 1],
          winner: null,
          status: 'pending'
        });
      } else {
        // Odd number of winners - bye for last player
        nextRoundMatches.push({
          id: this.generateMatchId(),
          round: bracket.currentRound,
          player1: winners[i],
          player2: null,
          winner: winners[i],
          status: 'bye'
        });
      }
    }
    
    bracket.matches.push(...nextRoundMatches);
    bracket.rounds.push(nextRoundMatches);
    
    this.logger.info(`🏆 Round ${bracket.currentRound} completed, starting round ${bracket.currentRound + 1}`);
    
    // Start next round
    await this.startNextRound(tournamentId);
  }

  /**
   * Complete tournament
   * @param {string} tournamentId - Tournament ID
   * @param {string} winner - Winner ID
   */
  async completeTournament(tournamentId, winner) {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    tournament.status = 'completed';
    tournament.winner = winner;
    tournament.endTime = Date.now();
    
    // Calculate prizes
    const totalPrizePool = tournament.participants.length * tournament.entryFee;
    tournament.prizes = this.calculatePrizes(tournament, totalPrizePool);
    
    // Distribute prizes
    await this.distributePrizes(tournament);
    
    // Move to history
    this.activeTournaments.delete(tournamentId);
    this.tournamentHistory.set(tournamentId, tournament);
    
    this.logger.info(`🏆 Tournament completed: ${tournament.name}, Winner: ${winner}`);
    this.emit('tournamentCompleted', tournament);
    
    // Broadcast tournament completion
    await this.globalSync.broadcast(
      `🏆 TOURNAMENT COMPLETED! ${tournament.name} - Winner: ${winner}! Congratulations! 🏆`,
      'tournament',
      { tournament }
    );
    
    return tournament;
  }

  /**
   * Calculate tournament prizes
   * @param {Object} tournament - Tournament data
   * @param {number} totalPrizePool - Total prize pool
   */
  calculatePrizes(tournament, totalPrizePool) {
    const prizes = {};
    const prizePool = tournament.prizePool;
    
    // Get final standings
    const standings = this.getTournamentStandings(tournament);
    
    let position = 1;
    for (const [percentage, places] of Object.entries(prizePool)) {
      for (let i = 0; i < places; i++) {
        if (position <= standings.length) {
          const playerId = standings[position - 1];
          prizes[playerId] = {
            position: position,
            gold: Math.floor(totalPrizePool * percentage),
            percentage: percentage
          };
        }
        position++;
      }
    }
    
    return prizes;
  }

  /**
   * Get tournament standings
   * @param {Object} tournament - Tournament data
   */
  getTournamentStandings(tournament) {
    const bracket = this.brackets.get(tournament.id);
    if (!bracket) return [];
    
    // Simple standings based on final round
    const finalRound = bracket.rounds[bracket.rounds.length - 1];
    const standings = [];
    
    // Add winner first
    if (tournament.winner) {
      standings.push(tournament.winner);
    }
    
    // Add other finalists
    for (const match of finalRound) {
      if (match.winner && match.winner !== tournament.winner) {
        standings.push(match.winner);
      }
    }
    
    return standings;
  }

  /**
   * Distribute tournament prizes
   * @param {Object} tournament - Tournament data
   */
  async distributePrizes(tournament) {
    for (const [playerId, prize] of Object.entries(tournament.prizes)) {
      // Update player state with prize
      await this.globalSync.updatePlayerState(playerId, {
        gold: prize.gold,
        tournamentWins: 1,
        lastTournamentWin: Date.now()
      }, 'tournament-system');
      
      // Broadcast prize
      await this.globalSync.broadcast(
        `🎁 ${playerId} earned ${prize.gold} gold for ${this.getPositionText(prize.position)} place in ${tournament.name}! 🎁`,
        'tournament',
        { playerId, prize, tournament: tournament.name }
      );
    }
  }

  /**
   * Get position text
   * @param {number} position - Position
   */
  getPositionText(position) {
    const positions = {
      1: '1st',
      2: '2nd',
      3: '3rd',
      4: '4th',
      5: '5th',
      6: '6th',
      7: '7th',
      8: '8th'
    };
    
    return positions[position] || `${position}th`;
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.on('tournamentScheduled', (tournament) => {
      this.logger.info(`Tournament scheduled: ${tournament.name}`);
    });

    this.on('tournamentStarted', (tournament) => {
      this.logger.info(`Tournament started: ${tournament.name}`);
    });

    this.on('tournamentCompleted', (tournament) => {
      this.logger.info(`Tournament completed: ${tournament.name}, Winner: ${tournament.winner}`);
    });

    this.on('playerRegistered', (data) => {
      this.logger.info(`Player registered: ${data.playerId} for tournament ${data.tournamentId}`);
    });
  }

  /**
   * Generate unique tournament ID
   */
  generateTournamentId() {
    return `tournament_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique match ID
   */
  generateMatchId() {
    return `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get tournament statistics
   */
  getTournamentStats() {
    return {
      activeTournaments: this.activeTournaments.size,
      scheduledTournaments: this.scheduledTournaments.size,
      completedTournaments: this.tournamentHistory.size,
      totalParticipants: Array.from(this.activeTournaments.values())
        .reduce((total, tournament) => total + tournament.participants.length, 0)
    };
  }

  /**
   * Cleanup and close
   */
  cleanup() {
    this.logger.info('🧹 Tournament system cleanup completed');
  }
}

module.exports = TournamentSystem;