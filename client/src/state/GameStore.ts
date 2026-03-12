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
    heroClass: string;
    posX: number;
    posY: number;
    movementPoints: number;
    maxMovementPoints: number;
    attack: number;
    defense: number;
    spellPower: number;
    knowledge: number;
    experience: number;
    level: number;
    army: ArmySlot[];
}

export interface PlayerData {
    id: string;
    name: string;
    faction: string;
    color: string;
    resources: Resources;
    heroes: HeroData[];
}

export interface NeutralStackData {
    id: string;
    posX: number;
    posY: number;
    factionId: string;
    unitId: string;
    quantity: number;
}

export interface TownData {
    id: string;
    posX: number;
    posY: number;
    factionId: string;
    ownerId: string | null;
    buildings: string[];
    builtToday: boolean;
}

export interface CombatLoss {
    unitId: string;
    lost: number;
    remaining: number;
}

export interface CombatResultData {
    winner: string;
    attackerWon: boolean;
    attackerLosses: CombatLoss[];
    defenderLosses: CombatLoss[];
    experienceGained: number;
    rounds: any[];
}

export interface CombatData {
    occurred: boolean;
    type: string;
    result: CombatResultData;
}

export interface LevelUpData {
    levelsGained: number;
    newLevel: number;
    statGrowth: {
        attack: number;
        defense: number;
        spellPower: number;
        knowledge: number;
    };
}

export interface GameState {
    id: string;
    status: string;
    currentDay: number;
    currentWeek: number;
    currentMonth: number;
    currentPlayerIndex: number;
    mapWidth: number;
    mapHeight: number;
    mapData: string[][];
    players: PlayerData[];
    neutralStacks: NeutralStackData[];
    towns: TownData[];
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
        return this.state.players[this.state.currentPlayerIndex] ?? null;
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
