<?php

namespace App\Service\Map;

class MapGenerator
{
    public const START_POSITIONS = [[3, 3], [16, 16], [16, 3], [3, 16]];

    private const TERRAIN_WEIGHTS = [
        'grass' => 50,
        'dirt' => 15,
        'forest' => 15,
        'water' => 10,
        'mountain' => 10,
    ];

    public function generate(int $width, int $height, array $startPositions = [[3, 3]]): array
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

        // Clear grass in a ±2 radius around each starting position
        foreach ($startPositions as [$startCol, $startRow]) {
            for ($row = max(0, $startRow - 2); $row <= min($height - 1, $startRow + 2); $row++) {
                for ($col = max(0, $startCol - 2); $col <= min($width - 1, $startCol + 2); $col++) {
                    $map[$row][$col] = 'grass';
                }
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

    public function generateNeutralStacks(array $mapData, int $count = 8, array $startPositions = [[3, 3]]): array
    {
        $height = count($mapData);
        $width = count($mapData[0]);

        // Collect passable tiles outside the clear zone around each start position
        $candidates = [];
        for ($row = 0; $row < $height; $row++) {
            for ($col = 0; $col < $width; $col++) {
                // Skip tiles within ±2 of any start position
                $inClearZone = false;
                foreach ($startPositions as [$startCol, $startRow]) {
                    if (abs($col - $startCol) <= 2 && abs($row - $startRow) <= 2) {
                        $inClearZone = true;
                        break;
                    }
                }
                if ($inClearZone) {
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
            // Distance tier based on minimum distance to any start position
            $minDistance = PHP_INT_MAX;
            foreach ($startPositions as [$startCol, $startRow]) {
                $d = abs($pos['posX'] - $startCol) + abs($pos['posY'] - $startRow);
                $minDistance = min($minDistance, $d);
            }

            if ($minDistance < 6) {
                $pool = self::NEUTRAL_POOLS['near'];
            } elseif ($minDistance < 12) {
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
