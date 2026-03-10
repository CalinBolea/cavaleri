import Phaser from 'phaser';
import { LevelUpData } from '../state/GameStore';

export class LevelUpDialog {
    private container: Phaser.GameObjects.Container;
    private resolvePromise: (() => void) | null = null;

    constructor(private scene: Phaser.Scene, private data: LevelUpData) {
        this.container = scene.add.container(0, 0).setDepth(200);
    }

    show(): void {
        const { width, height } = this.scene.cameras.main;

        // Semi-transparent overlay
        const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
        overlay.setInteractive();
        this.container.add(overlay);

        // Panel
        const panelW = 380;
        const panelH = 340;
        const cx = width / 2;
        const cy = height / 2;

        const panel = this.scene.add.rectangle(cx, cy, panelW, panelH, 0x1a1a2e)
            .setStrokeStyle(2, 0xc4a44e);
        this.container.add(panel);

        // Title
        const title = this.scene.add.text(cx, cy - 130, 'Level Up!', {
            fontFamily: 'serif',
            fontSize: '32px',
            color: '#c4a44e',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(title);

        // New level
        const levelText = this.scene.add.text(cx, cy - 85, `Level ${this.data.newLevel}`, {
            fontFamily: 'Arial',
            fontSize: '22px',
            color: '#ffffff',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(levelText);

        // Stat increases
        const stats: [string, number][] = [
            ['Attack', this.data.statGrowth.attack],
            ['Defense', this.data.statGrowth.defense],
            ['Spell Power', this.data.statGrowth.spellPower],
            ['Knowledge', this.data.statGrowth.knowledge],
        ];

        let yOff = cy - 45;
        for (const [name, value] of stats) {
            if (value <= 0) continue;
            const t = this.scene.add.text(cx, yOff, `+${value} ${name}`, {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: '#44cc44',
            }).setOrigin(0.5);
            this.container.add(t);
            yOff += 30;
        }

        // Movement bonus every 5 levels
        if (this.data.newLevel % 5 === 0) {
            const movText = this.scene.add.text(cx, yOff, '+2 Max Movement', {
                fontFamily: 'Arial',
                fontSize: '18px',
                color: '#aaccff',
            }).setOrigin(0.5);
            this.container.add(movText);
            yOff += 30;
        }

        // Continue button
        const btnBg = this.scene.add.rectangle(cx, cy + 130, 160, 40, 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true });
        this.container.add(btnBg);

        const btnText = this.scene.add.text(cx, cy + 130, 'Continue', {
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
}
