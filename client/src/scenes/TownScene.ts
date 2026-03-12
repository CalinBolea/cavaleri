import Phaser from 'phaser';
import { gameStore, TownData, Resources } from '../state/GameStore';
import { apiClient } from '../network/ApiClient';
import { IS_MOBILE, s, fs } from '../utils/uiScale';

interface BuildingDef {
    id: string;
    name: string;
    cost: Record<string, number>;
    prerequisites: string[];
    income?: Record<string, number>;
    produces?: string;
}

interface UnitDef {
    id: string;
    name: string;
}

export class TownScene extends Phaser.Scene {
    private town!: TownData;
    private gameId!: string;
    private buildingDefs: BuildingDef[] = [];
    private unitDefs: Record<string, UnitDef> = {};
    private buildingCards: Phaser.GameObjects.Container[] = [];
    private resourceTexts: Record<string, Phaser.GameObjects.Text> = {};
    private scrollContainer!: Phaser.GameObjects.Container;
    private scrollY = 0;
    private maxScrollY = 0;

    constructor() {
        super({ key: 'TownScene' });
    }

    init(data: { town: TownData; gameId: string }): void {
        this.town = data.town;
        this.gameId = data.gameId;
    }

    create(): void {
        const { width, height } = this.cameras.main;

        // Load faction data
        const factionsData = this.cache.json.get('factions');
        const faction = factionsData.factions.find((f: any) => f.id === this.town.factionId);
        this.buildingDefs = faction?.buildings ?? [];

        // Load unit data
        const unitsData = this.cache.json.get(`${this.town.factionId}-units`);
        if (unitsData?.units) {
            for (const u of unitsData.units) {
                this.unitDefs[u.id] = u;
            }
        }

        // Background
        this.cameras.main.setBackgroundColor(0x1a1a2e);

        this.createTopBar(width);
        this.createBuildingGrid(width, height);
        this.createBottomBar(width, height);
    }

    private createTopBar(width: number): void {
        const barHeight = s(60);
        const bar = this.add.graphics();
        bar.fillStyle(0x0d0d1a, 0.95);
        bar.fillRect(0, 0, width, barHeight);
        bar.lineStyle(2, 0xc4a44e, 1);
        bar.lineBetween(0, barHeight, width, barHeight);

        // Faction name
        const factionNames: Record<string, string> = {
            castle: 'Castle', necropolis: 'Necropolis', rampart: 'Rampart', tower: 'Tower',
            inferno: 'Inferno', dungeon: 'Dungeon', stronghold: 'Stronghold', fortress: 'Fortress',
        };
        this.add.text(s(16), barHeight / 2, factionNames[this.town.factionId] || this.town.factionId, {
            fontFamily: 'Georgia, serif',
            fontSize: fs(20),
            color: '#c4a44e',
        }).setOrigin(0, 0.5);

        // Resources
        const player = gameStore.getCurrentPlayer();
        if (player) {
            const resources = player.resources;
            const resKeys: (keyof Resources)[] = ['gold', 'wood', 'ore'];
            const resColors: Record<string, string> = { gold: '#ffd700', wood: '#8b4513', ore: '#808080' };
            let rx = width / 2 - s(100);
            for (const key of resKeys) {
                const label = this.add.text(rx, barHeight / 2, `${key}: `, {
                    fontFamily: 'Arial',
                    fontSize: fs(13),
                    color: resColors[key] || '#ffffff',
                }).setOrigin(0, 0.5);
                rx += label.width;
                this.resourceTexts[key] = this.add.text(rx, barHeight / 2, `${resources[key]}`, {
                    fontFamily: 'Arial',
                    fontSize: fs(13),
                    color: '#ffffff',
                }).setOrigin(0, 0.5);
                rx += this.resourceTexts[key].width + s(16);
            }
        }

        // Back button
        const btnW = s(100);
        const btnH = s(32);
        const btnX = width - btnW - s(12);
        const btnY = (barHeight - btnH) / 2;
        const backBtn = this.add.graphics();
        backBtn.fillStyle(0x333355, 1);
        backBtn.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
        backBtn.lineStyle(1, 0xc4a44e, 1);
        backBtn.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);

        const backText = this.add.text(btnX + btnW / 2, btnY + btnH / 2, 'Back to Map', {
            fontFamily: 'Arial',
            fontSize: fs(12),
            color: '#ffffff',
        }).setOrigin(0.5);

