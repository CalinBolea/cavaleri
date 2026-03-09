import Phaser from 'phaser';
import { CombatResultData } from '../state/GameStore';

export class CombatResultDialog {
    private container: Phaser.GameObjects.Container;
    private resolvePromise: (() => void) | null = null;

    constructor(private scene: Phaser.Scene, private result: CombatResultData) {
        this.container = scene.add.container(0, 0).setDepth(200);
    }

    show(): void {
        const { width, height } = this.scene.cameras.main;

        // Semi-transparent overlay
        const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
        overlay.setInteractive();
        this.container.add(overlay);

        // Panel
        const panelW = 500;
        const panelH = 400;
        const cx = width / 2;
        const cy = height / 2;

        const panel = this.scene.add.rectangle(cx, cy, panelW, panelH, 0x1a1a2e)
            .setStrokeStyle(2, 0xc4a44e);
        this.container.add(panel);

        // Title
        const won = this.result.attackerWon;
        const title = this.scene.add.text(cx, cy - 160, won ? 'Victory!' : 'Defeat!', {
            fontFamily: 'serif',
            fontSize: '32px',
            color: won ? '#44cc44' : '#cc4444',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(title);

        // Column headers
        const leftCol = cx - 110;
        const rightCol = cx + 110;

        const yourHeader = this.scene.add.text(leftCol, cy - 110, 'Your Losses', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#c4a44e',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(yourHeader);

        const enemyHeader = this.scene.add.text(rightCol, cy - 110, 'Enemy Losses', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#c4a44e',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(enemyHeader);

        // Your losses
        let yOff = cy - 80;
        for (const loss of this.result.attackerLosses) {
            const text = `${loss.unitId}: -${loss.lost} (${loss.remaining} left)`;
            const t = this.scene.add.text(leftCol, yOff, text, {
                fontFamily: 'Arial',
                fontSize: '14px',
                color: loss.lost > 0 ? '#ff8888' : '#88ff88',
            }).setOrigin(0.5);
            this.container.add(t);
            yOff += 24;
        }

        // Enemy losses
        yOff = cy - 80;
        for (const loss of this.result.defenderLosses) {
            const text = `${loss.unitId}: -${loss.lost} (${loss.remaining} left)`;
            const t = this.scene.add.text(rightCol, yOff, text, {
                fontFamily: 'Arial',
                fontSize: '14px',
                color: loss.lost > 0 ? '#ff8888' : '#88ff88',
            }).setOrigin(0.5);
            this.container.add(t);
            yOff += 24;
        }

        // XP
        if (this.result.experienceGained > 0) {
            const xpText = this.scene.add.text(cx, cy + 100, `Experience gained: ${this.result.experienceGained}`, {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#aaccff',
            }).setOrigin(0.5);
            this.container.add(xpText);
        }

        // Continue button
        const btnBg = this.scene.add.rectangle(cx, cy + 150, 160, 40, 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true });
        this.container.add(btnBg);

        const btnText = this.scene.add.text(cx, cy + 150, 'Continue', {
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
