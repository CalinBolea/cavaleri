import { GameState, CombatData } from '../state/GameStore';

const API_BASE = '/api';

export interface PlayerConfig {
    name: string;
    faction: string;
}

export interface MoveResponse {
    hero: any;
    path: number[][];
    cost: number;
    combat?: CombatData | null;
    game: GameState;
}

export interface GameSummary {
    id: string;
    status: string;
    currentDay: number;
    currentWeek: number;
    currentMonth: number;
    mapWidth: number;
    mapHeight: number;
    players: { name: string; faction: string }[];
    createdAt: string;
    updatedAt: string;
}

class ApiClient {
    async createGame(players: PlayerConfig[], mapSize: string = 'S'): Promise<GameState> {
        const response = await fetch(`${API_BASE}/games`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ players, mapSize }),
        });

        if (!response.ok) {
            throw new Error(`Failed to create game: ${response.statusText}`);
        }

        return response.json();
    }

    async getGame(gameId: string): Promise<GameState> {
        const response = await fetch(`${API_BASE}/games/${gameId}`);

        if (!response.ok) {
            throw new Error(`Failed to get game: ${response.statusText}`);
        }

        return response.json();
    }

    async moveHero(gameId: string, heroId: string, x: number, y: number): Promise<MoveResponse> {
        const response = await fetch(`${API_BASE}/games/${gameId}/heroes/${heroId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x, y }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to move hero');
        }

        return response.json();
    }

    async listGames(): Promise<GameSummary[]> {
        const response = await fetch(`${API_BASE}/games`);
        if (!response.ok) throw new Error(`Failed to list games: ${response.statusText}`);
        return response.json();
    }

    async deleteGame(gameId: string): Promise<void> {
        const response = await fetch(`${API_BASE}/games/${gameId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`Failed to delete game: ${response.statusText}`);
    }

    async endTurn(gameId: string): Promise<GameState> {
        const response = await fetch(`${API_BASE}/games/${gameId}/end-turn`, {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error(`Failed to end turn: ${response.statusText}`);
        }

        return response.json();
    }
}

export const apiClient = new ApiClient();
