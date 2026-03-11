import Phaser from 'phaser';
import { apiClient, GameSummary, PlayerConfig } from '../network/ApiClient';
import { gameStore } from '../state/GameStore';
import { s, fs } from '../utils/uiScale';

export class MainMenuScene extends Phaser.Scene {
    private mainButtons: Phaser.GameObjects.GameObject[] = [];
    private listContainer: Phaser.GameObjects.Container | null = null;
    private setupContainer: Phaser.GameObjects.Container | null = null;
    private confirmContainer: Phaser.GameObjects.Container | null = null;

    constructor() {
        super({ key: 'MainMenuScene' });
    }

    create(): void {
        const { width, height } = this.cameras.main;

        // Title
        this.add.text(width / 2, height / 3, 'CAVALERI', {
            fontFamily: 'serif',
            fontSize: fs(72),
            color: '#c4a44e',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 3 + 60, 'Heroes of Might and Magic', {
            fontFamily: 'serif',
            fontSize: fs(24),
            color: '#8a8a8a',
        }).setOrigin(0.5);

        this.showMainButtons();
    }

    private showMainButtons(): void {
        const { width, height } = this.cameras.main;

        // New Game button
        const newGameBg = this.add.rectangle(width / 2, height / 2 + 60, s(240), s(56), 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true });

        const newGameText = this.add.text(width / 2, height / 2 + 60, 'New Game', {
            fontFamily: 'serif',
            fontSize: fs(28),
            color: '#c4a44e',
        }).setOrigin(0.5);

        newGameBg.on('pointerover', () => newGameBg.setFillStyle(0x3a3a5a));
        newGameBg.on('pointerout', () => newGameBg.setFillStyle(0x2a2a4a));
        newGameBg.on('pointerdown', () => this.showNewGamePanel());

        // Load Game button
        const loadGameBg = this.add.rectangle(width / 2, height / 2 + 130, s(240), s(56), 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true });

