<?php

namespace App\Enum;

enum HeroClass: string
{
    case Knight = 'knight';
    case Wizard = 'wizard';
    case Ranger = 'ranger';

    /**
     * @return array{attack: int, defense: int, spellPower: int, knowledge: int}
     */
    public function getStatGrowth(): array
    {
        return match ($this) {
            self::Knight => ['attack' => 2, 'defense' => 2, 'spellPower' => 1, 'knowledge' => 1],
            self::Wizard => ['attack' => 1, 'defense' => 1, 'spellPower' => 2, 'knowledge' => 2],
            self::Ranger => ['attack' => 1, 'defense' => 1, 'spellPower' => 1, 'knowledge' => 1],
        };
    }
}
