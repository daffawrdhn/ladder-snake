// Game Board and Gameplay Logic

// Animation tracking - prevents roll until piece movement completes
let isAnimating = false;

// Simple dice update function
function updateDiceDisplay(value) {
    ui.dice.textContent = value;
}


function startGame(data) {
    appState.inGame = true;
    appState.snakes = data.board.snakes;
    appState.ladders = data.board.ladders;
    appState.players = {};

    ui.gamePlayers.innerHTML = '';

    data.players.forEach((pid, index) => {
        const nickname = data.nicknames[pid] || pid;
        const isMe = (pid === `Player_${appState.myId}`);
        const displayName = isMe ? 'You' : nickname;

        appState.players[pid] = {
            id: pid,
            color: data.colors[pid],
            nickname: nickname,
            displayName: displayName,
            position: 1
        };

        const li = document.createElement('li');
        li.id = `player-li-${pid}`;
        li.textContent = `${displayName} (Pos: 1)`;
        li.style.borderLeft = `4px solid ${data.colors[pid]}`;
        li.style.paddingLeft = '10px';
        if (isMe) li.style.fontWeight = 'bold';
        ui.gamePlayers.appendChild(li);
    });

    showScreen('game');

    // Show initiative roll animation FIRST
    showInitiativeRolls(data.initiative, data.players, () => {
        // After animation, render board and start timer
        startChaosTimer();
        renderBoard();
        data.players.forEach((pid) => {
            createPlayerToken(pid, data.colors[pid], 1);
        });
        drawOverlay();
        log('🎮 Game started! Good luck!', 'success');
    });
}

