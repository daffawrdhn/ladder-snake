// Invite System Functions

function showInvitePopup(hostId, hostName) {
    appState.pendingInviteHostId = hostId;
    ui.inviteHostName.textContent = hostName;
    ui.invitePopup.classList.remove('hidden');
}

function hideInvitePopup() {
    appState.pendingInviteHostId = null;
    ui.invitePopup.classList.add('hidden');
}

function updateInviteStatusPanel(statuses, canStart) {
    ui.inviteStatusPanel.classList.remove('hidden');
    ui.inviteStatusList.innerHTML = '';

    const statusIcons = {
        pending: '⏳',
        accepted: '✅',
        declined: '❌'
    };

    statuses.forEach(s => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${s.nickname}</span>
            <span class="status-${s.status}">${statusIcons[s.status]} ${s.status.charAt(0).toUpperCase() + s.status.slice(1)}</span>
        `;
        ui.inviteStatusList.appendChild(li);
    });

    ui.startWithAcceptedBtn.disabled = !canStart;
}

function hideInviteStatusPanel() {
    ui.inviteStatusPanel.classList.add('hidden');
    ui.createGameBtn.disabled = false;
}

// Invite Button Event Listeners
ui.startWithAcceptedBtn.addEventListener('click', () => {
    socket.send(JSON.stringify({ type: 'start_game' }));
});

ui.cancelInviteBtn.addEventListener('click', () => {
    socket.send(JSON.stringify({ type: 'cancel_invite' }));
    hideInviteStatusPanel();
    selectedPlayers = [];
});

ui.acceptInviteBtn.addEventListener('click', () => {
    if (appState.pendingInviteHostId) {
        socket.send(JSON.stringify({
            type: 'accept_invite',
            hostId: appState.pendingInviteHostId
        }));
        hideInvitePopup();
    }
});

ui.declineInviteBtn.addEventListener('click', () => {
    if (appState.pendingInviteHostId) {
        socket.send(JSON.stringify({
            type: 'decline_invite',
            hostId: appState.pendingInviteHostId
        }));
        hideInvitePopup();
    }
});
