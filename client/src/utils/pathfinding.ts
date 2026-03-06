const EVEN_ROW_NEIGHBORS = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const ODD_ROW_NEIGHBORS = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];

function getMovementCost(terrain: string): number {
    switch (terrain) {
        case 'grass':
        case 'dirt':
            return 1;
        case 'forest':
            return 2;
        case 'water':
        case 'mountain':
            return -1;
        default:
            return 1;
    }
}

function isPassable(terrain: string): boolean {
    return getMovementCost(terrain) > 0;
}

function isInBounds(x: number, y: number, width: number, height: number): boolean {
    return x >= 0 && x < width && y >= 0 && y < height;
}

function getNeighbors(x: number, y: number, width: number, height: number): number[][] {
    const offsets = (y % 2 === 0) ? EVEN_ROW_NEIGHBORS : ODD_ROW_NEIGHBORS;
    const neighbors: number[][] = [];
    for (const [dx, dy] of offsets) {
        const nx = x + dx;
        const ny = y + dy;
        if (isInBounds(nx, ny, width, height)) {
            neighbors.push([nx, ny]);
        }
    }
    return neighbors;
}

function offsetToCube(col: number, row: number): [number, number, number] {
    const q = col - (row - (row & 1)) / 2;
    const r = row;
    const s = -q - r;
    return [q, r, s];
}

function heuristic(x1: number, y1: number, x2: number, y2: number): number {
    const [q1, r1, s1] = offsetToCube(x1, y1);
    const [q2, r2, s2] = offsetToCube(x2, y2);
    return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(s1 - s2)) / 2;
}

export function findPath(
    mapData: string[][],
    startX: number,
    startY: number,
    endX: number,
    endY: number,
): number[][] | null {
    const height = mapData.length;
    const width = mapData[0].length;

    if (!isInBounds(startX, startY, width, height) || !isInBounds(endX, endY, width, height)) {
        return null;
    }

    if (!isPassable(mapData[endY][endX])) {
        return null;
    }

    // A* with simple array-based priority queue (fine for small maps)
    const openSet: { x: number; y: number; f: number }[] = [{ x: startX, y: startY, f: 0 }];
    const gScore: Record<string, number> = { [`${startX},${startY}`]: 0 };
    const cameFrom: Record<string, [number, number]> = {};
    const visited = new Set<string>();

    while (openSet.length > 0) {
        // Find lowest f-score
        let bestIdx = 0;
        for (let i = 1; i < openSet.length; i++) {
            if (openSet[i].f < openSet[bestIdx].f) bestIdx = i;
        }
        const { x: cx, y: cy } = openSet[bestIdx];
        openSet.splice(bestIdx, 1);

        const currentKey = `${cx},${cy}`;

        if (cx === endX && cy === endY) {
            // Reconstruct path
            const path: number[][] = [[endX, endY]];
            let key = `${endX},${endY}`;
            while (cameFrom[key]) {
                const [px, py] = cameFrom[key];
                path.push([px, py]);
                key = `${px},${py}`;
            }
            return path.reverse();
        }

        if (visited.has(currentKey)) continue;
        visited.add(currentKey);

        for (const [nx, ny] of getNeighbors(cx, cy, width, height)) {
            const terrain = mapData[ny][nx];
            if (!isPassable(terrain)) continue;

            const neighborKey = `${nx},${ny}`;
            const tentativeG = gScore[currentKey] + getMovementCost(terrain);

            if (gScore[neighborKey] === undefined || tentativeG < gScore[neighborKey]) {
                cameFrom[neighborKey] = [cx, cy];
                gScore[neighborKey] = tentativeG;
                const f = tentativeG + heuristic(nx, ny, endX, endY);
                openSet.push({ x: nx, y: ny, f });
            }
        }
    }

    return null;
}

export function getPathCost(mapData: string[][], path: number[][]): number {
    let cost = 0;
    for (let i = 1; i < path.length; i++) {
        const [x, y] = path[i];
        cost += getMovementCost(mapData[y][x]);
    }
    return cost;
}
