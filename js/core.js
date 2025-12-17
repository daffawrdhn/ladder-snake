// Socket connection and state management
let socket = null;

const appState = {
    nickname: null,
    pendingNickname: null,
    inGame: false,
    players: {},
    myId: null,
    snakes: {},
    ladders: {},
    chaosTimer: null,
    pendingInviteHostId: null,
    isConnecting: false,
    isConnected: false
};

// Connect to WebSocket server
function connectToServer(nickname) {
    return new Promise((resolve, reject) => {
        // If already connected, just send the new nickname
        if (socket && socket.readyState === WebSocket.OPEN) {
            appState.pendingNickname = nickname;
            updateLoginButton(true);
            socket.send(JSON.stringify({ type: 'set_nickname', nickname: nickname }));
            resolve();
            return;
        }

        appState.isConnecting = true;
        updateLoginButton(true);

        socket = new WebSocket('ws://localhost:8080');

        socket.onopen = () => {
            console.log('Connected to server');
            appState.isConnecting = false;
            appState.isConnected = true;
            appState.pendingNickname = nickname;

            // Setup message handlers
            setupSocketHandlers();

            // Send nickname to server
            socket.send(JSON.stringify({ type: 'set_nickname', nickname: nickname }));
            resolve();
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            appState.isConnecting = false;
            updateLoginButton(false);
            reject(new Error('Could not connect to server'));
        };

        socket.onclose = () => {
            console.log('Disconnected from server');
            appState.isConnected = false;
            appState.isConnecting = false;
        };
    });
}

function updateLoginButton(isLoading) {
    const btn = document.querySelector('#login-form .btn-primary');
    if (btn) {
        if (isLoading) {
            btn.disabled = true;
            btn.innerHTML = '<span class="loading-spinner"></span> Connecting...';
        } else {
            btn.disabled = false;
            btn.textContent = 'Enter Lobby';
        }
    }
}
