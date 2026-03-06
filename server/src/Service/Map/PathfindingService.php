<?php

namespace App\Service\Map;

class PathfindingService
{
    private const EVEN_ROW_NEIGHBORS = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
    private const ODD_ROW_NEIGHBORS = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];

    public function findPath(array $mapData, int $startX, int $startY, int $endX, int $endY): ?array
    {
        $height = count($mapData);
        $width = count($mapData[0]);

        if (!$this->isInBounds($startX, $startY, $width, $height) ||
            !$this->isInBounds($endX, $endY, $width, $height)) {
            return null;
        }

        if (!MapGenerator::isPassable($mapData[$endY][$endX])) {
            return null;
        }

        // A* algorithm
        $openSet = new \SplPriorityQueue();
        $openSet->setExtractFlags(\SplPriorityQueue::EXTR_DATA);
        $openSet->insert([$startX, $startY], 0);

        $cameFrom = [];
        $gScore = [];
        $key = "$startX,$startY";
        $gScore[$key] = 0;

        $visited = [];

        while (!$openSet->isEmpty()) {
            [$cx, $cy] = $openSet->extract();
            $currentKey = "$cx,$cy";

            if ($cx === $endX && $cy === $endY) {
                return $this->reconstructPath($cameFrom, $endX, $endY);
            }

            if (isset($visited[$currentKey])) {
                continue;
            }
            $visited[$currentKey] = true;

            foreach ($this->getNeighbors($cx, $cy, $width, $height) as [$nx, $ny]) {
                $terrain = $mapData[$ny][$nx];
                if (!MapGenerator::isPassable($terrain)) {
                    continue;
                }

                $neighborKey = "$nx,$ny";
                $tentativeG = $gScore[$currentKey] + MapGenerator::getMovementCost($terrain);

                if (!isset($gScore[$neighborKey]) || $tentativeG < $gScore[$neighborKey]) {
                    $cameFrom[$neighborKey] = [$cx, $cy];
                    $gScore[$neighborKey] = $tentativeG;
                    $fScore = $tentativeG + $this->heuristic($nx, $ny, $endX, $endY);
                    $openSet->insert([$nx, $ny], -$fScore); // negative because SplPriorityQueue is max-heap
                }
            }
        }

        return null; // No path found
    }

    public function getPathCost(array $mapData, array $path): int
    {
        $cost = 0;
        for ($i = 1; $i < count($path); $i++) {
            [$x, $y] = $path[$i];
            $cost += MapGenerator::getMovementCost($mapData[$y][$x]);
        }
        return $cost;
    }

    public function getNeighbors(int $x, int $y, int $width, int $height): array
    {
        $neighbors = [];
        $offsets = ($y % 2 === 0) ? self::EVEN_ROW_NEIGHBORS : self::ODD_ROW_NEIGHBORS;

        foreach ($offsets as [$dx, $dy]) {
            $nx = $x + $dx;
            $ny = $y + $dy;
            if ($this->isInBounds($nx, $ny, $width, $height)) {
                $neighbors[] = [$nx, $ny];
            }
        }

        return $neighbors;
    }

    private function isInBounds(int $x, int $y, int $width, int $height): bool
    {
        return $x >= 0 && $x < $width && $y >= 0 && $y < $height;
    }

    private function heuristic(int $x1, int $y1, int $x2, int $y2): int
    {
        // Convert offset to cube coordinates for hex distance
        [$q1, $r1, $s1] = $this->offsetToCube($x1, $y1);
        [$q2, $r2, $s2] = $this->offsetToCube($x2, $y2);

        return (int)((abs($q1 - $q2) + abs($r1 - $r2) + abs($s1 - $s2)) / 2);
    }

    private function offsetToCube(int $col, int $row): array
    {
        $q = $col - ($row - ($row & 1)) / 2;
        $r = $row;
        $s = -$q - $r;
        return [$q, $r, $s];
    }

    private function reconstructPath(array $cameFrom, int $endX, int $endY): array
    {
        $path = [[$endX, $endY]];
        $key = "$endX,$endY";

        while (isset($cameFrom[$key])) {
            [$x, $y] = $cameFrom[$key];
            $path[] = [$x, $y];
            $key = "$x,$y";
        }

        return array_reverse($path);
    }
}
