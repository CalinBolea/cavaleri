import Phaser from 'phaser';
import { HeroData } from '../state/GameStore';

export class HeroDetailsDialog {
    private container: Phaser.GameObjects.Container;
    private resolvePromise: (() => void) | null = null;

    constructor(private scene: Phaser.Scene, private hero: HeroData) {
        this.container = scene.add.container(0, 0).setDepth(200);
    }

    show(): void {
        const { width, height } = this.scene.cameras.main;

        // Semi-transparent overlay
        const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
        overlay.setInteractive();
        this.container.add(overlay);

        // Panel
        const panelW = 450;
        const panelH = 480;
        const cx = width / 2;
        const cy = height / 2;

        const panel = this.scene.add.rectangle(cx, cy, panelW, panelH, 0x1a1a2e)
            .setStrokeStyle(2, 0xc4a44e);
        this.container.add(panel);

        let y = cy - panelH / 2 + 30;

        // Title: Hero name + class
        const title = this.scene.add.text(cx, y, `${this.hero.name} — ${this.capitalize(this.hero.heroClass)}`, {
            fontFamily: 'serif',
            fontSize: '24px',
            color: '#c4a44e',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(title);

        // Level & XP
        y += 40;
        const xpForNext = 100 * (this.hero.level + 1) * (this.hero.level + 1);
        const levelText = this.scene.add.text(cx, y, `Level ${this.hero.level}    XP: ${this.hero.experience} / ${xpForNext}`, {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#aaccff',
        }).setOrigin(0.5);
        this.container.add(levelText);

        // Divider
        y += 30;
        const divider1 = this.scene.add.rectangle(cx, y, panelW - 40, 1, 0xc4a44e, 0.4);
        this.container.add(divider1);

        // Stats header
        y += 20;
        const statsHeader = this.scene.add.text(cx, y, 'Attributes', {
            fontFamily: 'serif',
            fontSize: '18px',
            color: '#c4a44e',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(statsHeader);

        // Stats 2-column grid
        const stats = [
            { label: 'Attack', value: this.hero.attack },
            { label: 'Defense', value: this.hero.defense },
            { label: 'Spell Power', value: this.hero.spellPower },
            { label: 'Knowledge', value: this.hero.knowledge },
        ];

        const colLeft = cx - 80;
        const colRight = cx + 80;
        y += 28;

        for (let i = 0; i < stats.length; i++) {
            const col = i % 2 === 0 ? colLeft : colRight;
            const rowY = y + Math.floor(i / 2) * 26;

            const statText = this.scene.add.text(col, rowY, `${stats[i].label}: ${stats[i].value}`, {
                fontFamily: 'Arial',
                fontSize: '15px',
                color: '#ffffff',
            }).setOrigin(0.5);
            this.container.add(statText);
        }

        // Movement
        y += Math.ceil(stats.length / 2) * 26 + 10;
        const moveText = this.scene.add.text(cx, y, `Movement: ${this.hero.movementPoints} / ${this.hero.maxMovementPoints}`, {
            fontFamily: 'Arial',
            fontSize: '15px',
            color: '#88cc88',
        }).setOrigin(0.5);
        this.container.add(moveText);

        // Divider
        y += 24;
        const divider2 = this.scene.add.rectangle(cx, y, panelW - 40, 1, 0xc4a44e, 0.4);
        this.container.add(divider2);

        // Army header
        y += 20;
        const armyHeader = this.scene.add.text(cx, y, 'Army', {
            fontFamily: 'serif',
            fontSize: '18px',
            color: '#c4a44e',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(armyHeader);

        // Army slots
        y += 28;
        for (const slot of this.hero.army) {
            const slotText = this.scene.add.text(cx, y, `${this.capitalize(slot.unitId)}  x${slot.quantity}`, {
                fontFamily: 'Arial',
                fontSize: '15px',
                color: '#ffffff',
            }).setOrigin(0.5);
            this.container.add(slotText);
            y += 24;
        }

        if (this.hero.army.length === 0) {
            const emptyText = this.scene.add.text(cx, y, 'No units', {
                fontFamily: 'Arial',
                fontSize: '14px',
                color: '#666666',
            }).setOrigin(0.5);
            this.container.add(emptyText);
            y += 24;
        }

        // Close button
        const btnY = cy + panelH / 2 - 40;
        const btnBg = this.scene.add.rectangle(cx, btnY, 140, 40, 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true });
        this.container.add(btnBg);

        const btnText = this.scene.add.text(cx, btnY, 'Close', {
            fontFamily: 'serif',
            fontSize: '18px',
            color: '#c4a44e',
        }).setOrigin(0.5);
        this.container.add(btnText);

        btnBg.on('pointerover', () => btnBg.setFillStyle(0x3a3a5a));
        btnBg.on('pointerout', () => btnBg.setFillStyle(0x2a2a4a));
        btnBg.on('pointerdown', () => {
            this.container.destroy();
            if (this.resolvePromise) {
                this.resolvePromise();
            }
        });

        // Ignore on main camera so zoom doesn't affect the dialog
        this.scene.cameras.main.ignore(this.container);
    }

    waitForDismissal(): Promise<void> {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
        });
    }

    private capitalize(s: string): string {
        return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
}
