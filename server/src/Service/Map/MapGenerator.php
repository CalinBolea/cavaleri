<?php

namespace App\Service\Map;

class MapGenerator
{
    private const TERRAIN_WEIGHTS = [
        'grass' => 50,
        'dirt' => 15,
        'forest' => 15,
        'water' => 10,
        'mountain' => 10,
    ];

    public function generate(int $width, int $height): array
    {
        $map = [];
        $terrainPool = [];
        foreach (self::TERRAIN_WEIGHTS as $terrain => $weight) {
            for ($i = 0; $i < $weight; $i++) {
                $terrainPool[] = $terrain;
            }
        }

        for ($row = 0; $row < $height; $row++) {
            $map[$row] = [];
            for ($col = 0; $col < $width; $col++) {
                $map[$row][$col] = $terrainPool[array_rand($terrainPool)];
            }
        }

        // Clear area around starting position (3, 3)
        for ($row = max(0, 1); $row <= min($height - 1, 5); $row++) {
            for ($col = max(0, 1); $col <= min($width - 1, 5); $col++) {
                $map[$row][$col] = 'grass';
            }
        }

        return $map;
    }

    /**
     * Tier pools by distance bracket, with [factionId, unitId, minQty, maxQty].
     */
    private const NEUTRAL_POOLS = [
        'near' => [
            ['castle', 'pikeman', 5, 20],
            ['necropolis', 'skeleton', 6, 25],
        ],
        'mid' => [
            ['castle', 'pikeman', 8, 25],
            ['castle', 'archer', 3, 12],
            ['castle', 'swordsman', 2, 6],
            ['necropolis', 'skeleton', 10, 30],
            ['necropolis', 'walking_dead', 4, 12],
            ['necropolis', 'wight', 2, 6],
        ],
        'far' => [
            ['castle', 'griffin', 3, 8],
            ['castle', 'monk', 2, 6],
            ['castle', 'cavalier', 1, 3],
            ['necropolis', 'vampire', 2, 5],
            ['necropolis', 'lich', 2, 4],
            ['necropolis', 'black_knight', 1, 3],
        ],
    ];

    public function generateNeutralStacks(array $mapData, int $count = 8): array
    {
        $height = count($mapData);
        $width = count($mapData[0]);

        // Collect passable tiles outside the 5x5 starting grass zone
        $candidates = [];
        for ($row = 0; $row < $height; $row++) {
            for ($col = 0; $col < $width; $col++) {
                if ($row >= 1 && $row <= 5 && $col >= 1 && $col <= 5) {
                    continue;
                }
                if (self::isPassable($mapData[$row][$col])) {
                    $candidates[] = ['posX' => $col, 'posY' => $row];
                }
            }
        }

        shuffle($candidates);
        $selected = array_slice($candidates, 0, min($count, count($candidates)));

        $stacks = [];
        foreach ($selected as $pos) {
            $distance = abs($pos['posX'] - 3) + abs($pos['posY'] - 3);

            if ($distance < 6) {
                $pool = self::NEUTRAL_POOLS['near'];
            } elseif ($distance < 12) {
                $pool = self::NEUTRAL_POOLS['mid'];
            } else {
                $pool = self::NEUTRAL_POOLS['far'];
            }

            $pick = $pool[array_rand($pool)];

            $stacks[] = [
                'posX' => $pos['posX'],
                'posY' => $pos['posY'],
                'factionId' => $pick[0],
                'unitId' => $pick[1],
                'quantity' => random_int($pick[2], $pick[3]),
            ];
        }

        return $stacks;
    }

    public static function getMovementCost(string $terrain): int
    {
        return match ($terrain) {
            'grass', 'dirt' => 1,
            'forest' => 2,
            'water', 'mountain' => -1, // impassable
            default => 1,
        };
    }

    public static function isPassable(string $terrain): bool
    {
        return self::getMovementCost($terrain) > 0;
    }
}
