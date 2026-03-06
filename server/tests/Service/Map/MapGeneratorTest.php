<?php

namespace App\Tests\Service\Map;

use App\Service\Map\MapGenerator;
use PHPUnit\Framework\TestCase;

class MapGeneratorTest extends TestCase
{
    public function testGeneratesCorrectSize(): void
    {
        $generator = new MapGenerator();
        $map = $generator->generate(20, 20);

        $this->assertCount(20, $map);
        foreach ($map as $row) {
            $this->assertCount(20, $row);
        }
    }

    public function testStartingAreaIsGrass(): void
    {
        $generator = new MapGenerator();
        $map = $generator->generate(20, 20);

        // Area around (3,3) should be grass
        for ($row = 1; $row <= 5; $row++) {
            for ($col = 1; $col <= 5; $col++) {
                $this->assertEquals('grass', $map[$row][$col], "Tile at ($col, $row) should be grass");
            }
        }
    }

    public function testAllTerrainTypesValid(): void
    {
        $generator = new MapGenerator();
        $map = $generator->generate(20, 20);

        $validTerrains = ['grass', 'dirt', 'water', 'forest', 'mountain'];
        foreach ($map as $row) {
            foreach ($row as $terrain) {
                $this->assertContains($terrain, $validTerrains);
            }
        }
    }
}
