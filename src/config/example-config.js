/**
 * Example Configuration for Enhanced MultiRPG Bot
 * Copy this file to config.js and customize for your setup
 */

module.exports = {
  global: {
    botName: 'MultiRPG-Enhanced',
    version: '2.0.0',
    language: 'en',
    timezone: 'UTC',
    logLevel: 'info',
    enableWebInterface: true,
    webPort: 3000,
    enableRedis: true,
    redisUrl: 'redis://localhost:6379',
    enableDatabase: true,
    databasePath: './data/game.db'
  },

  networks: [
    {
      id: 'gamesurge',
      name: 'GameSurge Network',
      enabled: true,
      priority: 5,
      irc: {
        server: 'irc.gamesurge.net',
        port: 6667,
        secure: false,
        nick: 'MultiRPGBot',
        user: 'multirpg',
        realname: 'MultiRPG Enhanced Bot',
        password: '',
        channels: ['#multirpg', '#gaming', '#rpg'],
        gameChannel: '#multirpg',
        adminChannel: '#multirpg-admin'
      },
      game: {
        nickname: 'MultiRPGBot',
        password: 'your_game_password',
        alignment: 'priest',
        autoLogin: true,
        autoReconnect: true,
        reconnectDelay: 5000
      }
    },
    {
      id: 'freenode',
      name: 'Freenode Network',
      enabled: false, // Disabled by default
      priority: 3,
      irc: {
        server: 'chat.freenode.net',
        port: 6667,
        secure: false,
        nick: 'MultiRPGBot2',
        user: 'multirpg2',
        realname: 'MultiRPG Enhanced Bot 2',
        password: '',
        channels: ['#multirpg', '#gaming'],
        gameChannel: '#multirpg',
        adminChannel: '#multirpg-admin'
      },
      game: {
        nickname: 'MultiRPGBot2',
        password: 'your_game_password_2',
        alignment: 'warrior',
        autoLogin: true,
        autoReconnect: true,
        reconnectDelay: 5000
      }
    },
    {
      id: 'discord',
      name: 'Discord Integration',
      enabled: false, // Requires Discord bot token
      priority: 7,
      irc: {
        server: 'discord.com',
        port: 443,
        secure: true,
        nick: 'MultiRPGBot',
        user: 'multirpg',
        realname: 'MultiRPG Enhanced Bot',
        password: 'your_discord_bot_token',
        channels: ['#multirpg', '#gaming'],
        gameChannel: '#multirpg',
        adminChannel: '#admin'
      },
      game: {
        nickname: 'MultiRPGBot',
        password: 'your_game_password',
        alignment: 'rogue',
        autoLogin: true,
        autoReconnect: true,
        reconnectDelay: 5000
      }
    }
  ],

  gameplay: {
    enableGlobalSync: true,
    enableCrossNetworkBattles: true,
    enableTournaments: true,
    enableQuests: true,
    enableMilestones: true,
    enableChainEvents: true,
    maxLevel: 9999,
    levelScaling: {
      baseExp: 1000,
      scalingFactor: 1.5,
      milestoneLevels: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
    },
    matchmaking: {
      enableLevelBrackets: true,
      levelBracketSize: 10,
      enableRanking: true,
      rankingDecay: 0.95,
      maxMatchmakingTime: 300000, // 5 minutes
      enableRandomMatching: true
    },
    tournaments: {
      autoSchedule: true,
      scheduleInterval: '0 0 */6 * *', // Every 6 hours
      minParticipants: 4,
      maxParticipants: 32,
      entryFee: 100,
      prizePool: {
        first: 0.5,  // 50% of total prize pool
        second: 0.3, // 30% of total prize pool
        third: 0.2   // 20% of total prize pool
      }
    }
  },

  admin: {
    enabled: true,
    commands: {
      enableBroadcast: true,
      enablePlayerManagement: true,
      enableEventManagement: true,
      enableTournamentManagement: true,
      enableGlobalEvents: true
    },
    permissions: ['admin', 'moderator'],
    logActions: true
  },

  messages: {
    language: 'en',
    enableEmojis: true,
    enableRichFormatting: true,
    tone: 'friendly',
    customMessages: {
      welcome: '🎮 Welcome to MultiRPG Enhanced! Ready for adventure?',
      levelUp: '🎉 Congratulations! You reached level {level}!',
      battleWin: '⚔️ Victory! You defeated {opponent}!',
      tournamentStart: '🏆 Tournament starting! Good luck to all participants!',
      milestone: '🌟 Milestone reached! You\'ve achieved something special!'
    }
  }
};