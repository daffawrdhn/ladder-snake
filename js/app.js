const socket = new WebSocket('ws://localhost:8080');
const appState = {
    nickname: null,
    inGame: false,
    players: {}, 
    myId: null,
    snakes: {},
    ladders: {},
    chaosTimer: null
};

// DOM Elements
const screens = {
    login: document.getElementById('login-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen')
};

const ui = {
    loginForm: document.getElementById('login-form'),
    nicknameInput: document.getElementById('nickname'),
    myNickname: document.getElementById('my-nickname'),
    onlineList: document.getElementById('online-players-list'),
    createGameBtn: document.getElementById('create-game-btn'),
    gamePlayers: document.getElementById('game-player-list'),
    board: document.getElementById('board'),
    overlay: document.getElementById('board-overlay'),
    dice: document.getElementById('dice'),
    rollBtn: document.getElementById('roll-btn'),
    log: document.getElementById('game-log'),
    turnIndicator: document.getElementById('turn-indicator'),
    chaosTimer: document.getElementById('chaos-timer')
};

// --- WebSocket Handlers ---

socket.onopen = () => {
    console.log('Connected to server');
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
        case 'lobby_list':
            appState.myId = data.me;
            renderLobby(data.players);
            break;
            
        case 'lobby_update':
            break;
            
        case 'game_start':
            startGame(data);
            break;
            
        case 'turn_change':
            updateTurn(data.player);
            break;
            
        case 'dice_roll':
            handleDiceRoll(data);
            break;

        case 'board_update':
            handleBoardUpdate(data);
            break;
            
        case 'game_over':
            stopChaosTimer(); // Stop timer on win
            setTimeout(() => {
                alert(`Game Over! Winner: ${appState.players[data.winner].nickname}`);
                location.reload(); 
            }, 1500);
            break;

        case 'player_left':
            alert(data.message);
            location.reload();
            break;

        case 'error':
            alert(data.message);
            break;
    }
};

// --- UI Logic ---

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

ui.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = ui.nicknameInput.value.trim();
    if (name) {
        appState.nickname = name;
        ui.myNickname.textContent = name;
        socket.send(JSON.stringify({ type: 'set_nickname', nickname: name }));
        showScreen('lobby');
    }
});

let selectedPlayers = [];

function renderLobby(players) {
    ui.onlineList.innerHTML = '';
    const others = players.filter(p => p.id !== appState.myId);
    
    others.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.nickname;
        li.dataset.id = p.id;
        
        if (selectedPlayers.includes(p.id)) {
            li.classList.add('selected');
        }
        
        li.onclick = () => {
            if (selectedPlayers.includes(p.id)) {
                selectedPlayers = selectedPlayers.filter(id => id !== p.id);
                li.classList.remove('selected');
            } else {
                if (selectedPlayers.length < 3) {
                    selectedPlayers.push(p.id);
                    li.classList.add('selected');
                }
            }
            updateCreateButton();
        };
        
        ui.onlineList.appendChild(li);
    });

    if (others.length === 0) {
        ui.onlineList.innerHTML = '<li style="pointer-events:none; text-align:center; color:#64748b;">No other players online yet... Open another tab!</li>';
    }
    updateCreateButton();
}

function updateCreateButton() {
    ui.createGameBtn.disabled = selectedPlayers.length === 0;
}

ui.createGameBtn.addEventListener('click', () => {
    if (selectedPlayers.length > 0) {
        socket.send(JSON.stringify({
            type: 'create_room',
            targets: selectedPlayers
        }));
    }
});

ui.rollBtn.addEventListener('click', () => {
    ui.rollBtn.disabled = true;
    socket.send(JSON.stringify({ type: 'roll_dice' }));
});

// --- Game Logic ---

