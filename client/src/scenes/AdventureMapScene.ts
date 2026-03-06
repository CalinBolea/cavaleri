import Phaser from 'phaser';
import { gameStore, GameState } from '../state/GameStore';
import { apiClient } from '../network/ApiClient';
import { CombatResultDialog } from '../ui/CombatResultDialog';
import { findPath, getPathCost } from '../utils/pathfinding';

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
    private neutralGraphics!: Phaser.GameObjects.Graphics;
    private neutralLabels: Phaser.GameObjects.Text[] = [];
    private armyTexts: Phaser.GameObjects.Text[] = [];
    private pendingTarget: { col: number; row: number } | null = null;
    private pathPreviewGraphics!: Phaser.GameObjects.Graphics;
    private pathCostText: Phaser.GameObjects.Text | null = null;

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

        this.neutralGraphics = this.add.graphics();
        this.mapContainer.add(this.neutralGraphics);

        this.hoverGraphics = this.add.graphics();
        this.mapContainer.add(this.hoverGraphics);

        this.pathPreviewGraphics = this.add.graphics();
        this.mapContainer.add(this.pathPreviewGraphics);

        this.heroGraphics = this.add.graphics();
        this.mapContainer.add(this.heroGraphics);

        this.pendingTarget = null;

        this.drawMap(state);
        this.drawNeutralStacks(state);
        this.drawHero(state);
        this.createUI(state);
        this.createLegend();

        // Input: click to move
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.y < UI_HEIGHT) return; // Don't process clicks on top UI
            if (pointer.y > this.cameras.main.height - 50) return; // Don't process clicks on bottom panel
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

    private drawNeutralStacks(state: GameState): void {
        this.neutralGraphics.clear();
        for (const label of this.neutralLabels) {
            label.destroy();
        }
        this.neutralLabels = [];

        if (!state.neutralStacks) return;

        for (const stack of state.neutralStacks) {
            const { x, y } = this.hexToPixel(stack.posX, stack.posY);

            this.neutralGraphics.fillStyle(0xcc3333, 1);
            this.neutralGraphics.fillCircle(x, y, HEX_SIZE * 0.5);

            const label = this.add.text(x, y + HEX_SIZE * 0.7, `${this.capitalize(stack.unitId)}\nx${stack.quantity}`, {
                fontFamily: 'Arial',
                fontSize: '11px',
                color: '#ffffff',
                fontStyle: 'bold',
                align: 'center',
            }).setOrigin(0.5);
            this.mapContainer.add(label);
            this.neutralLabels.push(label);
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

        // Bottom army panel
        const { height } = this.cameras.main;
        const panelHeight = 50;

        this.add.rectangle(width / 2, height - panelHeight / 2, width, panelHeight, 0x1a1a2e, 0.95)
            .setDepth(100)
            .setScrollFactor(0);

        this.add.rectangle(width / 2, height - panelHeight, width, 2, 0xc4a44e)
            .setDepth(100)
            .setScrollFactor(0);

        this.armyTexts = [];
        if (hero) {
            const slotWidth = width / Math.max(hero.army.length, 1);
            for (let i = 0; i < hero.army.length; i++) {
                const slot = hero.army[i];
                const txt = this.add.text(
                    slotWidth * i + slotWidth / 2,
                    height - panelHeight / 2,
                    `${this.capitalize(slot.unitId)} x${slot.quantity}`,
                    {
                        fontFamily: 'Arial',
                        fontSize: '14px',
                        color: '#ffffff',
                        fontStyle: 'bold',
                    },
                ).setOrigin(0.5).setDepth(101).setScrollFactor(0);
                this.armyTexts.push(txt);
            }
        }
    }

    private createLegend(): void {
        const { height } = this.cameras.main;
        const entries = Object.entries(TERRAIN_COLORS);
        const padding = 8;
        const rowHeight = 18;
        const swatchSize = 10;
        const panelWidth = 100;
        const panelHeight = entries.length * rowHeight + padding * 2;
        const panelX = 10;
        const panelY = height - 50 - panelHeight - 10;

        this.add.rectangle(
            panelX + panelWidth / 2, panelY + panelHeight / 2,
            panelWidth, panelHeight, 0x1a1a2e, 0.9,
        ).setDepth(101).setScrollFactor(0);

        for (let i = 0; i < entries.length; i++) {
            const [terrain, color] = entries[i];
            const y = panelY + padding + i * rowHeight + rowHeight / 2;

            this.add.rectangle(
                panelX + padding + swatchSize / 2, y,
                swatchSize, swatchSize, color,
            ).setDepth(101).setScrollFactor(0);

            this.add.text(panelX + padding + swatchSize + 6, y, this.capitalize(terrain), {
                fontFamily: 'Arial',
                fontSize: '11px',
                color: '#ffffff',
            }).setOrigin(0, 0.5).setDepth(101).setScrollFactor(0);
        }
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

        if (hex.col < 0 || hex.col >= state.mapWidth || hex.row < 0 || hex.row >= state.mapHeight) {
            this.clearPathPreview();
            return;
        }
        if (hex.col === hero.posX && hex.row === hero.posY) {
            this.clearPathPreview();
            return;
        }

        // Second click on same target → confirm move
        if (this.pendingTarget && this.pendingTarget.col === hex.col && this.pendingTarget.row === hex.row) {
            this.clearPathPreview();
            await this.confirmMove(state, hero, hex.col, hex.row);
            return;
        }

        // First click or different target → show preview
        const path = findPath(state.mapData, hero.posX, hero.posY, hex.col, hex.row);
        if (!path) {
            this.clearPathPreview();
            return;
        }

        const cost = getPathCost(state.mapData, path);
        const reachable = cost <= hero.movementPoints;
        this.drawPathPreview(path, reachable, cost);
        this.pendingTarget = reachable ? { col: hex.col, row: hex.row } : null;
    }

    private async confirmMove(state: GameState, hero: { id: string; posX: number; posY: number }, col: number, row: number): Promise<void> {
        this.isMoving = true;

        try {
            const result = await apiClient.moveHero(state.id, hero.id, col, row);
            gameStore.updateFromGameState(result.game);

            if (result.path && result.path.length > 1) {
                await this.animateHeroPath(result.path);
            }

            if (result.combat?.occurred) {
                const dialog = new CombatResultDialog(this, result.combat.result);
                dialog.show();
                await dialog.waitForDismissal();
            }

            this.refreshDisplay();

            const currentState = gameStore.getState();
            if (currentState?.status === 'won') {
                this.showVictory();
                return;
            }

            if (result.combat?.occurred && !result.combat.result.attackerWon) {
                const selectedHero = gameStore.getSelectedHero();
                if (!selectedHero) {
                    this.showGameOver();
                    return;
                }
            }
        } catch (error: any) {
            console.warn('Move failed:', error.message);
        } finally {
            this.isMoving = false;
        }
    }

    private drawPathPreview(path: number[][], reachable: boolean, cost: number): void {
        this.pathPreviewGraphics.clear();
        if (this.pathCostText) {
            this.pathCostText.destroy();
            this.pathCostText = null;
        }

        const color = reachable ? 0x44ff44 : 0xff4444;
        const alpha = 0.3;

        for (let i = 1; i < path.length; i++) {
            const [col, row] = path[i];
            const { x, y } = this.hexToPixel(col, row);
            this.pathPreviewGraphics.fillStyle(color, alpha);
            this.drawFilledHex(this.pathPreviewGraphics, x, y);
        }

        // Cost text at destination hex
        const [lastCol, lastRow] = path[path.length - 1];
        const lastPos = this.hexToPixel(lastCol, lastRow);
        this.pathCostText = this.add.text(lastPos.x, lastPos.y - HEX_SIZE - 4, `${cost}`, {
            fontFamily: 'Arial',
            fontSize: '13px',
            color: reachable ? '#44ff44' : '#ff4444',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5);
        this.mapContainer.add(this.pathCostText);
    }

    private drawFilledHex(graphics: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
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
        graphics.fillPath();
    }

    private clearPathPreview(): void {
        this.pathPreviewGraphics.clear();
        if (this.pathCostText) {
            this.pathCostText.destroy();
            this.pathCostText = null;
        }
        this.pendingTarget = null;
    }

    private async handleEndTurn(): Promise<void> {
        this.clearPathPreview();
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
        const hero = gameStore.getSelectedHero();

        // Update day text
        this.dayText.setText(this.getDayString(state));

        // Update resources
        for (const key of Object.keys(this.resourceTexts)) {
            this.resourceTexts[key].setText(String(player.resources[key as keyof typeof player.resources]));
        }

        // Redraw neutral stacks
        this.drawNeutralStacks(state);

        if (hero) {
            // Update movement points
            this.movementText.setText(`MP: ${hero.movementPoints}/${hero.maxMovementPoints}`);
            // Redraw hero
            this.drawHero(state);
            // Update army panel
            for (let i = 0; i < this.armyTexts.length; i++) {
                if (i < hero.army.length) {
                    const slot = hero.army[i];
                    this.armyTexts[i].setText(`${this.capitalize(slot.unitId)} x${slot.quantity}`);
                    this.armyTexts[i].setVisible(true);
                } else {
                    this.armyTexts[i].setVisible(false);
                }
            }
        } else {
            this.movementText.setText('MP: --');
            this.heroGraphics.clear();
            if (this.heroLabel) {
                this.heroLabel.destroy();
                this.heroLabel = null;
            }
            for (const txt of this.armyTexts) {
                txt.setVisible(false);
            }
        }
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

    private showGameOver(): void {
        const { width, height } = this.cameras.main;

        // Full-screen dark overlay
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
            .setDepth(200)
            .setScrollFactor(0);

        // "Game Over" title
        this.add.text(width / 2, height / 2 - 60, 'Game Over', {
            fontFamily: 'serif',
            fontSize: '48px',
            color: '#cc3333',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0);

        // Subtitle
        this.add.text(width / 2, height / 2, 'Your hero has fallen.', {
            fontFamily: 'serif',
            fontSize: '20px',
            color: '#ffffff',
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0);

        // "New Game" button
        const btnBg = this.add.rectangle(width / 2, height / 2 + 60, 160, 44, 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true })
            .setDepth(201)
            .setScrollFactor(0);

        this.add.text(width / 2, height / 2 + 60, 'New Game', {
            fontFamily: 'serif',
            fontSize: '20px',
            color: '#c4a44e',
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0);

        btnBg.on('pointerover', () => btnBg.setFillStyle(0x3a3a5a));
        btnBg.on('pointerout', () => btnBg.setFillStyle(0x2a2a4a));
        btnBg.on('pointerdown', () => this.scene.start('MainMenuScene'));
    }

    private showVictory(): void {
        const { width, height } = this.cameras.main;

        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
            .setDepth(200)
            .setScrollFactor(0);

        this.add.text(width / 2, height / 2 - 60, 'Victory!', {
            fontFamily: 'serif',
            fontSize: '48px',
            color: '#c4a44e',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0);

        this.add.text(width / 2, height / 2, 'All enemies have been defeated.', {
            fontFamily: 'serif',
            fontSize: '20px',
            color: '#ffffff',
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0);

        const btnBg = this.add.rectangle(width / 2, height / 2 + 60, 160, 44, 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true })
            .setDepth(201)
            .setScrollFactor(0);

        this.add.text(width / 2, height / 2 + 60, 'New Game', {
            fontFamily: 'serif',
            fontSize: '20px',
            color: '#c4a44e',
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0);

        btnBg.on('pointerover', () => btnBg.setFillStyle(0x3a3a5a));
        btnBg.on('pointerout', () => btnBg.setFillStyle(0x2a2a4a));
        btnBg.on('pointerdown', () => this.scene.start('MainMenuScene'));
    }

    private capitalize(s: string): string {
        return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
}
