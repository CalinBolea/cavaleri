<?php

namespace App\Tests\Service\GameEngine;

use App\Entity\Game;
use App\Entity\Hero;
use App\Entity\NeutralStack;
use App\Entity\Player;
use App\Entity\Town;
use App\Service\GameDataProvider;
use App\Service\GameEngine\TurnManager;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;

class TurnManagerTest extends TestCase
{
    private TurnManager $turnManager;
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->em->method('flush');

        $gameDataProvider = $this->createMock(GameDataProvider::class);
        $gameDataProvider->method('getFaction')->willReturn([
            'id' => 'castle',
            'buildings' => [
                ['id' => 'village_hall', 'name' => 'Village Hall', 'cost' => ['gold' => 0], 'prerequisites' => [], 'income' => ['gold' => 500]],
            ],
        ]);

        $this->turnManager = new TurnManager($this->em, $gameDataProvider);
    }

    public function testEndTurnAdvancesDay(): void
    {
        $game = $this->createGame();
        $this->assertEquals(1, $game->getCurrentDay());

        $this->turnManager->endTurn($game);

        $this->assertEquals(2, $game->getCurrentDay());
    }

    public function testEndTurnResetsMovementPoints(): void
    {
        $game = $this->createGame();
        $hero = $game->getPlayers()->first()->getHeroes()->first();
        $hero->setMovementPoints(5);

        $this->turnManager->endTurn($game);

        $this->assertEquals(20, $hero->getMovementPoints());
    }

    public function testEndTurnAppliesIncome(): void
    {
        $game = $this->createGame();
        $player = $game->getPlayers()->first();
        $initialGold = $player->getResources()['gold'];

        $this->turnManager->endTurn($game);

        $this->assertEquals($initialGold + 500, $player->getResources()['gold']);
    }

    public function testWeekAdvancesAfterSevenDays(): void
    {
        $game = $this->createGame();
        $game->setCurrentDay(7);

        $this->turnManager->endTurn($game);

        $this->assertEquals(1, $game->getCurrentDay());
        $this->assertEquals(2, $game->getCurrentWeek());
    }

    public function testMonthAdvancesAfterFourWeeks(): void
    {
        $game = $this->createGame();
        $game->setCurrentDay(7);
        $game->setCurrentWeek(4);

        $this->turnManager->endTurn($game);

        $this->assertEquals(1, $game->getCurrentDay());
        $this->assertEquals(1, $game->getCurrentWeek());
        $this->assertEquals(2, $game->getCurrentMonth());
    }

    public function testLastPlayerStandingWithNoNeutralsWins(): void
    {
        $game = $this->createTwoPlayerGame();

        // Remove P2's hero
        $player2 = $game->getPlayers()->toArray()[1];
        $hero2 = $player2->getHeroes()->first();
        $player2->removeHero($hero2);

        $this->turnManager->endTurn($game);

        $this->assertEquals('won', $game->getStatus());
    }

    public function testLastPlayerStandingWithNeutralsDoesNotWin(): void
    {
        $game = $this->createTwoPlayerGame();

        // Add a neutral stack
        $neutral = new NeutralStack();
        $neutral->setPosX(5);
        $neutral->setPosY(5);
        $neutral->setFactionId('neutral');
        $neutral->setUnitId('skeleton');
        $neutral->setQuantity(10);
        $game->addNeutralStack($neutral);

        // Remove P2's hero
        $player2 = $game->getPlayers()->toArray()[1];
        $hero2 = $player2->getHeroes()->first();
        $player2->removeHero($hero2);

        $this->turnManager->endTurn($game);

        $this->assertEquals('in_progress', $game->getStatus());
    }

    public function testAllPlayersEliminatedLoses(): void
    {
        $game = $this->createTwoPlayerGame();

        // Remove all heroes
        foreach ($game->getPlayers() as $player) {
            foreach ($player->getHeroes()->toArray() as $hero) {
                $player->removeHero($hero);
            }
        }

        $this->turnManager->endTurn($game);

        $this->assertEquals('lost', $game->getStatus());
    }

    private function createTwoPlayerGame(): Game
    {
        $game = new Game();
        $game->setMapWidth(20);
        $game->setMapHeight(20);
        $game->setMapData([]);
        $game->setStatus('in_progress');

        for ($i = 0; $i < 2; $i++) {
            $player = new Player();
            $player->setName("Player $i");
            $player->setFaction('castle');
            $player->setResources(['gold' => 2500, 'wood' => 10, 'ore' => 10, 'mercury' => 0, 'sulfur' => 0, 'crystal' => 0, 'gems' => 0]);

            $hero = new Hero();
            $hero->setName("Hero $i");
            $hero->setPosX($i * 5);
            $hero->setPosY($i * 5);
            $hero->setMovementPoints(20);
            $hero->setMaxMovementPoints(20);
            $player->addHero($hero);

            $game->addPlayer($player);
        }

        return $game;
    }

    private function createGame(): Game
    {
        $game = new Game();
        $game->setMapWidth(20);
        $game->setMapHeight(20);
        $game->setMapData([]);
        $game->setStatus('in_progress');

        $player = new Player();
        $player->setName('Test Player');
        $player->setFaction('castle');
        $player->setResources(['gold' => 2500, 'wood' => 10, 'ore' => 10, 'mercury' => 0, 'sulfur' => 0, 'crystal' => 0, 'gems' => 0]);

        $hero = new Hero();
        $hero->setName('Test Hero');
        $hero->setPosX(3);
        $hero->setPosY(3);
        $hero->setMovementPoints(20);
        $hero->setMaxMovementPoints(20);
        $player->addHero($hero);

        $game->addPlayer($player);

        // Add a town with village_hall for income
        $town = new Town();
        $town->setPosX(3);
        $town->setPosY(3);
        $town->setFactionId('castle');
        $town->setBuildings(['village_hall']);
        $player->addTown($town);
        $game->addTown($town);

        // Add a neutral stack so the win condition doesn't trigger
        $neutral = new NeutralStack();
        $neutral->setPosX(10);
        $neutral->setPosY(10);
        $neutral->setFactionId('neutral');
        $neutral->setUnitId('skeleton');
        $neutral->setQuantity(5);
        $game->addNeutralStack($neutral);

        return $game;
    }
}
