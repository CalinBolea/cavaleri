export interface Resources {
    gold: number;
    wood: number;
    ore: number;
    mercury: number;
    sulfur: number;
    crystal: number;
    gems: number;
}

export interface ArmySlot {
    slotIndex: number;
    unitId: string;
    quantity: number;
}

export interface HeroData {
    id: string;
    name: string;
    posX: number;
    posY: number;
    movementPoints: number;
    maxMovementPoints: number;
    attack: number;
    defense: number;
    army: ArmySlot[];
}

export interface PlayerData {
    id: string;
    name: string;
    faction: string;
    resources: Resources;
    heroes: HeroData[];
}

export interface GameState {
    id: string;
    status: string;
    currentDay: number;
    currentWeek: number;
    currentMonth: number;
    mapWidth: number;
    mapHeight: number;
    mapData: string[][];
    players: PlayerData[];
}

class GameStore {
    private state: GameState | null = null;

    getState(): GameState | null {
        return this.state;
    }

    setState(state: GameState): void {
        this.state = state;
    }

    getCurrentPlayer(): PlayerData | null {
        if (!this.state) return null;
        return this.state.players[0]; // single player: always first player
    }

    getSelectedHero(): HeroData | null {
        const player = this.getCurrentPlayer();
        if (!player || player.heroes.length === 0) return null;
        return player.heroes[0]; // for now, just use first hero
    }

    updateFromGameState(gameState: GameState): void {
        this.state = gameState;
    }
}

export const gameStore = new GameStore();
