/**
 * Database System for IRC MultiRPG Bot
 * Handles SQLite database operations for persistent data storage
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const winston = require('winston');

class Database {
  constructor(config) {
    this.config = config;
    this.db = null;
    this.isConnected = false;
    
    this.logger = winston.createLogger({
      level: this.config.get('global.logLevel', 'info'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'database' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.init();
  }

  /**
   * Initialize database
   */
  async init() {
    if (!this.config.get('global.enableDatabase', true)) {
      this.logger.info('Database disabled in configuration');
      return;
    }

    try {
      await this.connect();
      await this.createTables();
      this.logger.info('🗄️ Database system initialized');
    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Connect to database
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const dbPath = this.config.get('global.databasePath', './data/game.db');
      const dbDir = path.dirname(dbPath);
      
      // Create data directory if it doesn't exist
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          this.logger.error('Database connection error:', err);
          reject(err);
        } else {
          this.isConnected = true;
          this.logger.info(`🔗 Connected to database: ${dbPath}`);
          resolve();
        }
      });
    });
  }

  /**
   * Create database tables
   */
  async createTables() {
    const tables = [
      // Players table
      `CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        global_id TEXT UNIQUE NOT NULL,
        network_id TEXT NOT NULL,
        player_id TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0,
        gold INTEGER DEFAULT 0,
        hp INTEGER DEFAULT 100,
        attack INTEGER DEFAULT 50,
        defense INTEGER DEFAULT 25,
        alignment TEXT DEFAULT 'priest',
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        battles INTEGER DEFAULT 0,
        quests_completed INTEGER DEFAULT 0,
        tournaments_won INTEGER DEFAULT 0,
        achievements TEXT DEFAULT '[]',
        items TEXT DEFAULT '[]',
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Battles table
      `CREATE TABLE IF NOT EXISTS battles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        battle_id TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        player1_id TEXT NOT NULL,
        player2_id TEXT,
        monster_name TEXT,
        winner TEXT,
        status TEXT DEFAULT 'pending',
        rewards TEXT DEFAULT '{}',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        duration INTEGER DEFAULT 0
      )`,

      // Tournaments table
      `CREATE TABLE IF NOT EXISTS tournaments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'scheduled',
        max_participants INTEGER DEFAULT 16,
        entry_fee INTEGER DEFAULT 100,
        prize_pool TEXT DEFAULT '{}',
        participants TEXT DEFAULT '[]',
        bracket TEXT DEFAULT '{}',
        winner TEXT,
        started_at DATETIME,
        ended_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Quests table
      `CREATE TABLE IF NOT EXISTS quests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quest_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        difficulty INTEGER DEFAULT 1,
        level INTEGER DEFAULT 1,
        rewards TEXT DEFAULT '{}',
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        completed_by TEXT,
        completed_at DATETIME
      )`,

      // Player quests table (many-to-many relationship)
      `CREATE TABLE IF NOT EXISTS player_quests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        quest_id TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        progress TEXT DEFAULT '{}',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        UNIQUE(player_id, quest_id)
      )`,

      // Achievements table
      `CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        achievement_name TEXT NOT NULL,
        description TEXT,
        earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        level INTEGER DEFAULT 1,
        value INTEGER DEFAULT 0
      )`,

      // Items table
      `CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL,
        item_name TEXT NOT NULL,
        item_type TEXT NOT NULL,
        rarity TEXT DEFAULT 'common',
        value INTEGER DEFAULT 0,
        properties TEXT DEFAULT '{}',
        obtained_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Events table
      `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        started_by TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        participants TEXT DEFAULT '[]',
        rewards TEXT DEFAULT '{}'
      )`,

      // Admin logs table
      `CREATE TABLE IF NOT EXISTS admin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_user TEXT NOT NULL,
        command TEXT NOT NULL,
        args TEXT DEFAULT '[]',
        network_id TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        result TEXT DEFAULT 'success'
      )`,

      // Global stats table
      `CREATE TABLE IF NOT EXISTS global_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stat_name TEXT UNIQUE NOT NULL,
        stat_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_players_global_id ON players(global_id)',
      'CREATE INDEX IF NOT EXISTS idx_players_network_id ON players(network_id)',
      'CREATE INDEX IF NOT EXISTS idx_players_level ON players(level)',
      'CREATE INDEX IF NOT EXISTS idx_battles_player1 ON battles(player1_id)',
      'CREATE INDEX IF NOT EXISTS idx_battles_player2 ON battles(player2_id)',
      'CREATE INDEX IF NOT EXISTS idx_battles_status ON battles(status)',
      'CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status)',
      'CREATE INDEX IF NOT EXISTS idx_quests_status ON quests(status)',
      'CREATE INDEX IF NOT EXISTS idx_player_quests_player ON player_quests(player_id)',
      'CREATE INDEX IF NOT EXISTS idx_achievements_player ON achievements(player_id)',
      'CREATE INDEX IF NOT EXISTS idx_items_player ON items(player_id)',
      'CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)',
      'CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_user)',
      'CREATE INDEX IF NOT EXISTS idx_admin_logs_timestamp ON admin_logs(timestamp)'
    ];

    for (const index of indexes) {
      await this.run(index);
    }

    this.logger.info('📊 Database tables created successfully');
  }

  /**
   * Execute SQL query
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  /**
   * Get single row
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get multiple rows
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Save player data
   * @param {Object} playerData - Player data
   */
  async savePlayer(playerData) {
    const sql = `
      INSERT OR REPLACE INTO players (
        global_id, network_id, player_id, level, exp, gold, hp, attack, defense,
        alignment, wins, losses, battles, quests_completed, tournaments_won,
        achievements, items, last_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const params = [
      playerData.globalId,
      playerData.networkId,
      playerData.playerId,
      playerData.level || 1,
      playerData.exp || 0,
      playerData.gold || 0,
      playerData.hp || 100,
      playerData.attack || 50,
      playerData.defense || 25,
      playerData.alignment || 'priest',
      playerData.wins || 0,
      playerData.losses || 0,
      playerData.battles || 0,
      playerData.questsCompleted || 0,
      playerData.tournamentsWon || 0,
      JSON.stringify(playerData.achievements || []),
      JSON.stringify(playerData.items || []),
      new Date().toISOString()
    ];

    return await this.run(sql, params);
  }

  /**
   * Get player data
   * @param {string} globalId - Global player ID
   */
  async getPlayer(globalId) {
    const sql = 'SELECT * FROM players WHERE global_id = ?';
    const row = await this.get(sql, [globalId]);
    
    if (row) {
      return {
        ...row,
        achievements: JSON.parse(row.achievements || '[]'),
        items: JSON.parse(row.items || '[]')
      };
    }
    
    return null;
  }

  /**
   * Get all players
   * @param {Object} filters - Filter criteria
   */
  async getAllPlayers(filters = {}) {
    let sql = 'SELECT * FROM players WHERE 1=1';
    const params = [];

    if (filters.networkId) {
      sql += ' AND network_id = ?';
      params.push(filters.networkId);
    }

    if (filters.minLevel) {
      sql += ' AND level >= ?';
      params.push(filters.minLevel);
    }

    if (filters.maxLevel) {
      sql += ' AND level <= ?';
      params.push(filters.maxLevel);
    }

    if (filters.alignment) {
      sql += ' AND alignment = ?';
      params.push(filters.alignment);
    }

    sql += ' ORDER BY level DESC, exp DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = await this.all(sql, params);
    return rows.map(row => ({
      ...row,
      achievements: JSON.parse(row.achievements || '[]'),
      items: JSON.parse(row.items || '[]')
    }));
  }

  /**
   * Save battle data
   * @param {Object} battleData - Battle data
   */
  async saveBattle(battleData) {
    const sql = `
      INSERT INTO battles (
        battle_id, type, player1_id, player2_id, monster_name, winner,
        status, rewards, started_at, ended_at, duration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      battleData.id,
      battleData.type,
      battleData.player1,
      battleData.player2 || null,
      battleData.monsterName || null,
      battleData.winner || null,
      battleData.status,
      JSON.stringify(battleData.rewards || {}),
      new Date(battleData.startTime).toISOString(),
      battleData.endTime ? new Date(battleData.endTime).toISOString() : null,
      battleData.duration || 0
    ];

    return await this.run(sql, params);
  }

  /**
   * Get battle history
   * @param {string} playerId - Player ID
   * @param {number} limit - Limit results
   */
  async getBattleHistory(playerId, limit = 50) {
    const sql = `
      SELECT * FROM battles 
      WHERE player1_id = ? OR player2_id = ? 
      ORDER BY started_at DESC 
      LIMIT ?
    `;

    const rows = await this.all(sql, [playerId, playerId, limit]);
    return rows.map(row => ({
      ...row,
      rewards: JSON.parse(row.rewards || '{}')
    }));
  }

  /**
   * Save tournament data
   * @param {Object} tournamentData - Tournament data
   */
  async saveTournament(tournamentData) {
    const sql = `
      INSERT OR REPLACE INTO tournaments (
        tournament_id, name, type, status, max_participants, entry_fee,
        prize_pool, participants, bracket, winner, started_at, ended_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      tournamentData.id,
      tournamentData.name,
      tournamentData.type,
      tournamentData.status,
      tournamentData.maxParticipants,
      tournamentData.entryFee,
      JSON.stringify(tournamentData.prizePool || {}),
      JSON.stringify(tournamentData.participants || []),
      JSON.stringify(tournamentData.bracket || {}),
      tournamentData.winner || null,
      tournamentData.startTime ? new Date(tournamentData.startTime).toISOString() : null,
      tournamentData.endTime ? new Date(tournamentData.endTime).toISOString() : null
    ];

    return await this.run(sql, params);
  }

  /**
   * Get tournament data
   * @param {string} tournamentId - Tournament ID
   */
  async getTournament(tournamentId) {
    const sql = 'SELECT * FROM tournaments WHERE tournament_id = ?';
    const row = await this.get(sql, [tournamentId]);
    
    if (row) {
      return {
        ...row,
        prizePool: JSON.parse(row.prize_pool || '{}'),
        participants: JSON.parse(row.participants || '[]'),
        bracket: JSON.parse(row.bracket || '{}')
      };
    }
    
    return null;
  }

  /**
   * Save quest data
   * @param {Object} questData - Quest data
   */
  async saveQuest(questData) {
    const sql = `
      INSERT OR REPLACE INTO quests (
        quest_id, name, description, type, difficulty, level,
        rewards, status, created_at, expires_at, completed_by, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      questData.id,
      questData.name,
      questData.description,
      questData.type,
      questData.difficulty,
      questData.level,
      JSON.stringify(questData.rewards || {}),
      questData.status,
      new Date(questData.timestamp).toISOString(),
      questData.timeLimit ? new Date(questData.timestamp + questData.timeLimit).toISOString() : null,
      questData.completedBy || null,
      questData.completedAt ? new Date(questData.completedAt).toISOString() : null
    ];

    return await this.run(sql, params);
  }

  /**
   * Get active quests
   */
  async getActiveQuests() {
    const sql = 'SELECT * FROM quests WHERE status = "active" ORDER BY created_at DESC';
    const rows = await this.all(sql);
    return rows.map(row => ({
      ...row,
      rewards: JSON.parse(row.rewards || '{}')
    }));
  }

  /**
   * Save achievement
   * @param {Object} achievementData - Achievement data
   */
  async saveAchievement(achievementData) {
    const sql = `
      INSERT INTO achievements (
        player_id, achievement_name, description, earned_at, level, value
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    const params = [
      achievementData.playerId,
      achievementData.name,
      achievementData.description,
      new Date(achievementData.timestamp).toISOString(),
      achievementData.level || 1,
      achievementData.value || 0
    ];

    return await this.run(sql, params);
  }

  /**
   * Get player achievements
   * @param {string} playerId - Player ID
   */
  async getPlayerAchievements(playerId) {
    const sql = 'SELECT * FROM achievements WHERE player_id = ? ORDER BY earned_at DESC';
    return await this.all(sql, [playerId]);
  }

  /**
   * Save admin log
   * @param {Object} logData - Log data
   */
  async saveAdminLog(logData) {
    const sql = `
      INSERT INTO admin_logs (
        admin_user, command, args, network_id, timestamp, result
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    const params = [
      logData.user,
      logData.command,
      JSON.stringify(logData.args || []),
      logData.networkId,
      new Date(logData.timestamp).toISOString(),
      logData.result || 'success'
    ];

    return await this.run(sql, params);
  }

  /**
   * Get admin logs
   * @param {Object} filters - Filter criteria
   */
  async getAdminLogs(filters = {}) {
    let sql = 'SELECT * FROM admin_logs WHERE 1=1';
    const params = [];

    if (filters.adminUser) {
      sql += ' AND admin_user = ?';
      params.push(filters.adminUser);
    }

    if (filters.networkId) {
      sql += ' AND network_id = ?';
      params.push(filters.networkId);
    }

    if (filters.since) {
      sql += ' AND timestamp >= ?';
      params.push(new Date(filters.since).toISOString());
    }

    sql += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = await this.all(sql, params);
    return rows.map(row => ({
      ...row,
      args: JSON.parse(row.args || '[]')
    }));
  }

  /**
   * Get global statistics
   */
  async getGlobalStats() {
    const stats = {};

    // Total players
    const playerCount = await this.get('SELECT COUNT(*) as count FROM players');
    stats.totalPlayers = playerCount.count;

    // Average level
    const avgLevel = await this.get('SELECT AVG(level) as avg FROM players');
    stats.averageLevel = Math.floor(avgLevel.avg || 0);

    // Total battles
    const battleCount = await this.get('SELECT COUNT(*) as count FROM battles');
    stats.totalBattles = battleCount.count;

    // Active tournaments
    const activeTournaments = await this.get('SELECT COUNT(*) as count FROM tournaments WHERE status = "active"');
    stats.activeTournaments = activeTournaments.count;

    // Active quests
    const activeQuests = await this.get('SELECT COUNT(*) as count FROM quests WHERE status = "active"');
    stats.activeQuests = activeQuests.count;

    return stats;
  }

  /**
   * Close database connection
   */
  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.isConnected = false;
            this.logger.info('🔌 Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Backup database
   * @param {string} backupPath - Backup file path
   */
  async backup(backupPath) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.backup(backupPath, (err) => {
        if (err) {
          reject(err);
        } else {
          this.logger.info(`💾 Database backed up to: ${backupPath}`);
          resolve();
        }
      });
    });
  }
}

module.exports = Database;