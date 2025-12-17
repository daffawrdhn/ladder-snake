<?php
namespace LadderSnake;

use Ratchet\ConnectionInterface;
use React\EventLoop\LoopInterface;

class GameRoom
{
    public $id;
    public $clients;
    public $gameState;
    public $playerMap = [];
    public $nicknames = [];
    public $loop;
    public $chaosTimer;

    public function __construct($id, array $clients, array $nicknames, LoopInterface $loop)
    {
        $this->id = $id;
        $this->clients = $clients;
        $this->nicknames = $nicknames;
        $this->loop = $loop;

        $playerIds = [];
        foreach ($clients as $client) {
            $pid = "Player_" . $client->resourceId;
            $this->playerMap[$client->resourceId] = $pid;
            $playerIds[] = $pid;
        }

        $this->gameState = new GameState($playerIds);

        $initiative = [];
        foreach ($playerIds as $pid) {
            $rolls = [];
            $total = 0;
            for ($i = 0; $i < 3; $i++) {
                $r = rand(1, 6);
                $rolls[] = $r;
                $total += $r;
            }
            $initiative[$pid] = ["rolls" => $rolls, "total" => $total];
        }

        usort($playerIds, function ($a, $b) use ($initiative) {
            return $initiative[$b]["total"] <=> $initiative[$a]["total"];
        });

        $this->gameState->setTurnOrder($playerIds);

        $clientNicknames = [];
        foreach ($this->playerMap as $rid => $pid) {
            $clientNicknames[$pid] = $this->nicknames[$rid];
        }

        $this->broadcast([
            "type" => "game_start",
            "roomId" => $id,
            "players" => $playerIds,
            "nicknames" => $clientNicknames,
            "colors" => $this->gameState->playerColors,
            "board" => [
                "snakes" => $this->gameState->snakes,
                "ladders" => $this->gameState->ladders
            ],
            "initiative" => $initiative
        ]);

        $this->broadcastTurn();

        // Start Chaos Timer (60s)
        $this->chaosTimer = $this->loop->addPeriodicTimer(60, function () {
            $this->handleChaosParams();
        });
    }

    public function stopChaosTimer()
    {
        if ($this->chaosTimer) {
            $this->loop->cancelTimer($this->chaosTimer);
        }
    }

    private function handleChaosParams()
    {
        $this->gameState->regenerateBoard();

        $forcedMoves = [];
        // Check for any players on new snakes/ladders
        foreach ($this->gameState->players as $pid => $pos) {
            // We need to check if the CURRENT pos triggers something NOW (without move)
            // GameState->movePlayer does dice + logic.
            // We need a special check function.
            $result = $this->gameState->checkPositionEffect($pid);
            if ($result) {
                $forcedMoves[] = [
                    "player" => $pid,
                    "newPosition" => $result["newPos"],
                    "effect" => $result["effect"]
                ];
            }
        }

        $this->broadcast([
            "type" => "board_update",
            "message" => "Chaos Mode! Board Shuffled!",
            "board" => [
                "snakes" => $this->gameState->snakes,
                "ladders" => $this->gameState->ladders
            ],
            "players" => $this->gameState->players, // Include current player positions
            "forcedMoves" => $forcedMoves
        ]);

        if ($this->gameState->winner) {
            $this->broadcast([
                "type" => "game_over",
                "winner" => $this->gameState->winner
            ]);
            $this->stopChaosTimer();
        }
    }

    public $turnTimer;

    // ... existing broadcastTurn ...
    private function broadcastTurn()
    {
        $currentPlayerId = $this->gameState->getCurrentPlayerId();
        $this->broadcast([
            "type" => "turn_change",
            "player" => $currentPlayerId,
            "timeout" => 15 // Inform client about duration
        ]);

        $this->startTurnTimer();
    }

    // Start 15s timer for the current turn
    private function startTurnTimer()
    {
        $this->stopTurnTimer(); // Clear existing if any

        $this->turnTimer = $this->loop->addTimer(15, function () {
            $this->handleTurnTimeout();
        });
    }

    // Stop the turn timer
    private function stopTurnTimer()
    {
        if ($this->turnTimer) {
            $this->loop->cancelTimer($this->turnTimer);
            $this->turnTimer = null;
        }
    }

    // Handle timeout: Auto-roll with penalty
    private function handleTurnTimeout()
    {
        echo "Turn timeout for room {$this->id}\n";

        $currentPlayerId = $this->gameState->getCurrentPlayerId();

        // Auto-roll dice logic
        $roll = rand(1, 6);
        $moveAmount = $roll;
        $penaltyApplied = false;

        // Apply penalty if roll > 3
        if ($roll > 3) {
            // Requirement: "kurangi 2 langkah" -> roll 5 becomes 3. roll 4 becomes 2.
            $moveAmount = max(1, $roll - 2);
            $penaltyApplied = true;
        }

        // Apply move manually
        $newPos = $this->gameState->movePlayer($currentPlayerId, $moveAmount);

        $this->broadcast([
            "type" => "dice_roll",
            "player" => $currentPlayerId,
            "roll" => $roll, // Show original roll
            "moveAmount" => $moveAmount, // Show effective move
            "penalty" => $penaltyApplied, // Flag for UI to show "Penalty!"
            "auto" => true, // Flag for UI to show "Auto-roll"
            "newPosition" => $newPos,
            "snakes" => $this->gameState->snakes,
            "ladders" => $this->gameState->ladders
        ]);

        if ($this->gameState->winner) {
            $this->broadcast([
                "type" => "game_over",
                "winner" => $this->gameState->winner
            ]);
            $this->stopChaosTimer();
            $this->stopTurnTimer();
        } else {
            $this->gameState->nextTurn();
            $this->broadcastTurn();
        }
    }

    public function handleAction(ConnectionInterface $from, $data)
    {
        $playerId = $this->playerMap[$from->resourceId];
        $currentPlayerId = $this->gameState->getCurrentPlayerId();

        if ($playerId !== $currentPlayerId) {
            $from->send(json_encode(["type" => "error", "message" => "Not your turn!"]));
            return;
        }

        if ($data["action"] === "roll_dice") {
            $this->stopTurnTimer(); // Stop timer on valid action

            $roll = $this->gameState->rollDice();
            $newPos = $this->gameState->movePlayer($playerId);

            $this->broadcast([
                "type" => "dice_roll",
                "player" => $playerId,
                "roll" => $roll,
                "newPosition" => $newPos,
                "snakes" => $this->gameState->snakes,
                "ladders" => $this->gameState->ladders
            ]);

            if ($this->gameState->winner) {
                // ... existing winner logic ...
                $this->broadcast([
                    "type" => "game_over",
                    "winner" => $this->gameState->winner
                ]);
                $this->stopChaosTimer();
                $this->stopTurnTimer();
            } else {
                $this->gameState->nextTurn();
                $this->broadcastTurn();
            }
        }
    }

    // ... existing broadcast ...
    public function broadcast($msg)
    {
        foreach ($this->clients as $client) {
            $client->send(json_encode($msg));
        }
    }
}
