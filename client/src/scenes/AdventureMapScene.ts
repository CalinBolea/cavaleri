import Phaser from 'phaser';
import { gameStore, GameState } from '../state/GameStore';
import { apiClient } from '../network/ApiClient';

const HEX_SIZE = 24;
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
const HEX_HEIGHT = 2 * HEX_SIZE;
const HEX_VERT_SPACING = HEX_HEIGHT * 0.75;

const TERRAIN_COLORS: Record<string, number> = {
    grass: 0x4a7c32,
    dirt: 0x8b7355,
    water: 0x2266aa,
    forest: 0x2d5a1e,
    mountain: 0x666666,
};

const UI_HEIGHT = 60;

export class AdventureMapScene extends Phaser.Scene {
    private hexGraphics!: Phaser.GameObjects.Graphics;
    private heroGraphics!: Phaser.GameObjects.Graphics;
    private mapContainer!: Phaser.GameObjects.Container;
    private isMoving = false;
    private dayText!: Phaser.GameObjects.Text;
    private movementText!: Phaser.GameObjects.Text;
    private resourceTexts: Record<string, Phaser.GameObjects.Text> = {};
    private hoverGraphics!: Phaser.GameObjects.Graphics;
    private heroLabel!: Phaser.GameObjects.Text | null;

    constructor() {
        super({ key: 'AdventureMapScene' });
    }

