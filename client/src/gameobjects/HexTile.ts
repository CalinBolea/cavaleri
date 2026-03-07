// Hex tile utility - used for future click detection improvements
export const HEX_SIZE = 20;
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
export const HEX_HEIGHT = 2 * HEX_SIZE;
export const HEX_VERT_SPACING = HEX_HEIGHT * 0.75;

export interface HexCoord {
    col: number;
    row: number;
}

export interface CubeCoord {
    q: number;
    r: number;
    s: number;
}

export function offsetToCube(col: number, row: number): CubeCoord {
    const q = col - (row - (row & 1)) / 2;
    const r = row;
    const s = -q - r;
    return { q, r, s };
}

export function cubeToOffset(q: number, r: number): HexCoord {
    const col = q + (r - (r & 1)) / 2;
    const row = r;
    return { col, row };
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
    const ac = offsetToCube(a.col, a.row);
    const bc = offsetToCube(b.col, b.row);
    return Math.max(Math.abs(ac.q - bc.q), Math.abs(ac.r - bc.r), Math.abs(ac.s - bc.s));
}
