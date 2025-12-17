<?php
namespace LadderSnake;

class GameState
{
    public $boardSize = 100;
    public $snakes = [];
    public $ladders = [];
    public $players = []; // formatted as ["playerId" => position]
    public $playerColors = [];
    public $turnIndex = 0;
    public $winner = null;
    public $lastDiceRoll = 0;

    private $turnOrder = [];

    public function __construct(array $playerIds)
    {
        $this->generateBoard();
        foreach ($playerIds as $id) {
            $this->players[$id] = 1;
            $this->playerColors[$id] = $this->randomColor();
        }
        $this->turnOrder = $playerIds;
    }

    public function setTurnOrder(array $orderedIds)
    {
        $this->turnOrder = $orderedIds;
        $this->turnIndex = 0;
    }

    public function getCurrentPlayerId()
    {
        return $this->turnOrder[$this->turnIndex] ?? null;
    }

    // Public method to allow reshuffling
    public function regenerateBoard()
    {
        $this->snakes = [];
        $this->ladders = [];
        $this->generateBoard();
    }

    private function generateBoard()
    {
        while (count($this->snakes) < 5) {
            $start = rand(11, 99);
            $end = rand(2, $start - 1);
            if (!isset($this->snakes[$start]) && !isset($this->ladders[$start]) && !isset($this->ladders[$end])) {
                $this->snakes[$start] = $end;
            }
        }

        while (count($this->ladders) < 5) {
            $start = rand(2, 89);
            $end = rand($start + 1, 99);
            if (!isset($this->ladders[$start]) && !isset($this->snakes[$start]) && !isset($this->snakes[$end]) && !isset($this->ladders[$end])) {
                $this->ladders[$start] = $end;
            }
        }
    }

    private function randomColor()
    {
        return "#" . str_pad(dechex(mt_rand(0, 0xFFFFFF)), 6, "0", STR_PAD_LEFT);
    }

    public function rollDice()
    {
        $this->lastDiceRoll = rand(1, 6);
        return $this->lastDiceRoll;
    }

    public function movePlayer($playerId, $manualMoveAmount = null)
    {
        if ($this->winner)
            return;

        $currentPos = $this->players[$playerId];

        $moveAmt = $manualMoveAmount !== null ? $manualMoveAmount : $this->lastDiceRoll;
        $newPos = $currentPos + $moveAmt;

        if ($newPos > 100) {
            $newPos = 100 - ($newPos - 100);
        }

        if (isset($this->snakes[$newPos])) {
            $newPos = $this->snakes[$newPos];
        } else if (isset($this->ladders[$newPos])) {
            $newPos = $this->ladders[$newPos];
        }

        $this->players[$playerId] = $newPos;

        if ($newPos == 100) {
            $this->winner = $playerId;
        }

        return $newPos;
    }

    // Check if player is on snake/ladder trigger without dice roll (for chaos mode)
    public function checkPositionEffect($playerId)
    {
        if ($this->winner)
            return null;

        $currentPos = $this->players[$playerId];
        $newPos = $currentPos;
        $effect = null;

        if (isset($this->snakes[$currentPos])) {
            $newPos = $this->snakes[$currentPos];
            $effect = "snake";
        } else if (isset($this->ladders[$currentPos])) {
            $newPos = $this->ladders[$currentPos];
            $effect = "ladder";
        }

        if ($newPos !== $currentPos) {
            $this->players[$playerId] = $newPos;
            if ($newPos == 100) {
                $this->winner = $playerId;
            }
            return ["newPos" => $newPos, "effect" => $effect];
        }
        return null;
    }

    public function nextTurn()
    {
        $this->turnIndex = ($this->turnIndex + 1) % count($this->turnOrder);
    }
}