        const backZone = this.add.zone(btnX, btnY, btnW, btnH).setOrigin(0).setInteractive({ useHandCursor: true });
        backZone.on('pointerdown', () => this.goBack());
    }

    private createBuildingGrid(width: number, height: number): void {
        const topOffset = s(70);
        const bottomOffset = s(60);
        const viewHeight = height - topOffset - bottomOffset;

        // Scrollable container
        this.scrollContainer = this.add.container(0, topOffset);

        // Create mask for scrolling area
        const maskShape = this.make.graphics({});
        maskShape.fillRect(0, topOffset, width, viewHeight);
        const mask = maskShape.createGeometryMask();
        this.scrollContainer.setMask(mask);

        const cols = IS_MOBILE ? 2 : 3;
        const padding = s(12);
        const cardW = (width - padding * (cols + 1)) / cols;
        const cardH = s(130);

        let totalHeight = padding;

        this.buildingDefs.forEach((def, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = padding + col * (cardW + padding);
            const y = padding + row * (cardH + padding);

            const card = this.createBuildingCard(x, y, cardW, cardH, def);
            this.scrollContainer.add(card);
            this.buildingCards.push(card);

            totalHeight = y + cardH + padding;
        });

        this.maxScrollY = Math.max(0, totalHeight - viewHeight);

        // Scroll input
        this.input.on('wheel', (_pointer: any, _gos: any, _dx: number, dy: number) => {
            this.scrollY = Phaser.Math.Clamp(this.scrollY + dy * 0.5, 0, this.maxScrollY);
            this.scrollContainer.y = topOffset - this.scrollY;
        });

        // Touch drag scrolling
        let dragStartY = 0;
        let dragScrollStart = 0;
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.y > s(60) && pointer.y < height - s(60)) {
                dragStartY = pointer.y;
                dragScrollStart = this.scrollY;
            }
        });
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (pointer.isDown && dragStartY > 0) {
                const dy = dragStartY - pointer.y;
                this.scrollY = Phaser.Math.Clamp(dragScrollStart + dy, 0, this.maxScrollY);
                this.scrollContainer.y = s(70) - this.scrollY;
            }
        });
    }

    private createBuildingCard(x: number, y: number, w: number, h: number, def: BuildingDef): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        const isBuilt = this.town.buildings.includes(def.id);
        const player = gameStore.getCurrentPlayer();
        const resources = player?.resources;

        // Check prerequisites
        const prereqsMet = def.prerequisites.every(p => this.town.buildings.includes(p));
        // Check affordability
        let canAfford = true;
        if (resources) {
            for (const [res, amount] of Object.entries(def.cost)) {
                if ((resources[res as keyof Resources] ?? 0) < amount) {
                    canAfford = false;
                    break;
                }
            }
        }
        const canBuild = !isBuilt && prereqsMet && canAfford && !this.town.builtToday;

        // Card background
        const bg = this.add.graphics();
        if (isBuilt) {
            bg.fillStyle(0x1a3a1a, 1);
            bg.lineStyle(2, 0x44aa44, 1);
        } else if (canBuild) {
            bg.fillStyle(0x1a1a3a, 1);
            bg.lineStyle(2, 0xc4a44e, 1);
        } else {
            bg.fillStyle(0x1a1a1a, 0.7);
            bg.lineStyle(1, 0x555555, 1);
        }
        bg.fillRoundedRect(0, 0, w, h, 8);
        bg.strokeRoundedRect(0, 0, w, h, 8);
        container.add(bg);

        // Building name
        const nameColor = isBuilt ? '#44aa44' : canBuild ? '#c4a44e' : '#888888';
        const nameText = this.add.text(s(10), s(10), def.name, {
            fontFamily: 'Georgia, serif',
            fontSize: fs(14),
            color: nameColor,
            wordWrap: { width: w - s(20) },
        });
        container.add(nameText);

        // Status
        const statusY = s(30);
        if (isBuilt) {
            const statusText = this.add.text(s(10), statusY, 'BUILT', {
                fontFamily: 'Arial',
                fontSize: fs(11),
                color: '#44aa44',
            });
            container.add(statusText);
        } else {
            // Cost
            const costParts: string[] = [];
            for (const [res, amount] of Object.entries(def.cost)) {
                if (amount > 0) costParts.push(`${amount} ${res}`);
            }
            const costText = this.add.text(s(10), statusY, `Cost: ${costParts.join(', ')}`, {
                fontFamily: 'Arial',
                fontSize: fs(10),
                color: canAfford ? '#cccccc' : '#cc4444',
                wordWrap: { width: w - s(20) },
            });
            container.add(costText);
        }

        // Info (produces / income)
        const infoY = s(48);
        if (def.produces) {
            const unitName = this.unitDefs[def.produces]?.name || def.produces;
            const infoText = this.add.text(s(10), infoY, `Produces: ${unitName}`, {
                fontFamily: 'Arial',
                fontSize: fs(10),
                color: '#aaaacc',
            });
            container.add(infoText);
        }
        if (def.income) {
            const incomeParts: string[] = [];
            for (const [res, amount] of Object.entries(def.income)) {
                incomeParts.push(`+${amount} ${res}`);
            }
            const incomeText = this.add.text(s(10), def.produces ? infoY + s(16) : infoY, `Income: ${incomeParts.join(', ')}`, {
                fontFamily: 'Arial',
                fontSize: fs(10),
                color: '#aaccaa',
            });
            container.add(incomeText);
        }

        // Prerequisites (if not met)
        if (!isBuilt && !prereqsMet) {
            const missingPrereqs = def.prerequisites.filter(p => !this.town.buildings.includes(p));
            const prereqNames = missingPrereqs.map(p => {
                const pDef = this.buildingDefs.find(b => b.id === p);
                return pDef?.name || p;
            });
            const prereqText = this.add.text(s(10), h - s(38), `Requires: ${prereqNames.join(', ')}`, {
                fontFamily: 'Arial',
                fontSize: fs(9),
                color: '#cc8844',
                wordWrap: { width: w - s(20) },
            });
            container.add(prereqText);
        }

        // Build button
        if (canBuild) {
            const btnW = s(70);
            const btnH = s(26);
            const btnX = w - btnW - s(10);
            const btnY = h - btnH - s(10);

            const btnBg = this.add.graphics();
            btnBg.fillStyle(0x336633, 1);
            btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 4);
            btnBg.lineStyle(1, 0xc4a44e, 1);
            btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 4);
            container.add(btnBg);

            const btnText = this.add.text(btnX + btnW / 2, btnY + btnH / 2, 'Build', {
                fontFamily: 'Arial',
                fontSize: fs(12),
                color: '#ffffff',
            }).setOrigin(0.5);
            container.add(btnText);

            const btnZone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH).setInteractive({ useHandCursor: true });
            container.add(btnZone);
            btnZone.on('pointerdown', () => this.buildBuilding(def.id));
        } else if (this.town.builtToday && !isBuilt && prereqsMet && canAfford) {
            const waitText = this.add.text(w - s(10), h - s(16), 'Wait until tomorrow', {
                fontFamily: 'Arial',
                fontSize: fs(9),
                color: '#cc8844',
            }).setOrigin(1, 0.5);
            container.add(waitText);
        }

        return container;
    }

    private async buildBuilding(buildingId: string): Promise<void> {
        try {
            const result = await apiClient.buildInTown(this.gameId, this.town.id, buildingId);
            // Update local state
            this.town = result.town;
            const state = gameStore.getState();
            if (state) {
                const player = gameStore.getCurrentPlayer();
                if (player) {
                    player.resources = result.resources;
                }
                const townIndex = state.towns.findIndex(t => t.id === this.town.id);
                if (townIndex >= 0) {
                    state.towns[townIndex] = result.town;
                }
            }
            // Re-render
            this.scene.restart({ town: this.town, gameId: this.gameId });
        } catch (err: any) {
            // Show error briefly
            const { width, height } = this.cameras.main;
            const errText = this.add.text(width / 2, height / 2, err.message, {
                fontFamily: 'Arial',
                fontSize: fs(16),
                color: '#ff4444',
                backgroundColor: '#000000',
                padding: { x: 12, y: 8 },
            }).setOrigin(0.5).setDepth(100);
            this.time.delayedCall(2000, () => errText.destroy());
        }
    }

    private createBottomBar(width: number, height: number): void {
        const barHeight = s(50);
        const barY = height - barHeight;

        const bar = this.add.graphics();
        bar.fillStyle(0x0d0d1a, 0.95);
        bar.fillRect(0, barY, width, barHeight);
        bar.lineStyle(2, 0xc4a44e, 1);
        bar.lineBetween(0, barY, width, barY);

        // Town income summary
        let totalIncome: Record<string, number> = {};
        for (const bId of this.town.buildings) {
            const def = this.buildingDefs.find(b => b.id === bId);
            if (def?.income) {
                for (const [res, amount] of Object.entries(def.income)) {
                    totalIncome[res] = (totalIncome[res] || 0) + amount;
                }
            }
        }

        const incomeParts: string[] = [];
        for (const [res, amount] of Object.entries(totalIncome)) {
            incomeParts.push(`+${amount} ${res}`);
        }
        const incomeStr = incomeParts.length > 0 ? incomeParts.join('  ') : 'No income';

        this.add.text(s(16), barY + barHeight / 2, `Daily Income: ${incomeStr}`, {
            fontFamily: 'Arial',
            fontSize: fs(13),
            color: '#aaccaa',
        }).setOrigin(0, 0.5);

        const builtCount = this.town.buildings.length;
        const totalCount = this.buildingDefs.length;
        this.add.text(width - s(16), barY + barHeight / 2, `Buildings: ${builtCount}/${totalCount}`, {
            fontFamily: 'Arial',
            fontSize: fs(13),
            color: '#cccccc',
        }).setOrigin(1, 0.5);
    }

    private async goBack(): Promise<void> {
        // Refresh game state before returning
        try {
            const freshState = await apiClient.getGame(this.gameId);
            gameStore.updateFromGameState(freshState);
        } catch {
            // Continue even if refresh fails
        }
        this.scene.start('AdventureMapScene');
    }
}
