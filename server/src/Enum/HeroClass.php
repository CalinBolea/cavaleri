<?php

namespace App\Enum;

enum HeroClass: string
{
    case Knight = 'knight';
    case Wizard = 'wizard';
    case Ranger = 'ranger';
    case Demoniac = 'demoniac';
    case Overlord = 'overlord';
    case Barbarian = 'barbarian';
    case Beastmaster = 'beastmaster';

    /**
     * @return array{attack: int, defense: int, spellPower: int, knowledge: int}
     */
    public function getStatGrowth(): array
    {
        return match ($this) {
            self::Knight => ['attack' => 2, 'defense' => 2, 'spellPower' => 1, 'knowledge' => 1],
            self::Wizard => ['attack' => 1, 'defense' => 1, 'spellPower' => 2, 'knowledge' => 2],
            self::Ranger => ['attack' => 1, 'defense' => 2, 'spellPower' => 1, 'knowledge' => 1],
            self::Demoniac => ['attack' => 2, 'defense' => 2, 'spellPower' => 1, 'knowledge' => 1],
            self::Overlord => ['attack' => 2, 'defense' => 2, 'spellPower' => 1, 'knowledge' => 1],
            self::Barbarian => ['attack' => 3, 'defense' => 1, 'spellPower' => 1, 'knowledge' => 1],
            self::Beastmaster => ['attack' => 1, 'defense' => 3, 'spellPower' => 1, 'knowledge' => 1],
        };
    }
}