        this.add.text(width / 2, height / 2 + 130, 'Load Game', {
            fontFamily: 'serif',
            fontSize: fs(28),
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

    private showNewGamePanel(): void {
        this.destroyMainButtons();

        const { width, height } = this.cameras.main;
        this.setupContainer = this.add.container(0, 0);

        const panelW = Math.min(s(500), width - 40);
        const panelH = Math.min(s(450), height - 40);
        const panelX = width / 2;
        const panelY = height / 2;

        const panelBg = this.add.rectangle(panelX, panelY, panelW, panelH, 0x1a1a2e)
            .setStrokeStyle(2, 0xc4a44e);
        this.setupContainer.add(panelBg);

        const title = this.add.text(panelX, panelY - panelH / 2 + 30, 'New Game', {
            fontFamily: 'serif',
            fontSize: '28px',
            color: '#c4a44e',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.setupContainer.add(title);

        const factions = ['castle', 'rampart', 'tower', 'inferno', 'necropolis', 'dungeon', 'stronghold', 'fortress'];
        let playerCount = 2;
        const playerFactions: string[] = ['castle', 'necropolis', 'rampart', 'inferno'];
        const mapSizes = ['S', 'M', 'L'];
        const mapSizeLabels: Record<string, string> = { S: 'Small', M: 'Medium', L: 'Large' };
        let selectedMapSize = 'S';

        // Player count selector
        const countLabelY = panelY - panelH / 2 + 80;
        const countLabel = this.add.text(panelX - 100, countLabelY, 'Players:', {
            fontFamily: 'serif',
            fontSize: '20px',
            color: '#ffffff',
        }).setOrigin(0, 0.5);
        this.setupContainer.add(countLabel);

        const countButtons: Phaser.GameObjects.Rectangle[] = [];
        const countTexts: Phaser.GameObjects.Text[] = [];

        for (let n = 1; n <= 4; n++) {
            const bx = panelX + 20 + (n - 1) * 50;
            const bg = this.add.rectangle(bx, countLabelY, s(40), s(36), n === playerCount ? 0xc4a44e : 0x2a2a4a)
                .setStrokeStyle(1, 0xc4a44e)
                .setInteractive({ useHandCursor: true });
            const txt = this.add.text(bx, countLabelY, String(n), {
                fontFamily: 'serif',
                fontSize: '18px',
                color: n === playerCount ? '#000000' : '#c4a44e',
            }).setOrigin(0.5);
            this.setupContainer.add(bg);
            this.setupContainer.add(txt);
            countButtons.push(bg);
            countTexts.push(txt);

            bg.on('pointerdown', () => {
                playerCount = n;
                for (let j = 0; j < 4; j++) {
                    const selected = j + 1 === playerCount;
                    countButtons[j].setFillStyle(selected ? 0xc4a44e : 0x2a2a4a);
                    countTexts[j].setColor(selected ? '#000000' : '#c4a44e');
                }
                rebuildPlayerRows();
            });
        }

        // Map size selector
        const sizeLabelY = panelY - panelH / 2 + 130;
        const sizeLabel = this.add.text(panelX - 100, sizeLabelY, 'Map Size:', {
            fontFamily: 'serif',
            fontSize: '20px',
            color: '#ffffff',
        }).setOrigin(0, 0.5);
        this.setupContainer.add(sizeLabel);

        const sizeButtons: Phaser.GameObjects.Rectangle[] = [];
        const sizeTexts: Phaser.GameObjects.Text[] = [];

        for (let si = 0; si < mapSizes.length; si++) {
            const size = mapSizes[si];
            const bx = panelX + 20 + si * 60;
            const bg = this.add.rectangle(bx, sizeLabelY, s(50), s(36), size === selectedMapSize ? 0xc4a44e : 0x2a2a4a)
                .setStrokeStyle(1, 0xc4a44e)
                .setInteractive({ useHandCursor: true });
            const txt = this.add.text(bx, sizeLabelY, mapSizeLabels[size], {
                fontFamily: 'serif',
                fontSize: fs(14),
                color: size === selectedMapSize ? '#000000' : '#c4a44e',
            }).setOrigin(0.5);
            this.setupContainer.add(bg);
            this.setupContainer.add(txt);
            sizeButtons.push(bg);
            sizeTexts.push(txt);

            bg.on('pointerdown', () => {
                selectedMapSize = size;
                for (let j = 0; j < mapSizes.length; j++) {
                    const sel = mapSizes[j] === selectedMapSize;
                    sizeButtons[j].setFillStyle(sel ? 0xc4a44e : 0x2a2a4a);
                    sizeTexts[j].setColor(sel ? '#000000' : '#c4a44e');
                }
            });
        }

        // Player rows container
        const rowsContainer = this.add.container(0, 0);
        this.setupContainer.add(rowsContainer);

        let dropdownContainer: Phaser.GameObjects.Container | null = null;

        const destroyDropdown = () => {
            if (dropdownContainer) {
                dropdownContainer.destroy();
                dropdownContainer = null;
            }
        };

        const openDropdown = (btnX: number, btnY: number, idx: number, factionText: Phaser.GameObjects.Text) => {
            destroyDropdown();

            dropdownContainer = this.add.container(0, 0).setDepth(20);

            // Full-screen hit area to catch outside clicks
            const { width: screenW, height: screenH } = this.cameras.main;
            const blocker = this.add.rectangle(screenW / 2, screenH / 2, screenW, screenH, 0x000000, 0)
                .setInteractive();
            dropdownContainer.add(blocker);
            blocker.on('pointerdown', () => destroyDropdown());

            const rowW = s(160);
            const rowH = s(30);

            for (let f = 0; f < factions.length; f++) {
                const ry = btnY + 18 + f * rowH + rowH / 2;
                const isSelected = factions[f] === playerFactions[idx];

                const rowBg = this.add.rectangle(btnX, ry, rowW, rowH, isSelected ? 0xc4a44e : 0x2a2a4a)
                    .setStrokeStyle(1, 0x444466)
                    .setInteractive({ useHandCursor: true });
                dropdownContainer.add(rowBg);

                const rowText = this.add.text(btnX, ry, this.capitalize(factions[f]), {
                    fontFamily: 'serif',
                    fontSize: fs(14),
                    color: isSelected ? '#000000' : '#c4a44e',
                }).setOrigin(0.5);
                dropdownContainer.add(rowText);

                if (!isSelected) {
                    rowBg.on('pointerover', () => rowBg.setFillStyle(0x3a3a5a));
                    rowBg.on('pointerout', () => rowBg.setFillStyle(0x2a2a4a));
                }

                const faction = factions[f];
                rowBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                    pointer.event.stopPropagation();
                    playerFactions[idx] = faction;
                    factionText.setText(this.capitalize(faction));
                    destroyDropdown();
                });
            }
        };

        const rebuildPlayerRows = () => {
            destroyDropdown();
            rowsContainer.removeAll(true);

            for (let i = 0; i < playerCount; i++) {
                const rowY = panelY - panelH / 2 + 185 + i * 50;

                const nameText = this.add.text(panelX - 180, rowY, `Player ${i + 1}`, {
                    fontFamily: 'serif',
                    fontSize: '18px',
                    color: '#ffffff',
                }).setOrigin(0, 0.5);
                rowsContainer.add(nameText);

                const factionBg = this.add.rectangle(panelX + 80, rowY, s(160), s(36), 0x2a2a4a)
                    .setStrokeStyle(1, 0xc4a44e)
                    .setInteractive({ useHandCursor: true });
                rowsContainer.add(factionBg);

                const factionText = this.add.text(panelX + 80, rowY, this.capitalize(playerFactions[i]), {
                    fontFamily: 'serif',
                    fontSize: '16px',
                    color: '#c4a44e',
                }).setOrigin(0.5);
                rowsContainer.add(factionText);

                const idx = i;
                factionBg.on('pointerover', () => factionBg.setFillStyle(0x3a3a5a));
                factionBg.on('pointerout', () => factionBg.setFillStyle(0x2a2a4a));
                factionBg.on('pointerdown', () => {
                    openDropdown(panelX + 80, rowY, idx, factionText);
                });
            }
        };

        rebuildPlayerRows();

        // Start button
        const startY = panelY + panelH / 2 - 85;
        const startBg = this.add.rectangle(panelX, startY, s(160), s(44), 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true });
        this.setupContainer.add(startBg);

        const startText = this.add.text(panelX, startY, 'Start', {
            fontFamily: 'serif',
            fontSize: fs(18),
            color: '#c4a44e',
        }).setOrigin(0.5);
        this.setupContainer.add(startText);

        startBg.on('pointerover', () => startBg.setFillStyle(0x3a3a5a));
        startBg.on('pointerout', () => startBg.setFillStyle(0x2a2a4a));
        startBg.on('pointerdown', async () => {
            destroyDropdown();
            startText.setText('Creating...');
            startBg.disableInteractive();

            const players: PlayerConfig[] = [];
            for (let i = 0; i < playerCount; i++) {
                players.push({ name: `Player ${i + 1}`, faction: playerFactions[i] });
            }

            try {
                const gameState = await apiClient.createGame(players, selectedMapSize);
                gameStore.setState(gameState);
                this.scene.start('AdventureMapScene');
            } catch (error) {
                console.error('Failed to create game:', error);
                startText.setText('Error! Retry');
                startBg.setInteractive({ useHandCursor: true });
            }
        });

        // Back button
        const backY = panelY + panelH / 2 - 30;
        const backBg = this.add.rectangle(panelX, backY, s(120), s(40), 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true });
        this.setupContainer.add(backBg);

        const backText = this.add.text(panelX, backY, 'Back', {
            fontFamily: 'serif',
            fontSize: fs(18),
            color: '#c4a44e',
        }).setOrigin(0.5);
        this.setupContainer.add(backText);

        backBg.on('pointerover', () => backBg.setFillStyle(0x3a3a5a));
        backBg.on('pointerout', () => backBg.setFillStyle(0x2a2a4a));
        backBg.on('pointerdown', () => {
            destroyDropdown();
            this.setupContainer?.destroy();
            this.setupContainer = null;
            this.showMainButtons();
        });
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

            const rowH = s(50);
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

                // Map size label
                const sizeLabel = game.mapWidth <= 20 ? 'Small' : game.mapWidth <= 36 ? 'Medium' : 'Large';
                const sizeText = this.add.text(leftText.x + leftText.width + 12, rowY, sizeLabel, {
                    fontFamily: 'serif',
                    fontSize: '14px',
                    color: '#888899',
                }).setOrigin(0, 0.5);
                this.listContainer.add(sizeText);

                // Delete button
                const delBtnX = panelX + rowW / 2 - 20;
                const delBg = this.add.rectangle(delBtnX, rowY, Math.max(s(30), 44), Math.max(s(30), 44), 0x661a1a)
                    .setStrokeStyle(1, 0xcc3333)
                    .setInteractive({ useHandCursor: true })
                    .setDepth(1);
                this.listContainer.add(delBg);

                const delText = this.add.text(delBtnX, rowY, 'X', {
                    fontFamily: 'serif',
                    fontSize: '14px',
                    color: '#cc3333',
                    fontStyle: 'bold',
                }).setOrigin(0.5).setDepth(1);
                this.listContainer.add(delText);

                delBg.on('pointerover', () => delBg.setFillStyle(0x882222));
                delBg.on('pointerout', () => delBg.setFillStyle(0x661a1a));
                delBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                    pointer.event.stopPropagation();
                    this.showDeleteConfirmation(game.id);
                });

                // Right: day info
                const dayInfo = `Month ${game.currentMonth}, Week ${game.currentWeek}, Day ${game.currentDay}`;
                const rightText = this.add.text(delBtnX - 40, rowY, dayInfo, {
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

    private showDeleteConfirmation(gameId: string): void {
        const { width, height } = this.cameras.main;

        this.confirmContainer = this.add.container(0, 0).setDepth(10);

        // Semi-transparent overlay
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
            .setInteractive();
        this.confirmContainer.add(overlay);

        // Dialog panel
        const dialogW = 300;
        const dialogH = 140;
        const dialogBg = this.add.rectangle(width / 2, height / 2, dialogW, dialogH, 0x1a1a2e)
            .setStrokeStyle(2, 0xc4a44e);
        this.confirmContainer.add(dialogBg);

        const promptText = this.add.text(width / 2, height / 2 - 30, 'Delete this game?', {
            fontFamily: 'serif',
            fontSize: '20px',
            color: '#ffffff',
        }).setOrigin(0.5);
        this.confirmContainer.add(promptText);

        // Yes button
        const yesBg = this.add.rectangle(width / 2 - 60, height / 2 + 25, 90, 36, 0x661a1a)
            .setStrokeStyle(1, 0xcc3333)
            .setInteractive({ useHandCursor: true });
        const yesText = this.add.text(width / 2 - 60, height / 2 + 25, 'Yes', {
            fontFamily: 'serif',
            fontSize: '18px',
            color: '#cc3333',
        }).setOrigin(0.5);
        this.confirmContainer.add(yesBg);
        this.confirmContainer.add(yesText);

        yesBg.on('pointerover', () => yesBg.setFillStyle(0x882222));
        yesBg.on('pointerout', () => yesBg.setFillStyle(0x661a1a));
        yesBg.on('pointerdown', async () => {
            yesText.setText('...');
            yesBg.disableInteractive();
            try {
                await apiClient.deleteGame(gameId);
                this.confirmContainer?.destroy();
                this.confirmContainer = null;
                this.listContainer?.destroy();
                this.listContainer = null;
                this.showLoadGamePanel();
            } catch (error) {
                console.error('Failed to delete game:', error);
                yesText.setText('Error');
                yesBg.setInteractive({ useHandCursor: true });
            }
        });

        // No button
        const noBg = this.add.rectangle(width / 2 + 60, height / 2 + 25, 90, 36, 0x2a2a4a)
            .setStrokeStyle(1, 0xc4a44e)
            .setInteractive({ useHandCursor: true });
        const noText = this.add.text(width / 2 + 60, height / 2 + 25, 'No', {
            fontFamily: 'serif',
            fontSize: '18px',
            color: '#c4a44e',
        }).setOrigin(0.5);
        this.confirmContainer.add(noBg);
        this.confirmContainer.add(noText);

        noBg.on('pointerover', () => noBg.setFillStyle(0x3a3a5a));
        noBg.on('pointerout', () => noBg.setFillStyle(0x2a2a4a));
        noBg.on('pointerdown', () => {
            this.confirmContainer?.destroy();
            this.confirmContainer = null;
        });
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
