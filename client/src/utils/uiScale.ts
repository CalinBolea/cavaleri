function detectMobile(): boolean {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    return isTouch && coarsePointer;
}

export const IS_MOBILE = detectMobile();
export const UI_SCALE = IS_MOBILE ? 1.35 : 1.0;

/** Scale a pixel value */
export function s(v: number): number { return Math.round(v * UI_SCALE); }

/** Scale a font size, return as 'Xpx' string */
export function fs(v: number): string { return `${s(v)}px`; }
