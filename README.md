# Enhanced MultiRPG Bot - Shared Universe Edition

🌟 **The Ultimate Multi-Network RPG Bot with Global Synchronization** 🌟

A revolutionary IRC bot that creates a **shared universe** where players from any network can play together in one massive, synchronized game world. Experience infinite progression, cross-network battles, guild systems, and epic adventures across all IRC networks!

## ✨ Key Features

### 🌍 **Shared Universe Gameplay**
- **Multi-Network Support**: Play on any IRC network, stay connected globally
- **Global Synchronization**: All events, battles, and achievements broadcast across all networks
- **Cross-Network Battles**: Fight players from different networks in epic PvP battles
- **Unified Player System**: One character, multiple networks, infinite possibilities

### ⚔️ **Advanced Combat & Classes**
- **8 Unique Classes**: Warrior, Mage, Paladin, Rogue, Druid, Archer, Necromancer, Monk
- **Class Abilities**: Each class has unique skills and special powers
- **Infinite Progression**: Level up forever with scaling rewards and milestones
- **PvE & PvP Battles**: Fight monsters or challenge other players

### 🏰 **Guild System**
- **Automatic Recruitment**: Players are automatically recruited to suitable guilds
- **Guild Progression**: Guilds level up and gain bonuses for all members
- **Cross-Network Guilds**: Join guilds with players from any network
- **Guild Wars**: Epic battles between guilds across the universe

### ♾️ **Infinite Content**
- **Chain Quests**: Epic multi-stage quests that never end
- **Infinite Battles**: Face endless waves of increasingly powerful enemies
- **Global Events**: Massive events that affect all players across all networks
- **Tournament System**: Automated tournaments with cross-network participants

### 🎮 **Rich Gameplay Features**
- **Milestone Rewards**: Special rewards at level milestones (100, 250, 500, 1000, etc.)
- **Achievement System**: Unlock achievements and titles
- **Leaderboards**: Global rankings across all networks
- **Admin Tools**: Comprehensive admin commands for server management

## 🚀 Quick Start

### Prerequisites
- Node.js 16.0.0 or higher
- Redis server (optional, for enhanced features)
- SQLite3 (included)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/BlackbugX/nodejs.git
   cd nodejs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure the bot**
   ```bash
   cp src/config/example-config.js config.js
   # Edit config.js with your settings
   ```

4. **Start the bot**
   ```bash
   npm start
   ```

## ⚙️ Configuration

### Basic Configuration
```javascript
module.exports = {
  global: {
    botName: 'MultiRPG-Enhanced',
    enableWebInterface: true,
    webPort: 3000,
    enableRedis: true,
    redisUrl: 'redis://localhost:6379'
  },
  
  networks: [
    {
      id: 'gamesurge',
      name: 'GameSurge Network',
      enabled: true,
      irc: {
        server: 'irc.gamesurge.net',
        port: 6667,
        nick: 'MultiRPGBot',
        user: 'multirpg',
        realname: 'MultiRPG Enhanced Bot',
        password: 'your_password',
        channels: ['#multirpg', '#gaming'],
        gameChannel: '#multirpg',
        adminChannel: '#multirpg-admin'
      },
      game: {
        nickname: 'MultiRPGBot',
        password: 'your_game_password',
        alignment: 'priest'
      }
    }
    // Add more networks as needed
  ]
};
```

### Advanced Configuration
- **Multi-Network Setup**: Add multiple IRC networks for maximum coverage
- **Redis Integration**: Enable for enhanced global synchronization
- **Database Options**: Configure SQLite database settings
- **Admin Permissions**: Set up admin users and permissions

## 🎮 Player Commands

### Basic Commands
- `!help` - Show all available commands
- `!status` - Display bot and game status
- `!level` - Show your current level
- `!class` - Display your character class information

### Guild Commands
- `!guild` - Show your guild information
- `!guild join <name>` - Join a guild
- `!guild leave` - Leave your current guild
- `!guild list` - List top guilds

### Battle Commands
- `!battle pve` - Start a PvE battle against monsters
- `!battle pvp <player>` - Challenge another player to PvP
- `!infinite battle <type>` - Start an infinite battle

### Quest Commands
- `!quest` - Show available quests
- `!chain start <type>` - Start a chain quest
- `!chain list` - List available chain quests

### Social Commands
- `!leaderboard [type]` - Show global leaderboards
- `!achievements` - Display your achievements
- `!tournament` - Show tournament information

## 👑 Admin Commands

### Broadcasting
- `!broadcast <message>` - Broadcast to all networks
- `!announce <message>` - Make an announcement
- `!global <message>` - Send global message

### Player Management
- `!ban <player> [reason]` - Ban a player
- `!unban <player>` - Unban a player
- `!kick <player> [reason]` - Kick a player
- `!mute <player> [duration]` - Mute a player

### Event Management
- `!event start <name>` - Start a global event
- `!event stop <name>` - Stop a global event
- `!event list` - List active events

