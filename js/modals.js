// Winner and Loser Modals

function showWinnerModal(winnerName) {
    const modal = document.getElementById('winner-modal');
    const nameElement = document.getElementById('winner-name');
    nameElement.textContent = winnerName;
    modal.classList.remove('hidden');
    createConfetti();
}

function createConfetti() {
    const container = document.getElementById('confetti-container');
    const colors = ['#fbbf24', '#f59e0b', '#6366f1', '#f43f5e', '#22c55e', '#3b82f6', '#ec4899', '#8b5cf6'];
    const shapes = ['square', 'circle'];

    for (let i = 0; i < 150; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';

            const color = colors[Math.floor(Math.random() * colors.length)];
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            const size = Math.random() * 10 + 5;
            const left = Math.random() * 100;
            const duration = Math.random() * 2 + 2;
            const delay = Math.random() * 0.5;

            confetti.style.backgroundColor = color;
            confetti.style.width = `${size}px`;
            confetti.style.height = `${size}px`;
            confetti.style.left = `${left}%`;
            confetti.style.borderRadius = shape === 'circle' ? '50%' : '2px';
            confetti.style.animationDuration = `${duration}s`;
            confetti.style.animationDelay = `${delay}s`;

            container.appendChild(confetti);

            setTimeout(() => {
                confetti.remove();
            }, (duration + delay) * 1000);
        }, i * 20);
    }
}

function showLoserModal(winnerName) {
    const modal = document.getElementById('loser-modal');
    const nameElement = document.getElementById('loser-winner-name');
    nameElement.textContent = winnerName;
    modal.classList.remove('hidden');
}

function showDisconnectModal(playerName) {
    const modal = document.getElementById('disconnect-modal');
    const nameElement = document.getElementById('disconnect-player-name');
    nameElement.textContent = playerName || 'A player';
    modal.classList.remove('hidden');
}

function backToLobby() {
    // Hide all modals
    document.getElementById('winner-modal')?.classList.add('hidden');
    document.getElementById('loser-modal')?.classList.add('hidden');
    document.getElementById('disconnect-modal')?.classList.add('hidden');

    // Reset game state
    appState.inGame = false;
    stopChaosTimer();

    // Clear board
    ui.board.innerHTML = '';
    ui.log.innerHTML = '';

    // Reset invite and lobby state
    hideInvitePopup();
    hideInviteStatusPanel();
    if (typeof resetLobbySelection === 'function') {
        resetLobbySelection();
    }

    // Go back to lobby
    showScreen('lobby');

    // Request fresh lobby list
    socket.send(JSON.stringify({ type: 'request_lobby' }));
}