// Initiative Roll Animation
function showInitiativeRolls(initiative, playerOrder, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'initiative-overlay';
    overlay.innerHTML = `
        <div class="initiative-content">
            <h2>🎲 Rolling for Turn Order!</h2>
            <div id="initiative-rolls"></div>
            <div id="initiative-result" class="hidden"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    const rollsContainer = document.getElementById('initiative-rolls');
    const resultContainer = document.getElementById('initiative-result');

    // Sort by total (highest first) for display order
    const sortedPlayers = Object.keys(initiative).sort((a, b) =>
        initiative[b].total - initiative[a].total
    );

    let playerIndex = 0;

    function animateNextPlayer() {
        if (playerIndex >= sortedPlayers.length) {
            // Show final order
            setTimeout(() => {
                showFinalOrder();
            }, 500);
            return;
        }

        const pid = sortedPlayers[playerIndex];
        const info = initiative[pid];
        const player = appState.players[pid];
        const isMe = (pid === `Player_${appState.myId}`);
        const displayName = isMe ? 'You' : player.nickname;

        const rollDiv = document.createElement('div');
        rollDiv.className = 'initiative-roll-item';
        rollDiv.innerHTML = `
            <span class="player-name" style="color: ${player.color}">${displayName}</span>
            <span class="dice-container">
                <span class="die rolling">?</span>
                <span class="die rolling">?</span>
                <span class="die rolling">?</span>
            </span>
            <span class="roll-total">...</span>
        `;
        rollsContainer.appendChild(rollDiv);

        const dice = rollDiv.querySelectorAll('.die');
        const totalSpan = rollDiv.querySelector('.roll-total');

        // Animate each die
        let dieIndex = 0;
        const dieInterval = setInterval(() => {
            if (dieIndex < 3) {
                dice[dieIndex].classList.remove('rolling');
                dice[dieIndex].textContent = info.rolls[dieIndex];
                dice[dieIndex].classList.add('revealed');
                dieIndex++;
            } else {
                clearInterval(dieInterval);
                totalSpan.textContent = `= ${info.total}`;
                totalSpan.classList.add('revealed');
                playerIndex++;
                setTimeout(animateNextPlayer, 600);
            }
        }, 300);
    }

    function showFinalOrder() {
        resultContainer.classList.remove('hidden');
        resultContainer.innerHTML = `
            <h3>📋 Turn Order</h3>
            <ol>
                ${sortedPlayers.map((pid, i) => {
            const player = appState.players[pid];
            const isMe = (pid === `Player_${appState.myId}`);
            const displayName = isMe ? 'You' : player.nickname;
            return `<li style="color: ${player.color}">${i === 0 ? '👑 ' : ''}${displayName}</li>`;
        }).join('')}
            </ol>
        `;

        setTimeout(() => {
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.remove();
                callback();
            }, 500);
        }, 2000);
    }

    setTimeout(animateNextPlayer, 500);
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

            if (appState.snakes[num]) cell.innerHTML += '<br>🐍↘';
            if (appState.ladders[num]) cell.innerHTML += '<br>🪜↗';

            ui.board.appendChild(cell);
        }
    }
}

function createPlayerToken(pid, color, position) {
    const token = document.createElement('div');
    token.className = 'player-token';
    token.id = `token-${pid}`;
    token.style.backgroundColor = color;
    token.title = appState.players[pid].nickname;
    ui.board.appendChild(token);
    updateTokenPosition(pid, position);
}

function updateTokenPosition(pid, pos) {
    const token = document.getElementById(`token-${pid}`);
    if (token) {
        const cell = document.getElementById(`cell-${pos}`);
        if (cell) {
            const top = cell.offsetTop + (cell.offsetHeight / 2) - (token.offsetHeight / 2);
            const left = cell.offsetLeft + (cell.offsetWidth / 2) - (token.offsetWidth / 2);
            token.style.top = `${top}px`;
            token.style.left = `${left}px`;
        }
        appState.players[pid].position = pos;
        const li = document.getElementById(`player-li-${pid}`);
        if (li) li.textContent = `${appState.players[pid].displayName} (Pos: ${pos})`;
        updatePlayerListOrder();
    }
}

function updatePlayerListOrder() {
    const playerList = ui.gamePlayers;
    const items = Array.from(playerList.children);
    items.sort((a, b) => {
        const pidA = a.id.replace('player-li-', '');
        const pidB = b.id.replace('player-li-', '');
        const posA = appState.players[pidA]?.position || 0;
        const posB = appState.players[pidB]?.position || 0;
        return posB - posA;
    });
    items.forEach(item => playerList.appendChild(item));
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
    ctx.arc(startX, startY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(endX, endY, 4, 0, Math.PI * 2);
    ctx.fill();
}

function updateTurn(pid) {
    const player = appState.players[pid];
    const name = player ? player.nickname : pid;
    const isMe = (pid === `Player_${appState.myId}`);
    ui.turnIndicator.textContent = isMe ? "Your Turn!" : `Waiting for ${name}...`;
    ui.turnIndicator.style.color = isMe ? "#4ade80" : "#94a3b8";

    // Disable roll button if animating or not my turn
    ui.rollBtn.disabled = !isMe || isAnimating;

    // Store pending turn to enable button after animation completes
    appState.pendingTurn = pid;
}

function handleDiceRoll(data) {
    // Start animation - block rolls until complete
    isAnimating = true;
    ui.rollBtn.disabled = true;

    const diceDisplay = ui.dice.parentElement;
    diceDisplay.classList.add('rolling');
    setTimeout(() => {
        diceDisplay.classList.remove('rolling');

        // Simple dice number update
        updateDiceDisplay(data.roll);

        const name = appState.players[data.player].nickname;
        const currentPos = appState.players[data.player].position;

        // Use manual moveAmount if provided (penalty logic), otherwise use roll
        const moveDist = data.moveAmount !== undefined ? data.moveAmount : data.roll;

        let intermediatePos = currentPos + moveDist;

        if (intermediatePos > 100) {
            intermediatePos = 100 - (intermediatePos - 100);
        }

        log(`🎲 ${name} rolled ${data.roll} → moved ${moveDist} steps to ${intermediatePos}`, 'info');

        const isSnake = appState.snakes[intermediatePos] !== undefined;
        const isLadder = appState.ladders[intermediatePos] !== undefined;

        if (isSnake || isLadder) {
            updateTokenPosition(data.player, intermediatePos);
            setTimeout(() => {
                const token = document.getElementById(`token-${data.player}`);
                if (token) {
                    if (isSnake) {
                        token.classList.add('effect-snake');
                        log(`🐍 ${name} hit a Snake! Down to ${data.newPosition}`, 'danger');
                    } else {
                        token.classList.add('effect-ladder');
                        log(`🪜 ${name} climbed a Ladder! Up to ${data.newPosition}`, 'success');
                    }
                }
                setTimeout(() => {
                    updateTokenPosition(data.player, data.newPosition);
                    if (token) {
                        token.classList.remove('effect-snake');
                        token.classList.remove('effect-ladder');
                    }
                    // Animation complete - allow next roll
                    finishAnimation();
                }, 800);
            }, 600);
        } else {
            updateTokenPosition(data.player, data.newPosition);
            // Simple move complete - allow next roll after brief delay
            setTimeout(() => finishAnimation(), 400);
        }
    }, 500);
}

// Called when piece animation completes
function finishAnimation() {
    isAnimating = false;
    // Re-enable roll button if it's my turn
    const isMyTurn = appState.pendingTurn === `Player_${appState.myId}`;
    if (isMyTurn) {
        ui.rollBtn.disabled = false;
    }
}

function handleBoardUpdate(data) {
    log('⚠️ CHAOS MODE: Board Shuffled!', 'warning');
    appState.snakes = data.board.snakes;
    appState.ladders = data.board.ladders;

    if (data.players) {
        Object.keys(data.players).forEach(pid => {
            if (appState.players[pid]) {
                appState.players[pid].position = data.players[pid];
            }
        });
    }

    renderBoard();
    startChaosTimer();

    Object.keys(appState.players).forEach(pid => {
        const pos = appState.players[pid].position;
        createPlayerToken(pid, appState.players[pid].color, pos);
    });

    drawOverlay();

    if (data.forcedMoves && data.forcedMoves.length > 0) {
        data.forcedMoves.forEach(move => {
            const name = appState.players[move.player].nickname;
            const token = document.getElementById(`token-${move.player}`);
            if (token) {
                if (move.effect === "snake") {
                    token.classList.add('effect-snake');
                    log(`🐍 ${name} caught by new Snake! Fell to ${move.newPosition}`, 'danger');
                } else {
                    token.classList.add('effect-ladder');
                    log(`🪜 ${name} found new Ladder! Rose to ${move.newPosition}`, 'success');
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
        }
    }, 1000);
}

function stopChaosTimer() {
    if (appState.chaosTimer) clearInterval(appState.chaosTimer);
}

// Roll Button
ui.rollBtn.addEventListener('click', () => {
    ui.rollBtn.disabled = true;
    socket.send(JSON.stringify({ type: 'roll_dice' }));
});

// Resize Handler
window.addEventListener('resize', () => {
    if (appState.inGame) {
        renderBoard();
        Object.keys(appState.players).forEach(pid => {
            const pos = appState.players[pid].position;
            createPlayerToken(pid, appState.players[pid].color, pos);
        });
        drawOverlay();
    }
});
