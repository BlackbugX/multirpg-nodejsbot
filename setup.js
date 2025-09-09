#!/usr/bin/env node

/**
 * Enhanced MultiRPG Bot Setup Script
 * This script helps you set up the bot quickly and easily
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('🎮 Enhanced MultiRPG Bot Setup 🎮');
  console.log('=====================================\n');
  
  console.log('This bot features:');
  console.log('• 🤖 Fully automated gameplay - no manual intervention needed!');
  console.log('• 🌐 Multi-network support - play across multiple IRC networks');
  console.log('• ⚔️ Automated battles, quests, and leveling');
  console.log('• 🏰 Guild system with automatic recruitment');
  console.log('• 🏆 Tournament system with cross-network play');
  console.log('• 📊 Global leaderboards and achievements');
  console.log('• 💬 Help system via private messages (no channel penalties!)\n');
  
  console.log('Let\'s set up your bot configuration...\n');
  
  // Get basic configuration
  const botName = await question('Bot nickname: ') || 'MultiRPGBot';
  const server = await question('IRC Server (e.g., irc.gamesurge.net): ') || 'irc.gamesurge.net';
  const port = await question('IRC Port (default 6667): ') || '6667';
  const channels = await question('Channels to join (comma-separated, e.g., #multirpg,#gaming): ') || '#multirpg,#gaming';
  const gamePassword = await question('Game password (for MultiRPG): ') || 'your_password';
  const adminUsers = await question('Admin usernames (comma-separated): ') || 'admin,moderator';
  
  // Create configuration
  const config = {
    global: {
      botName: 'MultiRPG-Enhanced',
      version: '2.0.0',
      language: 'en',
      timezone: 'UTC',
      logLevel: 'info',
      enableWebInterface: true,
      webPort: 3000,
      enableRedis: false, // Disabled for simplicity
      enableDatabase: true,
      databasePath: './data/game.db'
    },
    
    networks: [
      {
        id: 'main',
        name: 'Main Network',
        enabled: true,
        priority: 5,
        irc: {
          server: server,
          port: parseInt(port),
          secure: false,
          nick: botName,
          user: botName.toLowerCase(),
          realname: 'MultiRPG Enhanced Bot',
          password: '',
          channels: channels.split(',').map(c => c.trim()),
          gameChannel: channels.split(',')[0].trim(),
          adminChannel: channels.split(',')[0].trim() + '-admin'
        },
        game: {
          nickname: botName,
          password: gamePassword,
          alignment: 'priest',
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
      }
    },
    
    admin: {
      enabled: true,
      users: adminUsers.split(',').map(u => u.trim().toLowerCase()),
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
      tone: 'friendly'
    }
  };
  
  // Create data directory
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Created data directory');
  }
  
  // Write configuration
  const configPath = path.join(__dirname, 'src', 'config', 'config.js');
  const configContent = `module.exports = ${JSON.stringify(config, null, 2)};`;
  
  fs.writeFileSync(configPath, configContent);
  console.log('✅ Configuration saved to src/config/config.js');
  
  console.log('\n🎉 Setup Complete! 🎉');
  console.log('===================');
  console.log('\nTo start your bot:');
  console.log('1. Run: npm install');
  console.log('2. Run: npm start');
  console.log('\n⚠️  IMPORTANT: ALL COMMANDS MUST BE SENT VIA PRIVATE MESSAGE! ⚠️');
  console.log('Using commands in channels will result in penalties!');
  console.log('\nBot Features:');
  console.log('• 🤖 Fully automated gameplay');
  console.log('• 💬 Help via private message: /msg ' + botName + ' !help');
  console.log('• 👑 Admin help: /msg ' + botName + ' !adminhelp');
  console.log('• 👤 User help: /msg ' + botName + ' !userhelp');
  console.log('\nExample Commands (Private Messages Only):');
  console.log('• /msg ' + botName + ' !status - Check bot status');
  console.log('• /msg ' + botName + ' !level - Check your level');
  console.log('• /msg ' + botName + ' !guild join Warriors - Join a guild');
  console.log('• /msg ' + botName + ' !battle pve - Start PvE battle');
  console.log('\nThe bot will automatically:');
  console.log('• Connect to IRC and join channels');
  console.log('• Login to MultiRPG game service');
  console.log('• Start automated battles and quests');
  console.log('• Level up and progress your character');
  console.log('• Handle all game mechanics without intervention');
  console.log('\n🚫 NEVER use commands in channels - you will be penalized!');
  console.log('✅ ALWAYS use private messages: /msg ' + botName + ' !command');
  console.log('\nEnjoy your automated RPG adventure! 🎮');
  
  rl.close();
}

setup().catch(console.error);