// Hero sprite placeholder - will be expanded with actual sprites later
export interface HeroVisual {
    x: number;
    y: number;
    color: number;
    label: string;
}

export function createHeroVisual(posX: number, posY: number): HeroVisual {
    return {
        x: posX,
        y: posY,
        color: 0xffcc00,
        label: 'H',
    };
}