    create(): void {
        const state = gameStore.getState();
        if (!state) {
            this.scene.start('MainMenuScene');
            return;
        }

        this.heroLabel = null;

        // Create map container for camera scrolling
        this.mapContainer = this.add.container(0, UI_HEIGHT);

        // Create hex graphics within container
        this.hexGraphics = this.add.graphics();
        this.mapContainer.add(this.hexGraphics);

        this.hoverGraphics = this.add.graphics();
        this.mapContainer.add(this.hoverGraphics);

        this.heroGraphics = this.add.graphics();
        this.mapContainer.add(this.heroGraphics);

        this.drawMap(state);
        this.drawHero(state);
        this.createUI(state);

        // Input: click to move
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.y < UI_HEIGHT) return; // Don't process clicks on UI
            this.handleMapClick(pointer);
        });

        // Camera controls with arrow keys and WASD
        const cursors = this.input.keyboard!.createCursorKeys();
        const wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;

        this.events.on('update', () => {
            const speed = 5;
            if (cursors.left.isDown || wasd.A.isDown) this.mapContainer.x += speed;
            if (cursors.right.isDown || wasd.D.isDown) this.mapContainer.x -= speed;
            if (cursors.up.isDown || wasd.W.isDown) this.mapContainer.y += speed;
            if (cursors.down.isDown || wasd.S.isDown) this.mapContainer.y -= speed;
        });

        // Mouse hover for hex highlight
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (pointer.y < UI_HEIGHT) {
                this.hoverGraphics.clear();
                return;
            }
            this.handleHover(pointer);
        });
    }

    update(): void {
        // Handled via events
    }

    private drawMap(state: GameState): void {
        this.hexGraphics.clear();

        for (let row = 0; row < state.mapHeight; row++) {
            for (let col = 0; col < state.mapWidth; col++) {
                const terrain = state.mapData[row][col];
                const color = TERRAIN_COLORS[terrain] ?? 0x333333;
                const { x, y } = this.hexToPixel(col, row);

                this.hexGraphics.fillStyle(color, 1);
                this.hexGraphics.lineStyle(1, 0x000000, 0.3);
                this.drawHexagon(this.hexGraphics, x, y);
            }
        }
    }

    private drawHero(state: GameState): void {
        this.heroGraphics.clear();

        const hero = gameStore.getSelectedHero();
        if (!hero) return;

        const { x, y } = this.hexToPixel(hero.posX, hero.posY);

        // Hero circle
        this.heroGraphics.fillStyle(0xffcc00, 1);
        this.heroGraphics.lineStyle(2, 0xffffff, 1);
        this.heroGraphics.fillCircle(x, y, HEX_SIZE * 0.6);
        this.heroGraphics.strokeCircle(x, y, HEX_SIZE * 0.6);

        // Remove old hero label if it exists
        if (this.heroLabel) {
            this.heroLabel.destroy();
        }

        // Hero letter
        this.heroLabel = this.add.text(x, y, 'H', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#000000',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.mapContainer.add(this.heroLabel);
    }

    private createUI(state: GameState): void {
        const { width } = this.cameras.main;
        const player = gameStore.getCurrentPlayer()!;
        const hero = gameStore.getSelectedHero()!;

        // UI background (fixed, drawn on default camera)
        this.add.rectangle(width / 2, UI_HEIGHT / 2, width, UI_HEIGHT, 0x1a1a2e, 0.95)
            .setDepth(100)
            .setScrollFactor(0);

        this.add.rectangle(width / 2, UI_HEIGHT, width, 2, 0xc4a44e)
            .setDepth(100)
            .setScrollFactor(0);

        // Resources
        const resources = player.resources;
        const resourceLabels = [
            { key: 'gold', label: 'Gold', color: '#ffd700' },
            { key: 'wood', label: 'Wood', color: '#8b4513' },
            { key: 'ore', label: 'Ore', color: '#808080' },
        ];

        let xPos = 20;
        for (const { key, label, color } of resourceLabels) {
            this.add.text(xPos, 10, label + ':', {
                fontFamily: 'Arial',
                fontSize: '14px',
                color: '#aaaaaa',
            }).setDepth(101).setScrollFactor(0);

            this.resourceTexts[key] = this.add.text(xPos, 30, String(resources[key as keyof typeof resources]), {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: color,
                fontStyle: 'bold',
            }).setDepth(101).setScrollFactor(0);

            xPos += 100;
        }

        // Day counter
        this.dayText = this.add.text(width / 2, 20, this.getDayString(state), {
            fontFamily: 'serif',
            fontSize: '18px',
            color: '#c4a44e',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(101).setScrollFactor(0);

        // Movement points
        this.movementText = this.add.text(width - 280, 20, `MP: ${hero.movementPoints}/${hero.maxMovementPoints}`, {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#88cc88',
        }).setOrigin(0.5).setDepth(101).setScrollFactor(0);

        // End Turn button
        const endTurnBg = this.add.rectangle(width - 100, UI_HEIGHT / 2, 140, 40, 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true })
            .setDepth(101)
            .setScrollFactor(0);

        this.add.text(width - 100, UI_HEIGHT / 2, 'End Turn', {
            fontFamily: 'serif',
            fontSize: '18px',
            color: '#c4a44e',
        }).setOrigin(0.5).setDepth(101).setScrollFactor(0);

        endTurnBg.on('pointerover', () => endTurnBg.setFillStyle(0x3a3a5a));
        endTurnBg.on('pointerout', () => endTurnBg.setFillStyle(0x2a2a4a));
        endTurnBg.on('pointerdown', () => this.handleEndTurn());
    }

    private async handleMapClick(pointer: Phaser.Input.Pointer): Promise<void> {
        if (this.isMoving) return;

        const state = gameStore.getState();
        const hero = gameStore.getSelectedHero();
        if (!state || !hero) return;

        // Convert screen coords to map coords
        const mapX = pointer.x - this.mapContainer.x;
        const mapY = pointer.y - this.mapContainer.y;
        const hex = this.pixelToHex(mapX, mapY);

        if (hex.col < 0 || hex.col >= state.mapWidth || hex.row < 0 || hex.row >= state.mapHeight) return;
        if (hex.col === hero.posX && hex.row === hero.posY) return;

        this.isMoving = true;

        try {
            const result = await apiClient.moveHero(state.id, hero.id, hex.col, hex.row);
            gameStore.updateFromGameState(result.game);

            // Animate hero along path
            if (result.path && result.path.length > 1) {
                await this.animateHeroPath(result.path);
            }

            this.refreshDisplay();
        } catch (error: any) {
            console.warn('Move failed:', error.message);
        } finally {
            this.isMoving = false;
        }
    }

    private async handleEndTurn(): Promise<void> {
        const state = gameStore.getState();
        if (!state) return;

        try {
            const newState = await apiClient.endTurn(state.id);
            gameStore.updateFromGameState(newState);
            this.refreshDisplay();
        } catch (error) {
            console.error('End turn failed:', error);
        }
    }

    private refreshDisplay(): void {
        const state = gameStore.getState();
        if (!state) return;

        const player = gameStore.getCurrentPlayer()!;
        const hero = gameStore.getSelectedHero()!;

        // Update day text
        this.dayText.setText(this.getDayString(state));

        // Update resources
        for (const key of Object.keys(this.resourceTexts)) {
            this.resourceTexts[key].setText(String(player.resources[key as keyof typeof player.resources]));
        }

        // Update movement points
        this.movementText.setText(`MP: ${hero.movementPoints}/${hero.maxMovementPoints}`);

        // Redraw hero
        this.drawHero(state);
    }

    private animateHeroPath(path: number[][]): Promise<void> {
        return new Promise((resolve) => {
            // Remove old hero label
            if (this.heroLabel) {
                this.heroLabel.destroy();
                this.heroLabel = null;
            }

            let step = 1;
            const timer = this.time.addEvent({
                delay: 100,
                callback: () => {
                    if (step >= path.length) {
                        timer.remove();
                        resolve();
                        return;
                    }

                    const [col, row] = path[step];
                    const { x, y } = this.hexToPixel(col, row);

                    this.heroGraphics.clear();
                    this.heroGraphics.fillStyle(0xffcc00, 1);
                    this.heroGraphics.lineStyle(2, 0xffffff, 1);
                    this.heroGraphics.fillCircle(x, y, HEX_SIZE * 0.6);
                    this.heroGraphics.strokeCircle(x, y, HEX_SIZE * 0.6);

                    step++;

                    if (step >= path.length) {
                        // Add label at final position
                        this.heroLabel = this.add.text(x, y, 'H', {
                            fontFamily: 'Arial',
                            fontSize: '16px',
                            color: '#000000',
                            fontStyle: 'bold',
                        }).setOrigin(0.5);
                        this.mapContainer.add(this.heroLabel);
                        timer.remove();
                        resolve();
                    }
                },
                loop: true,
            });
        });
    }

    private handleHover(pointer: Phaser.Input.Pointer): void {
        this.hoverGraphics.clear();

        const state = gameStore.getState();
        if (!state) return;

        const mapX = pointer.x - this.mapContainer.x;
        const mapY = pointer.y - this.mapContainer.y;
        const hex = this.pixelToHex(mapX, mapY);

        if (hex.col < 0 || hex.col >= state.mapWidth || hex.row < 0 || hex.row >= state.mapHeight) return;

        const { x, y } = this.hexToPixel(hex.col, hex.row);
        this.hoverGraphics.lineStyle(2, 0xffffff, 0.8);
        this.drawHexagonOutline(this.hoverGraphics, x, y);
    }

    // ---- Hex math helpers ----

    private hexToPixel(col: number, row: number): { x: number; y: number } {
        const x = col * HEX_WIDTH + (row % 2 === 1 ? HEX_WIDTH / 2 : 0) + HEX_WIDTH / 2;
        const y = row * HEX_VERT_SPACING + HEX_HEIGHT / 2;
        return { x, y };
    }

    private pixelToHex(px: number, py: number): { col: number; row: number } {
        // Approximate: find closest hex center
        const row = Math.round((py - HEX_HEIGHT / 2) / HEX_VERT_SPACING);
        const offset = row % 2 === 1 ? HEX_WIDTH / 2 : 0;
        const col = Math.round((px - HEX_WIDTH / 2 - offset) / HEX_WIDTH);
        return { col, row };
    }

    private drawHexagon(graphics: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 180) * (60 * i - 30); // pointy-top
            points.push({
                x: cx + HEX_SIZE * Math.cos(angle),
                y: cy + HEX_SIZE * Math.sin(angle),
            });
        }

        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < 6; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
    }

    private drawHexagonOutline(graphics: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 180) * (60 * i - 30);
            points.push({
                x: cx + HEX_SIZE * Math.cos(angle),
                y: cy + HEX_SIZE * Math.sin(angle),
            });
        }

        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < 6; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.closePath();
        graphics.strokePath();
    }

    private getDayString(state: GameState): string {
        return `Month ${state.currentMonth}, Week ${state.currentWeek}, Day ${state.currentDay}`;
    }
}
