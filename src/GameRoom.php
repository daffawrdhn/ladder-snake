<?php
namespace LadderSnake;

use Ratchet\ConnectionInterface;
use React\EventLoop\LoopInterface;

class GameRoom {
    public $id;
    public $clients;
    public $gameState;
    public $playerMap = [];
    public $nicknames = [];
    public $loop;
    public $chaosTimer;

    public function __construct($id, array $clients, array $nicknames, LoopInterface $loop) {
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

        usort($playerIds, function($a, $b) use ($initiative) {
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

    public function stopChaosTimer() {
        if ($this->chaosTimer) {
            $this->loop->cancelTimer($this->chaosTimer);
        }
    }

    private function handleChaosParams() {
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

    public function handleAction(ConnectionInterface $from, $data) {
        $playerId = $this->playerMap[$from->resourceId];
        $currentPlayerId = $this->gameState->getCurrentPlayerId();
        
        if ($playerId !== $currentPlayerId) {
            $from->send(json_encode(["type" => "error", "message" => "Not your turn!"]));
            return;
        }

        if ($data["action"] === "roll_dice") {
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
                $this->broadcast([
                    "type" => "game_over",
                    "winner" => $this->gameState->winner
                ]);
                $this->stopChaosTimer();
            } else {
                $this->gameState->nextTurn();
                $this->broadcastTurn();
            }
        }
    }

    private function broadcastTurn() {
        $currentPlayerId = $this->gameState->getCurrentPlayerId();
        $this->broadcast([
            "type" => "turn_change",
            "player" => $currentPlayerId
        ]);
    }

    public function broadcast($msg) {
        foreach ($this->clients as $client) {
            $client->send(json_encode($msg));
        }
    }
}
