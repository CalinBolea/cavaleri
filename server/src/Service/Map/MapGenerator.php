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

    public function generateNeutralStacks(array $mapData, int $count = 8): array
    {
        $height = count($mapData);
        $width = count($mapData[0]);

        // Collect passable tiles outside the 5x5 starting grass zone
        $candidates = [];
        for ($row = 0; $row < $height; $row++) {
            for ($col = 0; $col < $width; $col++) {
                // Skip starting zone (rows 1-5, cols 1-5)
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
                $unitId = 'pikeman';
                $quantity = random_int(5, 20);
            } elseif ($distance < 12) {
                $roll = random_int(0, 1);
                $unitId = $roll === 0 ? 'pikeman' : 'archer';
                $quantity = $unitId === 'pikeman' ? random_int(5, 20) : random_int(3, 12);
            } else {
                $roll = random_int(0, 1);
                $unitId = $roll === 0 ? 'archer' : 'griffin';
                $quantity = $unitId === 'archer' ? random_int(3, 12) : random_int(2, 8);
            }

            $stacks[] = [
                'posX' => $pos['posX'],
                'posY' => $pos['posY'],
                'factionId' => 'castle',
                'unitId' => $unitId,
                'quantity' => $quantity,
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
