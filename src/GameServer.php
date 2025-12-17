<?php
namespace LadderSnake;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use React\EventLoop\LoopInterface;

class GameServer implements MessageComponentInterface
{
    protected $clients;
    protected $lobby;
    protected $rooms = [];
    protected $clientRoomMap = [];
    protected $nicknames = [];
    protected $loop;
    protected $pendingInvites = []; // [hostId => [targets => [...], accepted => [...], declined => [...]]]

    public function __construct(LoopInterface $loop)
    {
        $this->loop = $loop;
        $this->clients = new \SplObjectStorage;
        $this->lobby = new Lobby();
    }

    public function onOpen(ConnectionInterface $conn)
    {
        $this->clients->attach($conn);
        echo "New connection! ({$conn->resourceId})\n";
    }

    public function onMessage(ConnectionInterface $from, $msg)
    {
        $data = json_decode($msg, true);
        if (!$data)
            return;

        switch ($data["type"]) {
            case "set_nickname":
                $newNickname = $data["nickname"] ?? "Guest_" . $from->resourceId;

                // Check for duplicate nickname (case-insensitive)
                $isDuplicate = false;
                foreach ($this->nicknames as $existingId => $existingName) {
                    if (
                        $existingId !== $from->resourceId &&
                        strtolower($existingName) === strtolower($newNickname)
                    ) {
                        $isDuplicate = true;
                        break;
                    }
                }

                if ($isDuplicate) {
                    $from->send(json_encode([
                        "type" => "error",
                        "message" => "Nickname '$newNickname' is already taken! Please choose another."
                    ]));
                    return;
                }

                $this->nicknames[$from->resourceId] = $newNickname;
                $this->lobby->addPlayer($from);
                $this->broadcastLobby();
                break;

            case "request_lobby":
                // 1. Clean up old room connection
                if (isset($this->clientRoomMap[$from->resourceId])) {
                    $oldRoomId = $this->clientRoomMap[$from->resourceId];
                    // Note: We don't force close the room here, assumed game is over or player left.
                    // Just untrack the map
                    unset($this->clientRoomMap[$from->resourceId]);
                }

                // 2. Clean up any pending invites hosted by this player
                if (isset($this->pendingInvites[$from->resourceId])) {
                    // Start cleanup: notify all targets that invite is cancelled
                    foreach ($this->pendingInvites[$from->resourceId]["targets"] as $targetId) {
                        foreach ($this->clients as $client) {
                            if ($client->resourceId == $targetId) {
                                $client->send(json_encode([
                                    "type" => "invite_cancelled",
                                    "reason" => "Host returned to lobby"
                                ]));
                                break;
                            }
                        }
                    }
                    unset($this->pendingInvites[$from->resourceId]);
                }

                // 3. Add to lobby and broadcast
                $this->lobby->addPlayer($from);
                $this->broadcastLobby();
                break;

            case "send_invite":
                if (isset($data["targets"]) && count($data["targets"]) > 0) {
                    $hostId = $from->resourceId;
                    $hostName = $this->nicknames[$hostId] ?? "Unknown";

                    $this->pendingInvites[$hostId] = [
                        "targets" => $data["targets"],
                        "accepted" => [],
                        "declined" => []
                    ];

                    // Notify all targets
                    foreach ($data["targets"] as $targetId) {
                        foreach ($this->clients as $client) {
                            if ($client->resourceId == $targetId) {
                                $client->send(json_encode([
                                    "type" => "invite_received",
                                    "hostId" => $hostId,
                                    "hostName" => $hostName
                                ]));
                                break;
                            }
                        }
                    }

                    // Send status update to host
                    $this->sendInviteStatus($from);
                }
                break;

            case "accept_invite":
                $hostId = $data["hostId"];
                $playerId = $from->resourceId;

                if (isset($this->pendingInvites[$hostId])) {
                    $this->pendingInvites[$hostId]["accepted"][] = $playerId;

                    // Notify host
                    $this->sendInviteStatusToHost($hostId);

                    // Check if all accepted
                    $targets = $this->pendingInvites[$hostId]["targets"];
                    $accepted = $this->pendingInvites[$hostId]["accepted"];
                    $declined = $this->pendingInvites[$hostId]["declined"];

                    if (count($accepted) + count($declined) === count($targets) && count($accepted) > 0) {
                        $this->startGameWithAccepted($hostId);
                    }
                }
                break;

            case "decline_invite":
                $hostId = $data["hostId"];
                $playerId = $from->resourceId;

                if (isset($this->pendingInvites[$hostId])) {
                    $this->pendingInvites[$hostId]["declined"][] = $playerId;

                    // Notify host
                    $this->sendInviteStatusToHost($hostId);
                }
                break;

            case "start_game":
                $hostId = $from->resourceId;
                if (isset($this->pendingInvites[$hostId])) {
                    $this->startGameWithAccepted($hostId);
                }
                break;

            case "cancel_invite":
                $hostId = $from->resourceId;
                if (isset($this->pendingInvites[$hostId])) {
                    // Notify targets that invite was cancelled
                    foreach ($this->pendingInvites[$hostId]["targets"] as $targetId) {
                        foreach ($this->clients as $client) {
                            if ($client->resourceId == $targetId) {
                                $client->send(json_encode(["type" => "invite_cancelled"]));
                                break;
                            }
                        }
                    }
                    unset($this->pendingInvites[$hostId]);
                    $from->send(json_encode(["type" => "invite_cancelled"]));
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

    private function sendInviteStatus(ConnectionInterface $host)
    {
        $hostId = $host->resourceId;
        if (!isset($this->pendingInvites[$hostId]))
            return;

        $invite = $this->pendingInvites[$hostId];
        $statuses = [];

        foreach ($invite["targets"] as $targetId) {
            $status = "pending";
            if (in_array($targetId, $invite["accepted"]))
                $status = "accepted";
            if (in_array($targetId, $invite["declined"]))
                $status = "declined";

            $statuses[] = [
                "id" => $targetId,
                "nickname" => $this->nicknames[$targetId] ?? "Unknown",
                "status" => $status
            ];
        }

        $host->send(json_encode([
            "type" => "invite_status",
            "statuses" => $statuses,
            "canStart" => count($invite["accepted"]) >= 1
        ]));
    }

    private function sendInviteStatusToHost($hostId)
    {
        foreach ($this->clients as $client) {
            if ($client->resourceId == $hostId) {
                $this->sendInviteStatus($client);
                break;
            }
        }
    }

    private function startGameWithAccepted($hostId)
    {
        if (!isset($this->pendingInvites[$hostId]))
            return;

        $accepted = $this->pendingInvites[$hostId]["accepted"];
        if (count($accepted) < 1)
            return;

        $players = [];
        $playerNicknames = [];

        // Find host connection
        foreach ($this->clients as $client) {
            if ($client->resourceId == $hostId) {
                $players[] = $client;
                $playerNicknames[$hostId] = $this->nicknames[$hostId];
                break;
            }
        }

        // Find accepted players
        foreach ($accepted as $playerId) {
            foreach ($this->clients as $client) {
                if ($client->resourceId == $playerId) {
                    $players[] = $client;
                    $playerNicknames[$playerId] = $this->nicknames[$playerId];
                    break;
                }
            }
        }

        if (count($players) >= 2) {
            $roomId = uniqid();
            $room = new GameRoom($roomId, $players, $playerNicknames, $this->loop);
            $this->rooms[$roomId] = $room;

            foreach ($players as $p) {
                $this->clientRoomMap[$p->resourceId] = $roomId;
                $this->lobby->removePlayer($p);
            }

            unset($this->pendingInvites[$hostId]);
            $this->broadcastLobby();
        }
    }

    public function onClose(ConnectionInterface $conn)
    {
        $this->clients->detach($conn);
        unset($this->nicknames[$conn->resourceId]);
        unset($this->pendingInvites[$conn->resourceId]);
        $this->lobby->removePlayer($conn);

        if (isset($this->clientRoomMap[$conn->resourceId])) {
            $roomId = $this->clientRoomMap[$conn->resourceId];
            unset($this->clientRoomMap[$conn->resourceId]);
            if (isset($this->rooms[$roomId])) {
                $this->rooms[$roomId]->stopChaosTimer();
                $this->rooms[$roomId]->broadcast(["type" => "player_left", "message" => "A player disconnected. Game Over."]);
                unset($this->rooms[$roomId]);
            }
        }

        $this->broadcastLobby();
    }

    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        echo "An error has occurred: {$e->getMessage()}\n";
        $conn->close();
    }

    private function broadcastLobby()
    {
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
