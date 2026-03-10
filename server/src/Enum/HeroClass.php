<?php

namespace App\Enum;

enum HeroClass: string
{
    // Castle
    case Knight = 'knight';
    case Cleric = 'cleric';
    // Necropolis
    case DeathKnight = 'death_knight';
    case Necromancer = 'necromancer';
    // Rampart
    case Ranger = 'ranger';
    case Druid = 'druid';
    // Tower
    case Alchemist = 'alchemist';
    case Wizard = 'wizard';
    // Inferno
    case Demoniac = 'demoniac';
    case Heretic = 'heretic';
    // Dungeon
    case Overlord = 'overlord';
    case Warlock = 'warlock';
    // Stronghold
    case Barbarian = 'barbarian';
    case BattleMage = 'battle_mage';
    // Fortress
    case Beastmaster = 'beastmaster';
    case Witch = 'witch';

    /**
     * @return array{attack: int, defense: int, spellPower: int, knowledge: int}
     */
    public function getStatGrowth(): array
    {
        return match ($this) {
            // Might classes
            self::Knight,
            self::DeathKnight,
            self::Ranger,
            self::Alchemist,
            self::Demoniac,
            self::Overlord,
            self::Barbarian,
            self::Beastmaster => ['attack' => 2, 'defense' => 2, 'spellPower' => 1, 'knowledge' => 1],

            // Magic classes
            self::Cleric,
            self::Necromancer,
            self::Druid,
            self::Wizard,
            self::Heretic,
            self::Warlock,
            self::BattleMage,
            self::Witch => ['attack' => 1, 'defense' => 1, 'spellPower' => 2, 'knowledge' => 2],
        };
    }
}
