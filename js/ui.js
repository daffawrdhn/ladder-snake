// DOM Element References
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
    // Game elements
    gamePlayers: document.getElementById('game-player-list'),
    board: document.getElementById('board'),
    overlay: document.getElementById('board-overlay'),
    dice: document.getElementById('dice'),
    rollBtn: document.getElementById('roll-btn'),
    log: document.getElementById('game-log'),
    turnIndicator: document.getElementById('turn-indicator'),
    chaosTimer: document.getElementById('chaos-timer'),
    turnTimer: document.getElementById('turn-timer'), // New Timer
    // Bottom Sheets
    playersSheet: document.getElementById('players-sheet'),
    logSheet: document.getElementById('log-sheet'),
    sheetOverlay: document.getElementById('sheet-overlay'),
    togglePlayersBtn: document.getElementById('toggle-players-btn'),
    toggleLogBtn: document.getElementById('toggle-log-btn'),
    closeSheetBtns: document.querySelectorAll('.close-sheet'),
    // Invite system
    inviteStatusPanel: document.getElementById('invite-status-panel'),
    inviteStatusList: document.getElementById('invite-status-list'),
    startWithAcceptedBtn: document.getElementById('start-with-accepted-btn'),
    cancelInviteBtn: document.getElementById('cancel-invite-btn'),
    invitePopup: document.getElementById('invite-popup'),
    inviteHostName: document.getElementById('invite-host-name'),
    acceptInviteBtn: document.getElementById('accept-invite-btn'),
    declineInviteBtn: document.getElementById('decline-invite-btn')
};

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function log(msg, type = 'info') {
    const div = document.createElement('div');
    div.className = `log-entry log-${type}`;
    div.textContent = msg;
    ui.log.prepend(div);

    // Auto-scroll to show newest log at top
    ui.log.scrollTop = 0;
}

// === SHEET TOGGLE LOGIC ===
function toggleSheet(sheet) {
    const isOpen = sheet.classList.contains('open');
    // Close all first
    closeAllSheets();

    if (!isOpen) {
        sheet.classList.remove('hidden'); // Remove hidden first!
        sheet.classList.add('open');
        ui.sheetOverlay.classList.remove('hidden');
        ui.sheetOverlay.classList.add('active');
    }
}

function closeAllSheets() {
    ui.playersSheet.classList.remove('open');
    ui.logSheet.classList.remove('open');
    ui.sheetOverlay.classList.remove('active');
    // Add hidden back after animation
    setTimeout(() => {
        if (!ui.playersSheet.classList.contains('open')) {
            ui.playersSheet.classList.add('hidden');
        }
        if (!ui.logSheet.classList.contains('open')) {
            ui.logSheet.classList.add('hidden');
        }
        if (!ui.sheetOverlay.classList.contains('active')) {
            ui.sheetOverlay.classList.add('hidden');
        }
    }, 350); // Match animation duration
}

if (ui.togglePlayersBtn) {
    ui.togglePlayersBtn.addEventListener('click', () => toggleSheet(ui.playersSheet));
}

if (ui.toggleLogBtn) {
    ui.toggleLogBtn.addEventListener('click', () => toggleSheet(ui.logSheet));
}

if (ui.sheetOverlay) {
    ui.sheetOverlay.addEventListener('click', closeAllSheets);
}

ui.closeSheetBtns.forEach(btn => {
    btn.addEventListener('click', closeAllSheets);
});

// === TURN TIMER ===
// Simple client-side countdown for visual feedback.
// Exact sync relies on server events, but this provides UX.
let turnTimerInterval;

function startTurnTimerUI(duration = 15) {
    if (turnTimerInterval) clearInterval(turnTimerInterval);

    let timeLeft = duration;
    ui.turnTimer.textContent = timeLeft + 's';
    ui.turnTimer.classList.remove('text-danger');

    turnTimerInterval = setInterval(() => {
        timeLeft--;
        ui.turnTimer.textContent = timeLeft + 's';

        if (timeLeft <= 5) {
            ui.turnTimer.classList.add('text-danger');
            // Flash effect?
        }

        if (timeLeft <= 0) {
            clearInterval(turnTimerInterval);
            ui.turnTimer.textContent = '0s';
        }
    }, 1000);
}

function stopTurnTimerUI() {
    if (turnTimerInterval) clearInterval(turnTimerInterval);
    ui.turnTimer.textContent = '--';
}
