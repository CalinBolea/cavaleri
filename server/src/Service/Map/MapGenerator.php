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
