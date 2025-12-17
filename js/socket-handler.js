// WebSocket Message Handler
// Note: This is now set up after connection is established

function setupSocketHandlers() {
    if (!socket) return;

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
            case 'lobby_list':
                appState.myId = data.me;

                // If this is initial login (pendingNickname exists)
                if (appState.pendingNickname) {
                    appState.nickname = appState.pendingNickname;
                    ui.myNickname.textContent = appState.nickname;
                    appState.pendingNickname = null;
                    updateLoginButton(false);
                }

                // Always render the lobby and ensure we're on lobby screen
                renderLobby(data.players);

                // If already connected and not in game, show lobby
                if (appState.nickname && !appState.inGame) {
                    showScreen('lobby');
                }
                break;

            case 'lobby_update':
                // Re-render lobby with updated players
                if (data.players) {
                    renderLobby(data.players);
                }
                break;

            case 'game_start':
                startGame(data);
                break;

            case 'turn_change':
                updateTurn(data.player);
                if (data.timeout) {
                    startTurnTimerUI(data.timeout);
                }
                break;

            case 'dice_roll':
                // Check if this was an auto-penalty roll
                if (data.auto) {
                    stopTurnTimerUI(); // Ensure timer stops
                    let msg = `⏳ Timeout! Auto-rolled ${data.roll}`;
                    if (data.penalty) {
                        msg += ` (-2 Penalty) = ${data.moveAmount}`;
                    }
                    log(msg, 'warning');
                } else {
                    stopTurnTimerUI();
                }

                handleDiceRoll(data);
                break;

            case 'board_update':
                handleBoardUpdate(data);
                break;

            case 'game_over':
                stopChaosTimer();
                const winnerId = data.winner;
                const winnerName = appState.players[winnerId].nickname;
                const myPlayerId = `Player_${appState.myId}`;
                const isWinner = (winnerId === myPlayerId);

                setTimeout(() => {
                    if (isWinner) {
                        showWinnerModal('You');
                    } else {
                        showLoserModal(winnerName);
                    }
                }, 1500);
                break;

            case 'player_left':
                if (appState.inGame) {
                    stopChaosTimer();
                    showDisconnectModal(data.playerName || 'A player');
                }
                break;

            case 'error':
                alert(data.message);
                // If we're still on login screen, reset button
                if (!appState.isConnected || appState.pendingNickname) {
                    updateLoginButton(false);
                    appState.pendingNickname = null;
                }
                break;

            case 'invite_received':
                showInvitePopup(data.hostId, data.hostName);
                break;

            case 'invite_status':
                updateInviteStatusPanel(data.statuses, data.canStart);
                break;

            case 'invite_cancelled':
                hideInvitePopup();
                hideInviteStatusPanel();
                break;

            case 'nickname_changed':
                // Confirmation that nickname was successfully changed
                appState.nickname = data.nickname;
                ui.myNickname.textContent = data.nickname;
                break;
        }
    };
}
