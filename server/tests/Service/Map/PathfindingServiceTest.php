<?php

namespace App\Tests\Service\Map;

use App\Service\Map\PathfindingService;
use PHPUnit\Framework\TestCase;

class PathfindingServiceTest extends TestCase
{
    private PathfindingService $pathfinding;

    protected function setUp(): void
    {
        $this->pathfinding = new PathfindingService();
    }

    public function testFindsDirectPath(): void
    {
        $map = $this->createGrassMap(5, 5);
        $path = $this->pathfinding->findPath($map, 0, 0, 2, 0);

        $this->assertNotNull($path);
        $this->assertEquals([0, 0], $path[0]);
        $this->assertEquals([2, 0], $path[count($path) - 1]);
    }

    public function testFindsPathAroundObstacle(): void
    {
        $map = $this->createGrassMap(5, 5);
        $map[0][1] = 'water'; // Block direct path
        $path = $this->pathfinding->findPath($map, 0, 0, 2, 0);

        $this->assertNotNull($path);
        $this->assertEquals([0, 0], $path[0]);
        $this->assertEquals([2, 0], $path[count($path) - 1]);
    }

    public function testReturnsNullForImpassableDestination(): void
    {
        $map = $this->createGrassMap(5, 5);
        $map[2][2] = 'water';
        $path = $this->pathfinding->findPath($map, 0, 0, 2, 2);

        $this->assertNull($path);
    }

    public function testReturnsNullWhenNoPathExists(): void
    {
        $map = $this->createGrassMap(5, 5);
        // Create a wall of water
        for ($col = 0; $col < 5; $col++) {
            $map[2][$col] = 'water';
        }
        $path = $this->pathfinding->findPath($map, 0, 0, 0, 4);

        $this->assertNull($path);
    }

    public function testPathCostWithForest(): void
    {
        $map = $this->createGrassMap(5, 5);
        $map[0][1] = 'forest';

        $path = $this->pathfinding->findPath($map, 0, 0, 1, 0);
        $this->assertNotNull($path);

        $cost = $this->pathfinding->getPathCost($map, $path);
        // Path might go through forest (cost 2) or around it
        $this->assertGreaterThan(0, $cost);
    }

    private function createGrassMap(int $width, int $height): array
    {
        $map = [];
        for ($row = 0; $row < $height; $row++) {
            $map[$row] = [];
            for ($col = 0; $col < $width; $col++) {
                $map[$row][$col] = 'grass';
            }
        }
        return $map;
    }
}
