import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { AdventureMapScene } from './scenes/AdventureMapScene';
import { TownScene } from './scenes/TownScene';

const BASE_HEIGHT = 720;
const BASE_WIDTH = 1280;
const MAX_WIDTH = 1920;

const screenRatio = window.innerWidth / window.innerHeight;
const gameWidth = Math.min(
    Math.max(Math.round(BASE_HEIGHT * screenRatio), BASE_WIDTH),
    MAX_WIDTH
);

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: gameWidth,
    height: BASE_HEIGHT,
    backgroundColor: '#1a1a2e',
    parent: document.body,
    scene: [BootScene, PreloadScene, MainMenuScene, AdventureMapScene, TownScene],
    input: {
        activePointers: 2,
        mouse: {
            preventDefaultWheel: false,
        },
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
};

new Phaser.Game(config);
