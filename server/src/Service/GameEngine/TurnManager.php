<?php

namespace App\Service\GameEngine;

use App\Entity\Game;
use App\Entity\Player;
use Doctrine\ORM\EntityManagerInterface;

class TurnManager
{
    public function __construct(private EntityManagerInterface $em)
    {
    }

    public function endTurn(Game $game): void
    {
        $players = $game->getPlayers()->toArray();
        $currentIndex = $game->getCurrentPlayerIndex();
        $nextIndex = ($currentIndex + 1) % count($players);

        $game->setCurrentPlayerIndex($nextIndex);

        // If we've gone through all players, advance the day
        if ($nextIndex === 0) {
            $this->advanceDay($game);
        }

        $this->em->flush();
    }

    private function advanceDay(Game $game): void
    {
        $day = $game->getCurrentDay() + 1;

        if ($day > 7) {
            $day = 1;
            $week = $game->getCurrentWeek() + 1;

            if ($week > 4) {
                $week = 1;
                $game->setCurrentMonth($game->getCurrentMonth() + 1);
            }

            $game->setCurrentWeek($week);
        }

        $game->setCurrentDay($day);

        // Apply daily income to all players
        foreach ($game->getPlayers() as $player) {
            $this->applyIncome($player);
            // Reset hero movement points
            foreach ($player->getHeroes() as $hero) {
                $hero->setMovementPoints($hero->getMaxMovementPoints());
            }
        }
    }

    private function applyIncome(Player $player): void
    {
        $resources = $player->getResources();
        // Base income: 500 gold per day from village hall
        $resources['gold'] = ($resources['gold'] ?? 0) + 500;
        $player->setResources($resources);
    }
}
