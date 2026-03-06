<?php

namespace App\DTO;

readonly class CombatResult
{
    public function __construct(
        public string $winner,
        public bool $attackerWon,
        public array $attackerLosses,
        public array $defenderLosses,
        public int $experienceGained,
        public array $rounds,
    ) {
    }

    public function toArray(): array
    {
        return [
            'winner' => $this->winner,
            'attackerWon' => $this->attackerWon,
            'attackerLosses' => $this->attackerLosses,
            'defenderLosses' => $this->defenderLosses,
            'experienceGained' => $this->experienceGained,
            'rounds' => $this->rounds,
        ];
    }
}
