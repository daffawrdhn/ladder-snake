<?php
namespace LadderSnake;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use React\EventLoop\LoopInterface;

class GameServer implements MessageComponentInterface {
    protected $clients;
    protected $lobby;
    protected $rooms = []; 
    protected $clientRoomMap = [];
    protected $nicknames = [];
    protected $loop; // Event Loop

    public function __construct(LoopInterface $loop) {
        $this->loop = $loop;
        $this->clients = new \SplObjectStorage;
        $this->lobby = new Lobby();
    }

    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        echo "New connection! ({$conn->resourceId})\n";
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        $data = json_decode($msg, true);
        if (!$data) return;

        switch ($data["type"]) {
            case "set_nickname":
                $this->nicknames[$from->resourceId] = $data["nickname"] ?? "Guest_" . $from->resourceId;
                $this->lobby->addPlayer($from);
                $this->broadcastLobby();
                break;
                
            case "create_room":
                if (isset($data["targets"])) {
                    $players = [$from];
                    foreach ($data["targets"] as $targetId) {
                        foreach ($this->clients as $client) {
                            if ($client->resourceId == $targetId) {
                                $players[] = $client;
                                break;
                            }
                        }
                    }
                    
                    if (count($players) >= 2) {
                        $roomId = uniqid();
                        $playerNicknames = [];
                        foreach ($players as $p) {
                            $playerNicknames[$p->resourceId] = $this->nicknames[$p->resourceId];
                        }
                        
                        // Pass LOOP to GameRoom
                        $room = new GameRoom($roomId, $players, $playerNicknames, $this->loop);
                        $this->rooms[$roomId] = $room;
                        
                        foreach ($players as $p) {
                            $this->clientRoomMap[$p->resourceId] = $roomId;
                            $this->lobby->removePlayer($p);
                        }
                        $this->broadcastLobby(); 
                    }
                }
                break;
                
            case "roll_dice":
                if (isset($this->clientRoomMap[$from->resourceId])) {
                    $roomId = $this->clientRoomMap[$from->resourceId];
                    if (isset($this->rooms[$roomId])) {
                        $this->rooms[$roomId]->handleAction($from, ["action" => "roll_dice"]);
                    }
                }
                break;
        }
    }

    public function onClose(ConnectionInterface $conn) {
        $this->clients->detach($conn);
        unset($this->nicknames[$conn->resourceId]);
        $this->lobby->removePlayer($conn);
        
        if (isset($this->clientRoomMap[$conn->resourceId])) {
            $roomId = $this->clientRoomMap[$conn->resourceId];
            unset($this->clientRoomMap[$conn->resourceId]);
            if (isset($this->rooms[$roomId])) {
                $this->rooms[$roomId]->stopChaosTimer(); // Stop timer!
                $this->rooms[$roomId]->broadcast(["type" => "player_left", "message" => "A player disconnected. Game Over."]);
                unset($this->rooms[$roomId]);
            }
        }
        
        $this->broadcastLobby();
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "An error has occurred: {$e->getMessage()}\n";
        $conn->close();
    }
    
    private function broadcastLobby() {
        $list = [];
        foreach ($this->lobby->waitingPlayers as $conn) {
            $list[] = [
                "id" => $conn->resourceId,
                "nickname" => $this->nicknames[$conn->resourceId] ?? "Unknown"
            ];
        }
        
        foreach ($this->lobby->waitingPlayers as $conn) {
            $conn->send(json_encode([
                "type" => "lobby_list",
                "players" => $list,
                "me" => $conn->resourceId
            ]));
        }
    }
}
