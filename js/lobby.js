// Lobby Logic
let selectedPlayers = [];
let allPlayers = []; // Store all players for nickname validation

function renderLobby(players) {
    allPlayers = players; // Store for validation
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
                if (selectedPlayers.length < 7) {
                    selectedPlayers.push(p.id);
                    li.classList.add('selected');
                }
            }
            updateCreateButton();
        };

        ui.onlineList.appendChild(li);
    });

    if (others.length === 0) {
        ui.onlineList.innerHTML = '<li style="pointer-events:none; text-align:center; color:#64748b;">No other players online yet...</li>';
    }
    updateCreateButton();
}

function updateCreateButton() {
    ui.createGameBtn.disabled = selectedPlayers.length === 0;
}

function resetLobbySelection() {
    selectedPlayers = [];
    updateCreateButton();
}

// Lobby Event Listeners
ui.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = ui.nicknameInput.value.trim();
    if (name) {
        try {
            await connectToServer(name);
            // Server will respond with lobby_list if successful, or error if nickname taken
        } catch (error) {
            alert('Could not connect to server. Please try again.');
            updateLoginButton(false);
        }
    }
});

ui.createGameBtn.addEventListener('click', () => {
    if (selectedPlayers.length > 0) {
        socket.send(JSON.stringify({
            type: 'send_invite',
            targets: selectedPlayers
        }));
        ui.createGameBtn.disabled = true;
    }
});

// === NICKNAME EDITING ===

document.getElementById('edit-nickname-btn')?.addEventListener('click', () => {
    document.getElementById('nickname-display').classList.add('hidden');
    document.getElementById('nickname-edit').classList.remove('hidden');
    document.getElementById('new-nickname').value = appState.nickname || '';
    document.getElementById('new-nickname').focus();
});

document.getElementById('cancel-nickname-btn')?.addEventListener('click', () => {
    document.getElementById('nickname-display').classList.remove('hidden');
    document.getElementById('nickname-edit').classList.add('hidden');
});

document.getElementById('save-nickname-btn')?.addEventListener('click', () => {
    const newName = document.getElementById('new-nickname').value.trim();

    if (!newName) {
        alert('Name cannot be empty!');
        return;
    }

    if (newName.length > 12) {
        alert('Name too long (max 12 characters)!');
        return;
    }

    // Check if name is taken by another player
    const nameTaken = allPlayers.some(p =>
        p.id !== appState.myId &&
        p.nickname.toLowerCase() === newName.toLowerCase()
    );

    if (nameTaken) {
        alert('This name is already taken!');
        return;
    }

    // Update nickname
    appState.nickname = newName;
    ui.myNickname.textContent = newName;
    socket.send(JSON.stringify({ type: 'set_nickname', nickname: newName }));

    // Hide edit mode
    document.getElementById('nickname-display').classList.remove('hidden');
    document.getElementById('nickname-edit').classList.add('hidden');
});

// Also allow Enter key to save
document.getElementById('new-nickname')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('save-nickname-btn').click();
    } else if (e.key === 'Escape') {
        document.getElementById('cancel-nickname-btn').click();
    }
});
