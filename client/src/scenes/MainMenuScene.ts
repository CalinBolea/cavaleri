import Phaser from 'phaser';
import { apiClient } from '../network/ApiClient';
import { gameStore } from '../state/GameStore';

export class MainMenuScene extends Phaser.Scene {
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

        // New Game button
        const buttonBg = this.add.rectangle(width / 2, height / 2 + 60, 240, 56, 0x2a2a4a)
            .setStrokeStyle(2, 0xc4a44e)
            .setInteractive({ useHandCursor: true });

        const buttonText = this.add.text(width / 2, height / 2 + 60, 'New Game', {
            fontFamily: 'serif',
            fontSize: '28px',
            color: '#c4a44e',
        }).setOrigin(0.5);

        buttonBg.on('pointerover', () => {
            buttonBg.setFillStyle(0x3a3a5a);
        });

        buttonBg.on('pointerout', () => {
            buttonBg.setFillStyle(0x2a2a4a);
        });

        buttonBg.on('pointerdown', async () => {
            buttonText.setText('Creating...');
            buttonBg.disableInteractive();

            try {
                const gameState = await apiClient.createGame('Player 1', 'castle');
                gameStore.setState(gameState);
                this.scene.start('AdventureMapScene');
            } catch (error) {
                console.error('Failed to create game:', error);
                buttonText.setText('Error! Retry');
                buttonBg.setInteractive({ useHandCursor: true });
            }
        });
    }
}
