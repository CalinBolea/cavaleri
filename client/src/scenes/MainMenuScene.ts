import Phaser from 'phaser';
import { apiClient, GameSummary } from '../network/ApiClient';
import { gameStore } from '../state/GameStore';

export class MainMenuScene extends Phaser.Scene {
    private mainButtons: Phaser.GameObjects.GameObject[] = [];
    private listContainer: Phaser.GameObjects.Container | null = null;

    constructor() {
        super({ key: 'MainMenuScene' });
    }

    create(): void {
        const { width, height } = this.cameras.main;

        // Title
        this.add.text(width / 2, height / 3, 'CAVALERI', {
            fontFamily: 'serif',
            fontSize: '72px',
            color: '#c4a44e',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 3 + 60, 'Heroes of Might and Magic', {
            fontFamily: 'serif',
            fontSize: '24px',
            color: '#8a8a8a',
        }).setOrigin(0.5);

        this.showMainButtons();
    }

    private showMainButtons(): void {
        const { width, height } = this.cameras.main;

        // New Game button
        const newGameBg = this.add.rectangle(width / 2, height / 2 + 60, 240, 56, 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true });

        const newGameText = this.add.text(width / 2, height / 2 + 60, 'New Game', {
            fontFamily: 'serif',
            fontSize: '28px',
            color: '#c4a44e',
        }).setOrigin(0.5);

        newGameBg.on('pointerover', () => newGameBg.setFillStyle(0x3a3a5a));
        newGameBg.on('pointerout', () => newGameBg.setFillStyle(0x2a2a4a));
        newGameBg.on('pointerdown', async () => {
            newGameText.setText('Creating...');
            newGameBg.disableInteractive();

            try {
                const gameState = await apiClient.createGame('Player 1', 'castle');
                gameStore.setState(gameState);
                this.scene.start('AdventureMapScene');
            } catch (error) {
                console.error('Failed to create game:', error);
                newGameText.setText('Error! Retry');
                newGameBg.setInteractive({ useHandCursor: true });
            }
        });

        // Load Game button
        const loadGameBg = this.add.rectangle(width / 2, height / 2 + 130, 240, 56, 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true });

        this.add.text(width / 2, height / 2 + 130, 'Load Game', {
            fontFamily: 'serif',
            fontSize: '28px',
            color: '#c4a44e',
        }).setOrigin(0.5);

        loadGameBg.on('pointerover', () => loadGameBg.setFillStyle(0x3a3a5a));
        loadGameBg.on('pointerout', () => loadGameBg.setFillStyle(0x2a2a4a));
        loadGameBg.on('pointerdown', () => this.showLoadGamePanel());

        this.mainButtons = [newGameBg, newGameText, loadGameBg, loadGameBg.getData('__text')];
        // Store refs for cleanup
        this.mainButtons = [];
        this.children.each((child) => {
            // Collect only the button objects (not the title texts)
            const go = child as Phaser.GameObjects.GameObject;
            if (go === newGameBg || go === newGameText || go === loadGameBg) {
                this.mainButtons.push(go);
            }
        });
        // Also grab the load game text (last text added)
        const allChildren = this.children.getAll();
        const loadGameText = allChildren[allChildren.length - 1];
        this.mainButtons.push(loadGameText);
    }

    private destroyMainButtons(): void {
        for (const obj of this.mainButtons) {
            obj.destroy();
        }
        this.mainButtons = [];
    }

    private async showLoadGamePanel(): Promise<void> {
        this.destroyMainButtons();

        const { width, height } = this.cameras.main;
        this.listContainer = this.add.container(0, 0);

        // Panel background
        const panelW = 500;
        const panelH = 400;
        const panelX = width / 2;
        const panelY = height / 2;

        const panelBg = this.add.rectangle(panelX, panelY, panelW, panelH, 0x1a1a2e)
            .setStrokeStyle(2, 0xc4a44e);
        this.listContainer.add(panelBg);

        // Title
        const title = this.add.text(panelX, panelY - panelH / 2 + 30, 'Saved Games', {
            fontFamily: 'serif',
            fontSize: '28px',
            color: '#c4a44e',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.listContainer.add(title);

        // Loading text
        const loadingText = this.add.text(panelX, panelY, 'Loading...', {
            fontFamily: 'serif',
            fontSize: '18px',
            color: '#8a8a8a',
        }).setOrigin(0.5);
        this.listContainer.add(loadingText);

        // Back button
        const backY = panelY + panelH / 2 - 30;
        const backBg = this.add.rectangle(panelX, backY, 120, 40, 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true });
        this.listContainer.add(backBg);

        const backText = this.add.text(panelX, backY, 'Back', {
            fontFamily: 'serif',
            fontSize: '18px',
            color: '#c4a44e',
        }).setOrigin(0.5);
        this.listContainer.add(backText);

        backBg.on('pointerover', () => backBg.setFillStyle(0x3a3a5a));
        backBg.on('pointerout', () => backBg.setFillStyle(0x2a2a4a));
        backBg.on('pointerdown', () => {
            this.listContainer?.destroy();
            this.listContainer = null;
            this.showMainButtons();
        });

        // Fetch games
        try {
            const games = await apiClient.listGames();
            loadingText.destroy();

            if (games.length === 0) {
                const emptyText = this.add.text(panelX, panelY, 'No saved games found.', {
                    fontFamily: 'serif',
                    fontSize: '18px',
                    color: '#8a8a8a',
                }).setOrigin(0.5);
                this.listContainer.add(emptyText);
                return;
            }

            const rowH = 50;
            const rowW = 460;
            const startY = panelY - panelH / 2 + 80;
            const maxRows = Math.min(games.length, 6);

            for (let i = 0; i < maxRows; i++) {
                const game = games[i];
                const rowY = startY + i * (rowH + 6) + rowH / 2;

                const rowBg = this.add.rectangle(panelX, rowY, rowW, rowH, 0x2a2a4a)
                    .setStrokeStyle(1, 0x444466)
                    .setInteractive({ useHandCursor: true });
                this.listContainer.add(rowBg);

                // Left: player info
                const playerInfo = game.players.length > 0
                    ? `${game.players[0].name} — ${this.capitalize(game.players[0].faction)}`
                    : 'Unknown';
                const leftText = this.add.text(panelX - rowW / 2 + 16, rowY, playerInfo, {
                    fontFamily: 'serif',
                    fontSize: '16px',
                    color: '#ffffff',
                }).setOrigin(0, 0.5);
                this.listContainer.add(leftText);

                // Right: day info
                const dayInfo = `Month ${game.currentMonth}, Week ${game.currentWeek}, Day ${game.currentDay}`;
                const rightText = this.add.text(panelX + rowW / 2 - 16, rowY, dayInfo, {
                    fontFamily: 'serif',
                    fontSize: '14px',
                    color: '#c4a44e',
                }).setOrigin(1, 0.5);
                this.listContainer.add(rightText);

                rowBg.on('pointerover', () => rowBg.setFillStyle(0x3a3a5a));
                rowBg.on('pointerout', () => rowBg.setFillStyle(0x2a2a4a));
                rowBg.on('pointerdown', () => this.loadGame(game));
            }
        } catch (error) {
            console.error('Failed to list games:', error);
            loadingText.setText('Failed to load games.');
            loadingText.setColor('#cc3333');
        }
    }

    private async loadGame(summary: GameSummary): Promise<void> {
        try {
            const gameState = await apiClient.getGame(summary.id);
            gameStore.setState(gameState);
            this.scene.start('AdventureMapScene');
        } catch (error) {
            console.error('Failed to load game:', error);
        }
    }

    private capitalize(s: string): string {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
}
