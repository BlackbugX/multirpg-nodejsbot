# Enhanced MultiRPG Bot Setup Guide

## 🚀 Quick Setup

### 1. Prerequisites
- **Node.js**: Version 16.0.0 or higher
- **Redis** (Optional): For enhanced global synchronization
- **IRC Client**: To test the bot

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/BlackbugX/nodejs.git
cd nodejs

# Install dependencies
npm install

# Copy example configuration
cp src/config/example-config.js config.js
```

### 3. Configuration
Edit `config.js` with your settings:

```javascript
module.exports = {
  global: {
    botName: 'YourBotName',
    enableWebInterface: true,
    webPort: 3000,
    enableRedis: false, // Set to true if you have Redis
    redisUrl: 'redis://localhost:6379'
  },
  
  networks: [
    {
      id: 'your_network',
      name: 'Your Network Name',
      enabled: true,
      irc: {
        server: 'irc.yournetwork.com',
        port: 6667,
        nick: 'YourBotNick',
        user: 'yourbot',
        realname: 'Your Bot Name',
        password: 'your_password',
        channels: ['#yourchannel'],
        gameChannel: '#yourchannel',
        adminChannel: '#admin'
      },
      game: {
        nickname: 'YourBotNick',
        password: 'your_game_password',
        alignment: 'priest'
      }
    }
  ]
};
```

### 4. Start the Bot
```bash
npm start
```

## 🔧 Advanced Setup

### Multi-Network Configuration
Add multiple networks to support more players:

```javascript
networks: [
  {
    id: 'gamesurge',
    name: 'GameSurge Network',
    enabled: true,
    irc: {
      server: 'irc.gamesurge.net',
      port: 6667,
      nick: 'MultiRPGBot1',
      // ... other settings
    }
  },
  {
    id: 'quakenet',
    name: 'QuakeNet',
    enabled: true,
    irc: {
      server: 'irc.quakenet.org',
      port: 6667,
      nick: 'MultiRPGBot2',
      // ... other settings
    }
  }
]
```

### Redis Setup (Optional)
For enhanced global synchronization:

1. **Install Redis**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install redis-server
   
   # macOS
   brew install redis
   
   # Windows
   # Download from https://redis.io/download
   ```

2. **Start Redis**
   ```bash
   redis-server
   ```

3. **Enable in config**
   ```javascript
   global: {
     enableRedis: true,
     redisUrl: 'redis://localhost:6379'
   }
   ```

### Database Setup
The bot automatically creates and manages its SQLite database. No manual setup required!

## 🎮 Testing the Bot

### 1. Connect to IRC
Use your favorite IRC client to connect to the same network as your bot.

### 2. Join the Channel
Join the channel where your bot is running.

### 3. Test Commands
Try these commands to test the bot:

```
!help          - Show all commands
!status        - Show bot status
!level         - Show your level
!class         - Show your class
!guild         - Show guild info
!battle pve    - Start PvE battle
!quest         - Show available quests
```

### 4. Admin Commands
If you're an admin, try:

```
!broadcast Hello World!
!playerlist
!tournament list
!event start Test Event
```

## 🔍 Troubleshooting

### Common Issues

#### Bot Won't Start
- Check Node.js version: `node --version` (should be 16+)
- Verify configuration file exists: `ls config.js`
- Check for syntax errors in config

#### Bot Connects but No Response
- Verify channel permissions
- Check if bot is in the correct channel
- Ensure game service is running

#### Redis Connection Errors
- Make sure Redis is running: `redis-cli ping`
- Check Redis URL in configuration
- Disable Redis if not needed: `enableRedis: false`

#### Database Errors
- Check file permissions in data directory
- Ensure disk space is available
- Delete `data/game.db` to reset database

### Logs
Check the console output for error messages. The bot logs all activities and errors.

### Debug Mode
Enable debug logging in config:

```javascript
global: {
  logLevel: 'debug'
}
```

## 🚀 Production Deployment

### 1. Process Manager
Use PM2 to manage the bot process:

```bash
# Install PM2
npm install -g pm2

# Start bot with PM2
pm2 start src/bot.js --name "multirpg-bot"

# Save PM2 configuration
pm2 save
pm2 startup
```

### 2. System Service
Create a systemd service for automatic startup:

```bash
# Create service file
sudo nano /etc/systemd/system/multirpg-bot.service
```

```ini
[Unit]
Description=Enhanced MultiRPG Bot
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/path/to/your/bot
ExecStart=/usr/bin/node src/bot.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable multirpg-bot
sudo systemctl start multirpg-bot
```

### 3. Monitoring
Monitor the bot with PM2:

```bash
# View logs
pm2 logs multirpg-bot

# Monitor resources
pm2 monit

# Restart bot
pm2 restart multirpg-bot
```

## 🔒 Security Considerations

### 1. IRC Security
- Use strong passwords for IRC connections
- Limit admin permissions to trusted users
- Regularly update bot credentials

### 2. Network Security
- Use secure IRC connections when possible
- Implement rate limiting for commands
- Monitor for abuse and spam

### 3. Data Security
- Regular database backups
- Secure Redis configuration
- Protect configuration files

## 📊 Performance Tuning

### 1. Memory Usage
- Monitor memory usage with `pm2 monit`
- Restart bot periodically if memory grows
- Optimize database queries

### 2. Network Performance
- Use Redis for better synchronization
- Implement connection pooling
- Monitor network latency

### 3. Database Performance
- Regular database maintenance
- Index optimization
- Cleanup old data

## 🔄 Updates and Maintenance

### 1. Updating the Bot
```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Restart bot
pm2 restart multirpg-bot
```

### 2. Database Maintenance
```bash
# Backup database
cp data/game.db data/game.db.backup

# Cleanup old data (if needed)
# The bot handles this automatically
```

### 3. Configuration Updates
- Always backup config before changes
- Test changes in development first
- Restart bot after configuration changes

## 🆘 Getting Help

### 1. Documentation
- Check this setup guide
- Read the main README.md
- Check inline code comments

### 2. Community
- GitHub Issues for bug reports
- GitHub Discussions for questions
- IRC channels for real-time help

### 3. Debugging
- Enable debug logging
- Check console output
- Use PM2 logs for production

---

**Happy gaming! 🎮✨**