### System Management
- `!status` - Show detailed system status
- `!restart` - Restart the bot
- `!shutdown` - Shutdown the bot
- `!reload` - Reload configuration

## 🏗️ Architecture

### Core Systems
- **GlobalSync**: Handles cross-network message broadcasting
- **GlobalPlayerSystem**: Manages player data across all networks
- **PlayerClasses**: Character class system with unique abilities
- **GuildSystem**: Guild management and progression
- **InfiniteSystems**: Chain quests and infinite content
- **MessageSystem**: Polished message formatting with emojis

### Database
- **SQLite3**: Primary database for persistent storage
- **Redis**: Optional caching and real-time synchronization
- **Automatic Schema**: Database tables created automatically

### Modular Design
- **Event-Driven**: All systems communicate via events
- **Scalable**: Easy to add new features and networks
- **Maintainable**: Clean, documented code structure

## 🌟 Player Classes

### ⚔️ Warrior
- **Focus**: Close combat and physical strength
- **Abilities**: Berserker Rage, Shield Wall, Whirlwind Strike
- **Guild Bonus**: +10% attack power for guild members

### 🔮 Mage
- **Focus**: Arcane magic and spellcasting
- **Abilities**: Fireball, Ice Shield, Lightning Storm
- **Guild Bonus**: +15% magic power for guild members

### 🛡️ Paladin
- **Focus**: Holy magic and divine protection
- **Abilities**: Divine Strike, Blessing of Light, Divine Protection
- **Guild Bonus**: +12% defense and healing for guild members

### 🗡️ Rogue
- **Focus**: Stealth and critical hits
- **Abilities**: Stealth, Poison Blade, Shadow Strike
- **Guild Bonus**: +20% critical hit chance for guild members

### 🌿 Druid
- **Focus**: Nature magic and transformation
- **Abilities**: Healing Touch, Nature's Wrath, Wild Shape
- **Guild Bonus**: +15% HP regeneration for guild members

### 🏹 Archer
- **Focus**: Ranged combat and precision
- **Abilities**: Precision Shot, Multi-Shot, Explosive Arrow
- **Guild Bonus**: +25% accuracy for guild members

### 💀 Necromancer
- **Focus**: Dark magic and undead mastery
- **Abilities**: Life Drain, Summon Skeleton, Death Ray
- **Guild Bonus**: +20% mana regeneration for guild members

### 🥋 Monk
- **Focus**: Martial arts and speed
- **Abilities**: Flying Kick, Meditation, Dragon Punch
- **Guild Bonus**: +18% speed and evasion for guild members

## 🏰 Guild System

### Automatic Recruitment
- Players are automatically assigned to suitable guilds based on their class and level
- Guilds have different focuses: defense, stealth, magic, nature, martial arts
- Each guild provides unique bonuses to all members

### Guild Progression
- Guilds level up as members complete quests and battles
- Higher level guilds can accommodate more members
- Guild bonuses increase with level

### Cross-Network Guilds
- Join guilds with players from any connected network
- Participate in guild wars across the entire universe
- Share achievements and progress with guild members

## ♾️ Infinite Content

### Chain Quests
- **Dragon Slayer Saga**: Epic quest to become the ultimate dragon slayer
- **Shadow Walker Chronicles**: Master the art of shadow walking
- **Guild Master's Journey**: Rise through the ranks to become guild master

### Infinite Battles
- **Dragon Horde**: Face endless waves of dragons
- **Shadow Army**: Battle the infinite shadow army
- **Elemental Storm**: Survive the endless elemental storm

### Global Events
- **Dragon Invasion**: Defend the realm from dragon attacks
- **Shadow Storm**: Face the massive shadow storm
- **Guild Wars**: All guilds are at war!

## 📊 Statistics & Leaderboards

### Global Statistics
- Total players across all networks
- Online players count
- Average player level
- Total battles fought
- Active tournaments and quests

### Leaderboards
- **Level**: Highest level players
- **Gold**: Richest players
- **Battles**: Most battles fought
- **Wins**: Most victories
- **Quests**: Most quests completed
- **Guilds**: Top performing guilds

## 🔧 Development

### Adding New Networks
1. Add network configuration to `config.js`
2. Restart the bot
3. The bot will automatically connect and start broadcasting

### Adding New Classes
1. Add class definition to `PlayerClasses.js`
2. Include abilities, stats, and guild bonuses
3. Restart the bot to load new class

### Adding New Commands
1. Add command handler to `bot.js`
2. Update help message
3. Test across all networks

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs and request features on GitHub
- **Discord**: Join our community server for help and discussion

## 🎉 Acknowledgments

- **Original MultiRPG**: Based on the original MultiRPG bot concept
- **IRC Community**: Thanks to the IRC gaming community for inspiration
- **Contributors**: All contributors who help make this bot amazing

---

**🌟 Welcome to the Enhanced MultiRPG Universe! May your adventures be legendary! 🌟**