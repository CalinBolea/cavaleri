import Phaser from 'phaser';
import { gameStore, GameState } from '../state/GameStore';
import { apiClient } from '../network/ApiClient';
import { CombatResultDialog } from '../ui/CombatResultDialog';
import { HeroDetailsDialog } from '../ui/HeroDetailsDialog';
import { LevelUpDialog } from '../ui/LevelUpDialog';
import { findPath, getPathCost } from '../utils/pathfinding';
import { IS_MOBILE, s, fs } from '../utils/uiScale';

const HEX_SIZE = 20;
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

const UI_HEIGHT = IS_MOBILE ? s(70) : 60;

const ZOOM_LEVELS = [0.6, 1.0, 1.5];
const DEFAULT_ZOOM_INDEX = 1;

const FACTION_TOWN_COLORS: Record<string, number> = {
    castle: 0xd4a843,
    necropolis: 0x4a2d6b,
    rampart: 0x2d8a4e,
    tower: 0x4a8ab5,
    inferno: 0xb5332e,
    dungeon: 0x6b3fa0,
    stronghold: 0xa0522d,
    fortress: 0x5a7a3a,
};

export class AdventureMapScene extends Phaser.Scene {
    private hexGraphics!: Phaser.GameObjects.Graphics;
    private heroGraphics!: Phaser.GameObjects.Graphics;
    private mapContainer!: Phaser.GameObjects.Container;
    private isMoving = false;
    private dayText!: Phaser.GameObjects.Text;
    private movementText!: Phaser.GameObjects.Text;
    private levelText!: Phaser.GameObjects.Text;
    private resourceTexts: Record<string, Phaser.GameObjects.Text> = {};
    private hoverGraphics!: Phaser.GameObjects.Graphics;
    private heroLabels: Phaser.GameObjects.Text[] = [];
    private neutralGraphics!: Phaser.GameObjects.Graphics;
    private neutralLabels: Phaser.GameObjects.Text[] = [];
    private townGraphics!: Phaser.GameObjects.Graphics;
    private townLabels: Phaser.GameObjects.Text[] = [];
    private armyTexts: Phaser.GameObjects.Text[] = [];
    private pendingTarget: { col: number; row: number } | null = null;
    private pathPreviewGraphics!: Phaser.GameObjects.Graphics;
    private pathCostText: Phaser.GameObjects.Text | null = null;
    private playerIndicator!: Phaser.GameObjects.Text;
    private playerIndicatorRect!: Phaser.GameObjects.Rectangle;
    private uiCamera!: Phaser.Cameras.Scene2D.Camera;
    private uiElements: Phaser.GameObjects.GameObject[] = [];
    private zoomIndex: number = DEFAULT_ZOOM_INDEX;
    private isDragging = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private pointerDownX = 0;
    private pointerDownY = 0;
    private pointerIsDown = false;
    private readonly DRAG_THRESHOLD = 10;
    private lastPinchDistance = 0;
    private isTouchDevice = false;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

    constructor() {
        super({ key: 'AdventureMapScene' });
    }

    create(): void {
        const state = gameStore.getState();
        if (!state) {
            this.scene.start('MainMenuScene');
            return;
        }

        this.heroLabels = [];

        // Create map container
        const mapPixelWidth = state.mapWidth * HEX_WIDTH + HEX_WIDTH / 2;
        const mapPixelHeight = state.mapHeight * HEX_VERT_SPACING + HEX_HEIGHT / 2;
        const bottomPanelHeight = 50;
        const totalWidth = Math.max(this.cameras.main.width, mapPixelWidth);
        const totalHeight = mapPixelHeight + UI_HEIGHT + bottomPanelHeight;
        this.cameras.main.setBounds(0, 0, totalWidth, totalHeight);

        // Create UI camera (no zoom, no scroll)
        const { width: camW, height: camH } = this.cameras.main;
        this.uiCamera = this.cameras.add(0, 0, camW, camH);
        this.uiCamera.setScroll(0, 0);
        this.uiElements = [];

        this.mapContainer = this.add.container(0, UI_HEIGHT);

        // Create hex graphics within container
        this.hexGraphics = this.add.graphics();
        this.mapContainer.add(this.hexGraphics);

        this.townGraphics = this.add.graphics();
        this.mapContainer.add(this.townGraphics);

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
        this.drawTowns(state);
        this.drawNeutralStacks(state);
        this.drawHero(state);
        this.createUI(state);
        this.createLegend();

        // Camera isolation: UI on uiCamera only, map on main camera only
        for (const obj of this.uiElements) {
            this.cameras.main.ignore(obj);
        }
        this.uiCamera.ignore(this.mapContainer);

        // Disable right-click context menu
        this.input.mouse?.disableContextMenu();

        // Detect touch device
        this.isTouchDevice = this.sys.game.device.input.touch;

        // Keyboard setup
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = {
            W: this.input.keyboard!.addKey('W'),
            A: this.input.keyboard!.addKey('A'),
            S: this.input.keyboard!.addKey('S'),
            D: this.input.keyboard!.addKey('D'),
        };

        // Unified tap/drag input handling
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.isMoving) return;
            // Skip if second finger is down (pinch gesture)
            if (this.input.pointer1.isDown && this.input.pointer2.isDown) return;

