<?php
namespace LadderSnake;

use Ratchet\ConnectionInterface;

class Lobby {
    public $waitingPlayers = []; // SplObjectStorage or Array

    public function __construct() {
        $this->waitingPlayers = new \SplObjectStorage;
    }

    public function addPlayer(ConnectionInterface $conn) {
        $this->waitingPlayers->attach($conn);
        $this->broadcastLobbyState();
    }

    public function removePlayer(ConnectionInterface $conn) {
        $this->waitingPlayers->detach($conn);
        $this->broadcastLobbyState();
    }

    public function broadcastLobbyState() {
        $count = count($this->waitingPlayers);
        foreach ($this->waitingPlayers as $client) {
            $client->send(json_encode([
                "type" => "lobby_update",
                "count" => $count
            ]));
        }
    }

    // Attempt to match players
    // For simplicity, let"s support a "start_game" action from client, 
    // or just auto-match 2 players.
    // Requirement says "2/3/4 player to play".
    // Let"s implement "create_room" request.
}
