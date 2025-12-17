# 🐍🪜 Snake & Ladder - Multiplayer Game

A real-time multiplayer Snake & Ladder game built with PHP WebSockets and vanilla JavaScript.

![Game Preview](https://img.shields.io/badge/Status-Live-brightgreen) ![PHP](https://img.shields.io/badge/PHP-7.4+-blue) ![WebSocket](https://img.shields.io/badge/WebSocket-Ratchet-orange)

## ✨ Features

- **Real-time Multiplayer** - Play with up to 8 players simultaneously
- **Invite System** - Create private games and invite specific players
- **Chaos Mode** - Board shuffles every 60 seconds with new snakes and ladders
- **Turn Timer** - 15-second turn limit with auto-roll penalty for AFK players
- **Tile-by-Tile Animation** - Smooth piece movement through each tile
- **Initiative Roll** - Fair turn order determined by 3-dice roll at game start
- **Responsive Design** - Works on both desktop and mobile browsers
- **No Login Required** - Just enter a nickname and play!

## 📋 System Requirements

### Server Requirements
- **PHP** >= 7.4
- **Composer** (PHP package manager)
- **Web Server** (Apache, Nginx, or Laragon for local dev)
- **Port 8081** open for WebSocket connections

### Client Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- JavaScript enabled

### Recommended for Production
- **Ubuntu/Debian** VPS
- **Apache2** with `mod_proxy` and `mod_proxy_wstunnel`
- **Let's Encrypt** SSL certificate for WSS support

## 🚀 Installation

### Local Development (Windows/Laragon)

1. **Clone the repository**
   ```bash
   git clone https://github.com/daffawrdhn/ladder-snake.git
   cd ladder-snake
   ```

2. **Install PHP dependencies**
   ```bash
   composer install
   ```

3. **Start the WebSocket server**
   ```bash
   php server.php
   ```
   > Server will start on port 8081

4. **Open in browser**
   ```
   http://localhost/ladder-snake
   ```

### Production Deployment (Ubuntu + Apache2)

1. **Clone to web directory**
   ```bash
   cd /var/www
   sudo git clone https://github.com/daffawrdhn/ladder-snake.git slader
   sudo chown -R www-data:www-data slader
   cd slader
   sudo composer install --no-dev
   ```

2. **Enable Apache modules**
   ```bash
   sudo a2enmod proxy proxy_http proxy_wstunnel rewrite
   ```

3. **Create Apache virtual host** (`/etc/apache2/sites-available/slader.conf`)
   ```apache
   <VirtualHost *:80>
       ServerName your-domain.com
       DocumentRoot /var/www/slader
       
       <Directory /var/www/slader>
           Options -Indexes +FollowSymLinks
           AllowOverride All
           Require all granted
       </Directory>
   </VirtualHost>
   ```

4. **Enable SSL with Let's Encrypt**
   ```bash
   sudo certbot --apache -d your-domain.com
   ```

5. **Add WebSocket proxy to SSL config**
   Add to `/etc/apache2/sites-available/your-domain-le-ssl.conf`:
   ```apache
   RewriteEngine On
   RewriteCond %{HTTP:Upgrade} websocket [NC]
   RewriteCond %{HTTP:Connection} upgrade [NC]
   RewriteRule ^/?(.*) ws://127.0.0.1:8081/$1 [P,L]
   
   ProxyPass /ws ws://127.0.0.1:8081/
   ProxyPassReverse /ws ws://127.0.0.1:8081/
   ```

6. **Create systemd service** (`/etc/systemd/system/slader-websocket.service`)
   ```ini
   [Unit]
   Description=Slader Snake WebSocket Server
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/var/www/slader
   ExecStart=/usr/bin/php /var/www/slader/server.php
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

7. **Start the service**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable slader-websocket
   sudo systemctl start slader-websocket
   ```

8. **Open firewall port**
   ```bash
   sudo ufw allow 8081/tcp
   ```

## 🎮 How to Play

### Getting Started
1. Open the game in your browser
2. Enter your nickname and click **"Enter Lobby"**
3. You'll see a list of other online players

### Creating a Game
1. In the lobby, **click on players** you want to invite (up to 7)
2. Click **"Send Invite"** button
3. Wait for players to accept
4. Click **"Start Game"** when ready

### Joining a Game
1. When someone invites you, a popup will appear
2. Click **"Accept"** to join or **"Decline"** to refuse
3. Wait for the host to start the game

### Gameplay
1. **Initiative Roll** - At game start, all players roll 3 dice to determine turn order
2. **Your Turn** - When it's your turn, click the **"🎲 ROLL"** button
3. **Watch the Piece Move** - Your piece will walk tile-by-tile to the destination
4. **Snakes** 🐍 - Landing on a snake head slides you down to its tail
5. **Ladders** 🪜 - Landing on a ladder bottom climbs you up to its top
6. **Chaos Mode** ⚠️ - Every 60 seconds, the board shuffles with new snakes and ladders!
7. **Win Condition** - First player to reach exactly tile **100** wins!

### Turn Timer
- Each player has **15 seconds** to roll
- If you don't roll in time, the server will **auto-roll** for you
- **Penalty**: If auto-rolled value > 3, you move 2 fewer tiles

## 📁 Project Structure

```
ladder-snake/
├── index.html          # Main game page
├── server.php          # WebSocket server entry point
├── composer.json       # PHP dependencies
├── css/
│   └── style.css       # Game styling
├── js/
│   ├── core.js         # WebSocket connection & app state
│   ├── ui.js           # DOM references & UI utilities
│   ├── lobby.js        # Lobby screen logic
│   ├── game.js         # Game board & gameplay logic
│   ├── socket-handler.js # WebSocket message handlers
│   ├── modals.js       # Winner/loser/disconnect modals
│   └── invite.js       # Invite system UI
├── src/
│   ├── GameServer.php  # Main WebSocket server
│   ├── GameRoom.php    # Individual game room logic
│   ├── GameState.php   # Game state management
│   └── Lobby.php       # Lobby management
└── vendor/             # Composer dependencies
```

## 🛠️ Technology Stack

- **Backend**: PHP 7.4+, Ratchet WebSocket Library, ReactPHP
- **Frontend**: Vanilla JavaScript, CSS3
- **Font**: Google Fonts (Outfit)
- **Icons**: Emoji-based

## 📄 License

MIT License - feel free to use and modify!

---

**Live Demo**: [slader.1year.site](https://slader.1year.site)

Made with ❤️ by [daffawrdhn](https://github.com/daffawrdhn)