function startGame(data) {
    appState.inGame = true;
    appState.snakes = data.board.snakes;
    appState.ladders = data.board.ladders;
    appState.players = {};
    
    ui.gamePlayers.innerHTML = '';
    
    data.players.forEach((pid, index) => {
        const nickname = data.nicknames[pid] || pid;
        appState.players[pid] = {
            id: pid,
            color: data.colors[pid],
            nickname: nickname,
            position: 1
        };

        const li = document.createElement('li');
        li.id = `player-li-${pid}`;
        li.textContent = `${nickname} (Pos: 1)`;
        li.style.borderLeft = `4px solid ${data.colors[pid]}`;
        li.style.paddingLeft = '10px';
        ui.gamePlayers.appendChild(li);
    });

    showScreen('game');
    startChaosTimer(); // Start local timer
    
    setTimeout(() => {
        renderBoard();
        
        data.players.forEach((pid) => {
            createPlayerToken(pid, data.colors[pid]);
        });
        
        drawOverlay(); 
    }, 100);
    
    log('--- Initiative Rolls ---');
    Object.keys(data.initiative).forEach(pid => {
         const info = data.initiative[pid];
         const name = appState.players[pid].nickname;
         log(`${name}: [${info.rolls.join(',' )}] = ${info.total}`);
    });
    log('------------------');
}

function renderBoard() {
    ui.board.innerHTML = '';
    for (let row = 9; row >= 0; row--) {
        for (let col = 0; col < 10; col++) {
            let num;
            if (row % 2 !== 0) {
                num = (row * 10) + 10 - col;
            } else {
                num = (row * 10) + 1 + col;
            }
            
            const cell = document.createElement('div');
            cell.className = `cell ${(num % 2 === 0) ? 'even' : 'odd'}`;
            cell.id = `cell-${num}`;
            cell.innerText = num;
            
            if (appState.snakes[num]) cell.innerHTML += '<br>\uD83D\uDC0D\u2198'; 
            if (appState.ladders[num]) cell.innerHTML += '<br>\uD83E\uDE9C\u2197'; 
            
            ui.board.appendChild(cell);
        }
    }
}

function createPlayerToken(pid, color) {
    const token = document.createElement('div');
    token.className = 'player-token';
    token.id = `token-${pid}`;
    token.style.backgroundColor = color;
    token.title = appState.players[pid].nickname;
    ui.board.appendChild(token);
    updateTokenPosition(pid, 1);
}

function updateTokenPosition(pid, pos) {
    const token = document.getElementById(`token-${pid}`);
    if (token) {
        const cell = document.getElementById(`cell-${pos}`);
        if(cell) {
            const top = cell.offsetTop + (cell.offsetHeight / 2) - (token.offsetHeight / 2);
            const left = cell.offsetLeft + (cell.offsetWidth / 2) - (token.offsetWidth / 2);
            token.style.top = `${top}px`;
            token.style.left = `${left}px`;
        }
        
        appState.players[pid].position = pos;
        
        const li = document.getElementById(`player-li-${pid}`);
        if(li) li.textContent = `${appState.players[pid].nickname} (Pos: ${pos})`;
    }
}

function drawOverlay() {
    const canvas = ui.overlay;
    const ctx = canvas.getContext('2d');
    
    const rect = ui.board.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 5;
    
    for (const [start, end] of Object.entries(appState.snakes)) {
        drawLine(ctx, start, end, '#ef4444'); 
    }
    
    for (const [start, end] of Object.entries(appState.ladders)) {
        drawLine(ctx, start, end, '#22c55e'); 
    }
}

