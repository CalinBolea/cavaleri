<?php

namespace App\Tests\Service\GameEngine;

use App\Entity\Game;
use App\Entity\Hero;
use App\Entity\Player;
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
        $this->turnManager = new TurnManager($this->em);
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

        return $game;
    }
}