            this.pointerDownX = pointer.x;
            this.pointerDownY = pointer.y;
            this.pointerIsDown = true;
            this.isDragging = false;
            this.dragStartX = pointer.x;
            this.dragStartY = pointer.y;
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            // Skip if pinch gesture
            if (this.input.pointer1.isDown && this.input.pointer2.isDown) return;

            if (this.pointerIsDown) {
                const dx = pointer.x - this.pointerDownX;
                const dy = pointer.y - this.pointerDownY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (!this.isDragging && dist > this.DRAG_THRESHOLD) {
                    this.isDragging = true;
                }

                if (this.isDragging) {
                    this.cameras.main.scrollX -= (pointer.x - this.dragStartX);
                    this.cameras.main.scrollY -= (pointer.y - this.dragStartY);
                    this.dragStartX = pointer.x;
                    this.dragStartY = pointer.y;
                    return;
                }
            }

            if (pointer.y < UI_HEIGHT) {
                this.hoverGraphics.clear();
                return;
            }
            if (!this.isDragging && !this.isMoving) {
                this.handleHover(pointer);
            }
        });

        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (this.isMoving) return;
            if (!this.pointerIsDown) return;
            this.pointerIsDown = false;

            if (!this.isDragging) {
                // Treat as tap — fire map click
                if (pointer.y >= UI_HEIGHT && pointer.y <= this.cameras.main.height - 50) {
                    this.handleMapClick(pointer);
                }
            }
            this.isDragging = false;
        });

        // Zoom via mouse wheel
        this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gos: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
            if (dy > 0) this.setZoomLevel(this.zoomIndex - 1);   // scroll down = zoom out
            else if (dy < 0) this.setZoomLevel(this.zoomIndex + 1); // scroll up = zoom in
        });

        this.setZoomLevel(DEFAULT_ZOOM_INDEX);

        // Center camera on current player's hero
        const hero = gameStore.getSelectedHero();
        if (hero) {
            const heroPixel = this.hexToPixel(hero.posX, hero.posY);
            this.cameras.main.centerOn(heroPixel.x, heroPixel.y + UI_HEIGHT);
        }
    }

    update(): void {
        const SCROLL_SPEED = 8;
        const cam = this.cameras.main;

        // Keyboard panning
        if (this.cursors?.left.isDown || this.wasd?.A.isDown) cam.scrollX -= SCROLL_SPEED;
        if (this.cursors?.right.isDown || this.wasd?.D.isDown) cam.scrollX += SCROLL_SPEED;
        if (this.cursors?.up.isDown || this.wasd?.W.isDown) cam.scrollY -= SCROLL_SPEED;
        if (this.cursors?.down.isDown || this.wasd?.S.isDown) cam.scrollY += SCROLL_SPEED;

        // Edge scrolling (disabled on touch — fires constantly during normal touch)
        if (!this.isTouchDevice) {
            const EDGE = 20;
            const pointer = this.input.activePointer;
            if (pointer.x < EDGE) cam.scrollX -= SCROLL_SPEED;
            if (pointer.x > cam.width - EDGE) cam.scrollX += SCROLL_SPEED;
            if (pointer.y < EDGE) cam.scrollY -= SCROLL_SPEED;
            if (pointer.y > cam.height - EDGE) cam.scrollY += SCROLL_SPEED;
        }

        // Pinch-to-zoom
        this.handlePinchZoom();
    }

    private handlePinchZoom(): void {
        const pointer1 = this.input.pointer1;
        const pointer2 = this.input.pointer2;

        if (pointer1.isDown && pointer2.isDown) {
            const dx = pointer1.x - pointer2.x;
            const dy = pointer1.y - pointer2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (this.lastPinchDistance > 0) {
                const delta = dist - this.lastPinchDistance;
                if (delta > 20) {
                    this.setZoomLevel(this.zoomIndex + 1);
                    this.lastPinchDistance = dist;
                } else if (delta < -20) {
                    this.setZoomLevel(this.zoomIndex - 1);
                    this.lastPinchDistance = dist;
                }
            } else {
                this.lastPinchDistance = dist;
            }
        } else {
            this.lastPinchDistance = 0;
        }
    }

    private setZoomLevel(index: number): void {
        const clamped = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, index));
        this.zoomIndex = clamped;
        this.cameras.main.setZoom(ZOOM_LEVELS[clamped]);
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

    private drawTowns(state: GameState): void {
        this.townGraphics.clear();
        for (const label of this.townLabels) {
            label.destroy();
        }
        this.townLabels = [];

        if (!state.towns) return;

        for (const town of state.towns) {
            const { x, y } = this.hexToPixel(town.posX, town.posY);
            const factionColor = FACTION_TOWN_COLORS[town.factionId] ?? 0x888888;

            // Fill hex with faction color
            this.townGraphics.fillStyle(factionColor, 0.6);
            this.drawFilledHex(this.townGraphics, x, y);

            // Building shape: rect base + triangle roof
            const baseW = HEX_SIZE * 0.8;
            const baseH = HEX_SIZE * 0.5;
            this.townGraphics.fillStyle(factionColor, 1);
            this.townGraphics.fillRect(x - baseW / 2, y - baseH / 2 + 2, baseW, baseH);

            // Triangle roof
            this.townGraphics.beginPath();
            this.townGraphics.moveTo(x - baseW / 2 - 2, y - baseH / 2 + 2);
            this.townGraphics.lineTo(x, y - baseH / 2 - 6);
            this.townGraphics.lineTo(x + baseW / 2 + 2, y - baseH / 2 + 2);
            this.townGraphics.closePath();
            this.townGraphics.fillPath();

            // Ownership border
            if (town.ownerId) {
                const owner = state.players.find(p => p.id === town.ownerId);
                const borderColor = owner
                    ? Phaser.Display.Color.HexStringToColor(owner.color).color
                    : 0x888888;
                this.townGraphics.lineStyle(2, borderColor, 1);
            } else {
                this.townGraphics.lineStyle(2, 0x888888, 0.8);
            }
            this.drawStrokedHex(this.townGraphics, x, y);

            // Label
            const label = this.add.text(x, y + HEX_SIZE * 0.8, this.capitalize(town.factionId), {
                fontFamily: 'Arial',
                fontSize: '10px',
                color: '#ffffff',
                fontStyle: 'bold',
                align: 'center',
                stroke: '#000000',
                strokeThickness: 2,
            }).setOrigin(0.5);
            this.mapContainer.add(label);
            this.townLabels.push(label);
        }
    }

    private drawStrokedHex(graphics: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
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

        // Remove old hero labels
        for (const label of this.heroLabels) {
            label.destroy();
        }
        this.heroLabels = [];

        const currentPlayer = gameStore.getCurrentPlayer();

        for (const player of state.players) {
            const isCurrentPlayer = currentPlayer && player.id === currentPlayer.id;
            const playerColor = Phaser.Display.Color.HexStringToColor(player.color).color;

            for (const hero of player.heroes) {
                const { x, y } = this.hexToPixel(hero.posX, hero.posY);

                // Hero circle in player color
                this.heroGraphics.fillStyle(playerColor, 1);
                if (isCurrentPlayer) {
                    this.heroGraphics.lineStyle(2, 0xffffff, 1);
                } else {
                    this.heroGraphics.lineStyle(1, playerColor, 0.8);
                }
                this.heroGraphics.fillCircle(x, y, HEX_SIZE * 0.6);
                this.heroGraphics.strokeCircle(x, y, HEX_SIZE * 0.6);

                // Hero letter: first letter of player name
                const letter = player.name.charAt(0).toUpperCase();
                const label = this.add.text(x, y, letter, {
                    fontFamily: 'Arial',
                    fontSize: '14px',
                    color: '#000000',
                    fontStyle: 'bold',
                }).setOrigin(0.5);
                this.mapContainer.add(label);
                this.heroLabels.push(label);
            }
        }
    }

    private addUI<T extends Phaser.GameObjects.GameObject>(obj: T): T {
        this.uiElements.push(obj);
        return obj;
    }

    private createUI(state: GameState): void {
        const { width } = this.cameras.main;
        const player = gameStore.getCurrentPlayer()!;
        const hero = gameStore.getSelectedHero()!;

        // UI background
        this.addUI(this.add.rectangle(width / 2, UI_HEIGHT / 2, width, UI_HEIGHT, 0x1a1a2e, 0.95)
            .setDepth(100)
            .setScrollFactor(0));

        this.addUI(this.add.rectangle(width / 2, UI_HEIGHT, width, 2, 0xc4a44e)
            .setDepth(100)
            .setScrollFactor(0));

        // Resources
        const resources = player.resources;
        const resourceLabels = [
            { key: 'gold', label: 'Gold', color: '#ffd700' },
            { key: 'wood', label: 'Wood', color: '#8b4513' },
            { key: 'ore', label: 'Ore', color: '#808080' },
        ];

        let xPos = 20;
        for (const { key, label, color } of resourceLabels) {
            this.addUI(this.add.text(xPos, 10, label + ':', {
                fontFamily: 'Arial',
                fontSize: fs(14),
                color: '#aaaaaa',
            }).setDepth(101).setScrollFactor(0));

            this.resourceTexts[key] = this.addUI(this.add.text(xPos, 30, String(resources[key as keyof typeof resources]), {
                fontFamily: 'Arial',
                fontSize: fs(16),
                color: color,
                fontStyle: 'bold',
            }).setDepth(101).setScrollFactor(0));

            xPos += s(90);
        }

        // Day counter
        this.dayText = this.addUI(this.add.text(width / 2, 12, this.getDayString(state), {
            fontFamily: 'serif',
            fontSize: fs(16),
            color: '#c4a44e',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(101).setScrollFactor(0));

        // Current player indicator
        const playerColor = Phaser.Display.Color.HexStringToColor(player.color).color;
        this.playerIndicatorRect = this.addUI(this.add.rectangle(width / 2 - 50, 38, 12, 12, playerColor)
            .setDepth(101).setScrollFactor(0));

        this.playerIndicator = this.addUI(this.add.text(width / 2 - 38, 38, player.name, {
            fontFamily: 'serif',
            fontSize: fs(14),
            color: player.color,
        }).setOrigin(0, 0.5).setDepth(101).setScrollFactor(0));

        // Level & XP
        const lvMpX = IS_MOBILE ? width - 380 : width - 440;
        this.levelText = this.addUI(this.add.text(lvMpX, 20, `Lv.${hero.level} (${hero.experience} XP)`, {
            fontFamily: 'Arial',
            fontSize: fs(14),
            color: '#c4a44e',
        }).setOrigin(0.5).setDepth(101).setScrollFactor(0));

        // Movement points
        this.movementText = this.addUI(this.add.text(IS_MOBILE ? lvMpX : width - 320, IS_MOBILE ? 42 : 20, `MP: ${hero.movementPoints}/${hero.maxMovementPoints}`, {
            fontFamily: 'Arial',
            fontSize: fs(16),
            color: '#88cc88',
        }).setOrigin(0.5).setDepth(101).setScrollFactor(0));

        // End Turn button
        const endTurnBg = this.addUI(this.add.rectangle(width - 100, UI_HEIGHT / 2, s(140), s(40), 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true })
            .setDepth(101)
            .setScrollFactor(0));

        this.addUI(this.add.text(width - 100, UI_HEIGHT / 2, 'End Turn', {
            fontFamily: 'serif',
            fontSize: fs(18),
            color: '#c4a44e',
        }).setOrigin(0.5).setDepth(101).setScrollFactor(0));

        endTurnBg.on('pointerover', () => endTurnBg.setFillStyle(0x3a3a5a));
        endTurnBg.on('pointerout', () => endTurnBg.setFillStyle(0x2a2a4a));
        endTurnBg.on('pointerdown', () => this.handleEndTurn());

        // Quit button
        const quitBg = this.addUI(this.add.rectangle(width - 240, UI_HEIGHT / 2, s(80), s(40), 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true })
            .setDepth(101)
            .setScrollFactor(0));

        this.addUI(this.add.text(width - 240, UI_HEIGHT / 2, 'Quit', {
            fontFamily: 'serif',
            fontSize: fs(18),
            color: '#c4a44e',
        }).setOrigin(0.5).setDepth(101).setScrollFactor(0));

        quitBg.on('pointerover', () => quitBg.setFillStyle(0x3a3a5a));
        quitBg.on('pointerout', () => quitBg.setFillStyle(0x2a2a4a));
        quitBg.on('pointerdown', () => this.scene.start('MainMenuScene'));

        // Bottom army panel
        const { height } = this.cameras.main;
        const panelHeight = s(50);

        this.addUI(this.add.rectangle(width / 2, height - panelHeight / 2, width, panelHeight, 0x1a1a2e, 0.95)
            .setDepth(100)
            .setScrollFactor(0));

        this.addUI(this.add.rectangle(width / 2, height - panelHeight, width, 2, 0xc4a44e)
            .setDepth(100)
            .setScrollFactor(0));

        this.armyTexts = [];
        if (hero) {
            const slotWidth = width / Math.max(hero.army.length, 1);
            for (let i = 0; i < hero.army.length; i++) {
                const slot = hero.army[i];
                const txt = this.addUI(this.add.text(
                    slotWidth * i + slotWidth / 2,
                    height - panelHeight / 2,
                    `${this.capitalize(slot.unitId)} x${slot.quantity}`,
                    {
                        fontFamily: 'Arial',
                        fontSize: fs(14),
                        color: '#ffffff',
                        fontStyle: 'bold',
                    },
                ).setOrigin(0.5).setDepth(101).setScrollFactor(0));
                this.armyTexts.push(txt);
            }
        }
    }

    private createLegend(): void {
        const { width } = this.cameras.main;
        const entries = Object.entries(TERRAIN_COLORS);
        const padding = 8;
        const rowHeight = 18;
        const swatchSize = 10;
        const panelWidth = 100;
        const panelHeight = entries.length * rowHeight + padding * 2;
        const panelX = width - panelWidth - 10;
        const panelY = UI_HEIGHT + 10;

        // Hide terrain legend on mobile to save space
        if (!IS_MOBILE) {
            this.addUI(this.add.rectangle(
                panelX + panelWidth / 2, panelY + panelHeight / 2,
                panelWidth, panelHeight, 0x1a1a2e, 0.9,
            ).setDepth(101).setScrollFactor(0));

            for (let i = 0; i < entries.length; i++) {
                const [terrain, color] = entries[i];
                const y = panelY + padding + i * rowHeight + rowHeight / 2;

                this.addUI(this.add.rectangle(
                    panelX + padding + swatchSize / 2, y,
                    swatchSize, swatchSize, color,
                ).setDepth(101).setScrollFactor(0));

                this.addUI(this.add.text(panelX + padding + swatchSize + 6, y, this.capitalize(terrain), {
                    fontFamily: 'Arial',
                    fontSize: '11px',
                    color: '#ffffff',
                }).setOrigin(0, 0.5).setDepth(101).setScrollFactor(0));
            }
        }

        // Zoom buttons below legend (or directly below HUD on mobile)
        const btnWidth = s(40);
        const btnHeight = s(30);
        const btnGap = 6;
        const zoomY = (IS_MOBILE ? panelY : panelY + panelHeight) + btnGap + btnHeight / 2;
        const zoomPlusBg = this.addUI(this.add.rectangle(
            panelX + panelWidth / 2 - btnWidth / 2 - btnGap / 2, zoomY,
            btnWidth, btnHeight, 0x2a2a4a,
        ).setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true })
            .setDepth(101).setScrollFactor(0));

        this.addUI(this.add.text(
            panelX + panelWidth / 2 - btnWidth / 2 - btnGap / 2, zoomY, '+', {
                fontFamily: 'serif',
                fontSize: fs(20),
                color: '#c4a44e',
            }).setOrigin(0.5).setDepth(102).setScrollFactor(0));

        zoomPlusBg.on('pointerover', () => zoomPlusBg.setFillStyle(0x3a3a5a));
        zoomPlusBg.on('pointerout', () => zoomPlusBg.setFillStyle(0x2a2a4a));
        zoomPlusBg.on('pointerdown', () => this.setZoomLevel(this.zoomIndex + 1));

        const zoomMinusBg = this.addUI(this.add.rectangle(
            panelX + panelWidth / 2 + btnWidth / 2 + btnGap / 2, zoomY,
            btnWidth, btnHeight, 0x2a2a4a,
        ).setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true })
            .setDepth(101).setScrollFactor(0));

        this.addUI(this.add.text(
            panelX + panelWidth / 2 + btnWidth / 2 + btnGap / 2, zoomY, '\u2212', {
                fontFamily: 'serif',
                fontSize: fs(20),
                color: '#c4a44e',
            }).setOrigin(0.5).setDepth(102).setScrollFactor(0));

        zoomMinusBg.on('pointerover', () => zoomMinusBg.setFillStyle(0x3a3a5a));
        zoomMinusBg.on('pointerout', () => zoomMinusBg.setFillStyle(0x2a2a4a));
        zoomMinusBg.on('pointerdown', () => this.setZoomLevel(this.zoomIndex - 1));

        // Hero details button below zoom buttons
        const heroY = zoomY + btnHeight + btnGap;
        const heroBtnBg = this.addUI(this.add.rectangle(
            panelX + panelWidth / 2, heroY,
            s(90), s(30), 0x2a2a4a,
        ).setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true })
            .setDepth(101).setScrollFactor(0));

        this.addUI(this.add.text(
            panelX + panelWidth / 2, heroY, '\u{1F6E1} Hero', {
                fontFamily: 'serif',
                fontSize: fs(16),
                color: '#c4a44e',
            }).setOrigin(0.5).setDepth(102).setScrollFactor(0));

        heroBtnBg.on('pointerover', () => heroBtnBg.setFillStyle(0x3a3a5a));
        heroBtnBg.on('pointerout', () => heroBtnBg.setFillStyle(0x2a2a4a));
        heroBtnBg.on('pointerdown', async () => {
            const hero = gameStore.getSelectedHero();
            if (!hero) return;
            const dialog = new HeroDetailsDialog(this, hero);
            dialog.show();
            this.isMoving = true;
            try {
                await dialog.waitForDismissal();
            } finally {
                this.isMoving = false;
            }
        });
    }

    private async handleMapClick(pointer: Phaser.Input.Pointer): Promise<void> {
        if (this.isMoving) return;

        const state = gameStore.getState();
        const hero = gameStore.getSelectedHero();
        if (!state || !hero) return;

        // Convert world coords to map coords
        const mapX = pointer.worldX - this.mapContainer.x;
        const mapY = pointer.worldY - this.mapContainer.y;
        const hex = this.pixelToHex(mapX, mapY);

        if (hex.col < 0 || hex.col >= state.mapWidth || hex.row < 0 || hex.row >= state.mapHeight) {
            this.clearPathPreview();
            return;
        }
        if (hex.col === hero.posX && hex.row === hero.posY) {
            // Check if hero is standing on own town
            const town = state.towns.find(t => t.posX === hex.col && t.posY === hex.row);
            if (town && town.ownerId === gameStore.getCurrentPlayer()?.id) {
                this.scene.start('TownScene', { town, gameId: state.id });
                return;
            }
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

            if (result.levelUp) {
                const levelDialog = new LevelUpDialog(this, result.levelUp);
                levelDialog.show();
                await levelDialog.waitForDismissal();
            }

            this.refreshDisplay();

            const currentState = gameStore.getState();
            if (currentState?.status === 'won' || currentState?.status === 'lost') {
                this.showGameEnd();
                return;
            }

            if (result.combat?.occurred && !result.combat.result.attackerWon) {
                const updatedState = gameStore.getState();
                if (updatedState?.status === 'won' || updatedState?.status === 'lost') {
                    this.showGameEnd();
                    return;
                }
                // Player eliminated but game continues — server already advanced the turn
                const selectedHero = gameStore.getSelectedHero();
                if (!selectedHero) {
                    this.refreshDisplay();
                    const nextPlayer = gameStore.getCurrentPlayer();
                    if (nextPlayer) {
                        this.showTurnTransition(nextPlayer.name, nextPlayer.color);
                    }
                    return;
                }
            }
        } catch (error: any) {
            console.warn('Move failed:', error.message);
            const currentState = gameStore.getState();
            if (currentState?.status === 'won' || currentState?.status === 'lost') {
                this.showGameEnd();
                return;
            }
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

        const oldPlayerIndex = state.currentPlayerIndex;

        try {
            const newState = await apiClient.endTurn(state.id);
            gameStore.updateFromGameState(newState);
            this.refreshDisplay();

            if (newState.status === 'won' || newState.status === 'lost') {
                this.showGameEnd();
                return;
            }

            // Show turn transition overlay if player changed
            if (newState.currentPlayerIndex !== oldPlayerIndex) {
                const nextPlayer = newState.players[newState.currentPlayerIndex];
                if (nextPlayer) {
                    this.showTurnTransition(nextPlayer.name, nextPlayer.color);
                }
            }
        } catch (error) {
            console.error('End turn failed:', error);
        }
    }

    private showTurnTransition(playerName: string, playerColor: string): void {
        this.isMoving = true;
        const { width, height } = this.cameras.main;

        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
            .setDepth(300).setScrollFactor(0);
        this.cameras.main.ignore(overlay);

        const text = this.add.text(width / 2, height / 2, `${playerName}'s Turn`, {
            fontFamily: 'serif',
            fontSize: '42px',
            color: playerColor,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(301).setScrollFactor(0);
        this.cameras.main.ignore(text);

        this.time.delayedCall(1500, () => {
            overlay.destroy();
            text.destroy();
            this.isMoving = false;
        });
    }

    private refreshDisplay(): void {
        const state = gameStore.getState();
        if (!state) return;

        const player = gameStore.getCurrentPlayer()!;
        const hero = gameStore.getSelectedHero();

        // Update day text
        this.dayText.setText(this.getDayString(state));

        // Update player indicator
        if (player) {
            const playerColor = Phaser.Display.Color.HexStringToColor(player.color).color;
            this.playerIndicatorRect.setFillStyle(playerColor);
            this.playerIndicator.setText(player.name);
            this.playerIndicator.setColor(player.color);
        }

        // Update resources
        for (const key of Object.keys(this.resourceTexts)) {
            this.resourceTexts[key].setText(String(player.resources[key as keyof typeof player.resources]));
        }

        // Redraw towns and neutral stacks
        this.drawTowns(state);
        this.drawNeutralStacks(state);

        // Always redraw all heroes
        this.drawHero(state);

        if (hero) {
            // Update level & XP
            this.levelText.setText(`Lv.${hero.level} (${hero.experience} XP)`);
            // Update movement points
            this.movementText.setText(`MP: ${hero.movementPoints}/${hero.maxMovementPoints}`);
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
            this.levelText.setText('Lv.--');
            this.movementText.setText('MP: --');
            for (const txt of this.armyTexts) {
                txt.setVisible(false);
            }
        }
    }

    private animateHeroPath(path: number[][]): Promise<void> {
        return new Promise((resolve) => {
            // Remove old hero labels
            for (const label of this.heroLabels) {
                label.destroy();
            }
            this.heroLabels = [];

            const player = gameStore.getCurrentPlayer();
            const playerColor = player
                ? Phaser.Display.Color.HexStringToColor(player.color).color
                : 0xffcc00;

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
                    this.heroGraphics.fillStyle(playerColor, 1);
                    this.heroGraphics.lineStyle(2, 0xffffff, 1);
                    this.heroGraphics.fillCircle(x, y, HEX_SIZE * 0.6);
                    this.heroGraphics.strokeCircle(x, y, HEX_SIZE * 0.6);

                    step++;

                    if (step >= path.length) {
                        const letter = player ? player.name.charAt(0).toUpperCase() : 'H';
                        const label = this.add.text(x, y, letter, {
                            fontFamily: 'Arial',
                            fontSize: '14px',
                            color: '#000000',
                            fontStyle: 'bold',
                        }).setOrigin(0.5);
                        this.mapContainer.add(label);
                        this.heroLabels.push(label);
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

        const mapX = pointer.worldX - this.mapContainer.x;
        const mapY = pointer.worldY - this.mapContainer.y;
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

    private showGameEnd(): void {
        const state = gameStore.getState();
        if (!state) return;

        // Disable all input so the map is fully blocked
        this.input.removeAllListeners();
        this.isMoving = true;

        const { width, height } = this.cameras.main;
        const isVictory = state.status === 'won';
        const endUi: Phaser.GameObjects.GameObject[] = [];

        // Dark overlay — interactive to absorb stray clicks
        endUi.push(this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
            .setDepth(200)
            .setScrollFactor(0)
            .setInteractive());

        // Title
        endUi.push(this.add.text(width / 2, 60, isVictory ? 'Victory!' : 'Defeat', {
            fontFamily: 'serif',
            fontSize: '48px',
            color: isVictory ? '#c4a44e' : '#cc3333',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0));

        // Subtitle: game duration
        const duration = `Month ${state.currentMonth}, Week ${state.currentWeek}, Day ${state.currentDay}`;
        endUi.push(this.add.text(width / 2, 110, duration, {
            fontFamily: 'serif',
            fontSize: '18px',
            color: '#aaaaaa',
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0));

        // Sort players: alive first (by hero count desc), then eliminated
        const sorted = [...state.players].sort((a, b) => {
            const aAlive = a.heroes.length > 0 ? 1 : 0;
            const bAlive = b.heroes.length > 0 ? 1 : 0;
            if (aAlive !== bAlive) return bAlive - aAlive;
            return b.heroes.length - a.heroes.length;
        });

        // Player list
        const startY = 160;
        const rowHeight = 36;

        // Header
        endUi.push(this.add.text(width / 2, startY - 10, 'Player Results', {
            fontFamily: 'serif',
            fontSize: '20px',
            color: '#c4a44e',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0));

        for (let i = 0; i < sorted.length; i++) {
            const p = sorted[i];
            const y = startY + 30 + i * rowHeight;
            const alive = p.heroes.length > 0;
            const playerColor = Phaser.Display.Color.HexStringToColor(p.color).color;

            // Color swatch
            endUi.push(this.add.rectangle(width / 2 - 180, y, 12, 12, playerColor)
                .setDepth(201).setScrollFactor(0));

            // Player name
            endUi.push(this.add.text(width / 2 - 165, y, p.name, {
                fontFamily: 'Arial',
                fontSize: '15px',
                color: p.color,
                fontStyle: 'bold',
            }).setOrigin(0, 0.5).setDepth(201).setScrollFactor(0));

            // Faction
            endUi.push(this.add.text(width / 2 - 60, y, this.capitalize(p.faction), {
                fontFamily: 'Arial',
                fontSize: '13px',
                color: '#aaaaaa',
            }).setOrigin(0, 0.5).setDepth(201).setScrollFactor(0));

            // Status badge
            let statusText: string;
            let statusColor: string;
            if (isVictory && alive) {
                statusText = 'Winner';
                statusColor = '#c4a44e';
            } else if (alive) {
                statusText = 'Alive';
                statusColor = '#88cc88';
            } else {
                statusText = 'Eliminated';
                statusColor = '#cc3333';
            }

            endUi.push(this.add.text(width / 2 + 40, y, statusText, {
                fontFamily: 'Arial',
                fontSize: '13px',
                color: statusColor,
                fontStyle: 'bold',
            }).setOrigin(0, 0.5).setDepth(201).setScrollFactor(0));

            // Stats: total units across all heroes
            const totalUnits = p.heroes.reduce((sum, h) =>
                sum + h.army.reduce((s, slot) => s + slot.quantity, 0), 0);
            const statsText = alive
                ? `${p.resources.gold}g | ${p.heroes.length} hero(es) | ${totalUnits} units`
                : '--';
            endUi.push(this.add.text(width / 2 + 130, y, statsText, {
                fontFamily: 'Arial',
                fontSize: '13px',
                color: alive ? '#ffffff' : '#666666',
            }).setOrigin(0, 0.5).setDepth(201).setScrollFactor(0));
        }

        // Main Menu button
        const btnY = startY + 30 + sorted.length * rowHeight + 30;
        const btnBg = this.add.rectangle(width / 2, btnY, 160, 44, 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true })
            .setDepth(201)
            .setScrollFactor(0);
        endUi.push(btnBg);

        endUi.push(this.add.text(width / 2, btnY, 'Main Menu', {
            fontFamily: 'serif',
            fontSize: '20px',
            color: '#c4a44e',
        }).setOrigin(0.5).setDepth(201).setScrollFactor(0));

        btnBg.on('pointerover', () => btnBg.setFillStyle(0x3a3a5a));
        btnBg.on('pointerout', () => btnBg.setFillStyle(0x2a2a4a));
        btnBg.on('pointerdown', () => this.scene.start('MainMenuScene'));

        // Ignore all game-end UI on main camera so zoom doesn't affect them
        for (const obj of endUi) {
            this.cameras.main.ignore(obj);
        }
    }

    private capitalize(s: string): string {
        return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
}