function drawLine(ctx, startNum, endNum, color) {
    const startCell = document.getElementById(`cell-${startNum}`);
    const endCell = document.getElementById(`cell-${endNum}`);
    
    if (!startCell || !endCell) return;
    
    const startX = startCell.offsetLeft + startCell.offsetWidth / 2;
    const startY = startCell.offsetTop + startCell.offsetHeight / 2;
    
    const endX = endCell.offsetLeft + endCell.offsetWidth / 2;
    const endY = endCell.offsetTop + endCell.offsetHeight / 2;
    
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(startX, startY, 4, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(endX, endY, 4, 0, Math.PI*2);
    ctx.fill();
}

function updateTurn(pid) {
    const player = appState.players[pid];
    const name = player ? player.nickname : pid;
    const isMe = (pid === `Player_${appState.myId}`);
    
    ui.turnIndicator.textContent = isMe ? "Your Turn!" : `Waiting for ${name}...`;
    ui.turnIndicator.style.color = isMe ? "#4ade80" : "#94a3b8";
    ui.rollBtn.disabled = !isMe;
}

function handleDiceRoll(data) {
    ui.dice.classList.add('rolling');
    setTimeout(() => {
        ui.dice.classList.remove('rolling');
        ui.dice.textContent = data.roll;
        
        const name = appState.players[data.player].nickname;
        const currentPos = appState.players[data.player].position;
        let intermediatePos = currentPos + data.roll;
        
        if (intermediatePos > 100) {
            intermediatePos = 100 - (intermediatePos - 100);
        }

        log(`${name} rolled ${data.roll} (${currentPos} \u2192 ${intermediatePos})`);
        
        const isSnake = appState.snakes[intermediatePos] !== undefined;
        const isLadder = appState.ladders[intermediatePos] !== undefined;

        if (isSnake || isLadder) {
            updateTokenPosition(data.player, intermediatePos);
            
            setTimeout(() => {
                const token = document.getElementById(`token-${data.player}`);
                if (token) {
                    if (isSnake) {
                        token.classList.add('effect-snake');
                        log(`${name} hit Snake! Sliding down to ${data.newPosition} \uD83D\uDE31`);
                    } else {
                        token.classList.add('effect-ladder');
                        log(`${name} hit Ladder! Climbing up to ${data.newPosition} \uD83C\uDF89`);
                    }
                }
                
                setTimeout(() => {
                    updateTokenPosition(data.player, data.newPosition);
                    if (token) {
                        token.classList.remove('effect-snake');
                        token.classList.remove('effect-ladder');
                    }
                }, 800); 
                
            }, 600); 
            
        } else {
            updateTokenPosition(data.player, data.newPosition);
        }

    }, 500);
}

function handleBoardUpdate(data) {
    log('--- \u26A0\uFE0F CHAOS MODE: Board Shuffled! \u26A0\uFE0F ---');
    
    appState.snakes = data.board.snakes;
    appState.ladders = data.board.ladders;
    
    renderBoard();
    
    // Reset timer
    startChaosTimer(); 

    Object.keys(appState.players).forEach(pid => {
        createPlayerToken(pid, appState.players[pid].color, appState.players[pid].position);
        updateTokenPosition(pid, appState.players[pid].position);
    });
    
    drawOverlay();
    
    if (data.forcedMoves && data.forcedMoves.length > 0) {
        data.forcedMoves.forEach(move => {
            const name = appState.players[move.player].nickname;
            const token = document.getElementById(`token-${move.player}`);
            
            if (token) {
                if (move.effect === "snake") {
                     token.classList.add('effect-snake');
                     log(`${name} was caught by a new Snake! Fell to ${move.newPosition}`);
                } else {
                     token.classList.add('effect-ladder');
                     log(`${name} found a new Ladder! Rose to ${move.newPosition}`);
                }
                
                setTimeout(() => {
                    updateTokenPosition(move.player, move.newPosition);
                    token.classList.remove('effect-snake');
                    token.classList.remove('effect-ladder');
                }, 800);
            }
        });
    }
}

// Timer Logic
function startChaosTimer() {
    if (appState.chaosTimer) clearInterval(appState.chaosTimer);
    
    let timeLeft = 60;
    ui.chaosTimer.textContent = timeLeft;
    
    appState.chaosTimer = setInterval(() => {
        timeLeft--;
        ui.chaosTimer.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(appState.chaosTimer);
             // Safety: waits for server to send new board, which calls startChaosTimer() again
        }
    }, 1000);
}

function stopChaosTimer() {
    if (appState.chaosTimer) clearInterval(appState.chaosTimer);
}

function log(msg) {
    const div = document.createElement('div');
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    ui.log.prepend(div);
}

window.addEventListener('resize', () => {
    if (appState.inGame) {
        renderBoard();
        Object.keys(appState.players).forEach(pid => {
            updateTokenPosition(pid, appState.players[pid].position);
        });
        drawOverlay();
    }
});


