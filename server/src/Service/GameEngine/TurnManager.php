<?php

namespace App\Service\GameEngine;

use App\Entity\Game;
use App\Entity\Player;
use App\Service\GameDataProvider;
use Doctrine\ORM\EntityManagerInterface;

class TurnManager
{
    public function __construct(
        private EntityManagerInterface $em,
        private GameDataProvider $gameDataProvider,
    ) {
    }

    public function endTurn(Game $game): void
    {
        $players = $game->getPlayers()->toArray();
        $playerCount = count($players);
        $currentIndex = $game->getCurrentPlayerIndex();
        $nextIndex = ($currentIndex + 1) % $playerCount;

        // Skip eliminated players (no heroes)
        $checked = 0;
        while ($checked < $playerCount) {
            if (!$players[$nextIndex]->getHeroes()->isEmpty()) {
                break;
            }
            $nextIndex = ($nextIndex + 1) % $playerCount;
            $checked++;
        }

        // If all players are eliminated, game is lost
        if ($checked >= $playerCount) {
            $game->setStatus('lost');
            $this->em->flush();
            return;
        }

        // Check win: one player left and no neutrals
        $activePlayers = 0;
        foreach ($players as $p) {
            if (!$p->getHeroes()->isEmpty()) {
                $activePlayers++;
            }
        }
        if ($activePlayers <= 1 && $game->getNeutralStacks()->isEmpty()) {
            $game->setStatus('won');
            $this->em->flush();
            return;
        }

        $game->setCurrentPlayerIndex($nextIndex);

        // If we've wrapped past index 0, advance the day
        if ($nextIndex <= $currentIndex) {
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
        $faction = $this->gameDataProvider->getFaction($player->getFaction());
        $buildingDefs = [];
        if ($faction) {
            foreach ($faction['buildings'] as $b) {
                $buildingDefs[$b['id']] = $b;
            }
        }

        foreach ($player->getTowns() as $town) {
            $town->setBuiltToday(false);

            foreach ($town->getBuildings() as $buildingId) {
                $def = $buildingDefs[$buildingId] ?? null;
                if ($def && isset($def['income'])) {
                    foreach ($def['income'] as $resource => $amount) {
                        $resources[$resource] = ($resources[$resource] ?? 0) + $amount;
                    }
                }
            }
        }

        $player->setResources($resources);
    }
}
