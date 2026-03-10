<?php

namespace App\Controller\Api;

use App\Entity\Game;
use App\Repository\GameRepository;
use App\Repository\HeroRepository;
use App\Repository\NeutralStackRepository;
use App\Repository\TownRepository;
use App\Service\GameEngine\CombatService;
use App\Service\GameEngine\TurnManager;
use App\Service\Map\PathfindingService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api')]
class HeroController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private GameRepository $gameRepository,
        private HeroRepository $heroRepository,
        private PathfindingService $pathfindingService,
        private NeutralStackRepository $neutralStackRepository,
        private TownRepository $townRepository,
        private CombatService $combatService,
        private TurnManager $turnManager,
    ) {
    }

    #[Route('/games/{gameId}/heroes/{heroId}/move', name: 'api_heroes_move', methods: ['POST'])]
    public function move(string $gameId, string $heroId, Request $request): JsonResponse
    {
        $game = $this->gameRepository->find($gameId);
        if (!$game) {
            return new JsonResponse(['error' => 'Game not found'], Response::HTTP_NOT_FOUND);
        }

        if ($game->getStatus() !== 'in_progress') {
            return new JsonResponse(['error' => 'Game is over'], Response::HTTP_BAD_REQUEST);
        }

        $hero = $this->heroRepository->find($heroId);
        if (!$hero || !$hero->getPlayer()->getGame()->getId()->equals($game->getId())) {
            return new JsonResponse(['error' => 'Hero not found'], Response::HTTP_NOT_FOUND);
        }

        // Validate hero belongs to the current player
        $players = $game->getPlayers()->toArray();
        $currentPlayer = $players[$game->getCurrentPlayerIndex()] ?? null;
        if (!$currentPlayer || !$hero->getPlayer()->getId()->equals($currentPlayer->getId())) {
            return new JsonResponse(['error' => 'Not your turn'], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $targetX = $data['x'] ?? null;
        $targetY = $data['y'] ?? null;

        if ($targetX === null || $targetY === null) {
            return new JsonResponse(['error' => 'Target coordinates required'], Response::HTTP_BAD_REQUEST);
        }

        $targetX = (int) $targetX;
        $targetY = (int) $targetY;

        // Validate bounds
        if ($targetX < 0 || $targetX >= $game->getMapWidth() || $targetY < 0 || $targetY >= $game->getMapHeight()) {
            return new JsonResponse(['error' => 'Target out of bounds'], Response::HTTP_BAD_REQUEST);
        }

        // Find path
        $mapData = $game->getMapData();
        $path = $this->pathfindingService->findPath($mapData, $hero->getPosX(), $hero->getPosY(), $targetX, $targetY);

        if ($path === null) {
            return new JsonResponse(['error' => 'No valid path to target'], Response::HTTP_BAD_REQUEST);
        }

        // Calculate movement cost
        $cost = $this->pathfindingService->getPathCost($mapData, $path);

        if ($cost > $hero->getMovementPoints()) {
            return new JsonResponse(['error' => 'Not enough movement points', 'required' => $cost, 'available' => $hero->getMovementPoints()], Response::HTTP_BAD_REQUEST);
        }

        // Move hero
        $hero->setPosX($targetX);
        $hero->setPosY($targetY);
        $hero->setMovementPoints($hero->getMovementPoints() - $cost);

        // Check for town capture
        $town = $this->townRepository->findByPosition($game, $targetX, $targetY);
        $townCaptured = null;
        if ($town && ($town->getOwner() === null || !$town->getOwner()->getId()->equals($hero->getPlayer()->getId()))) {
            $town->setOwner($hero->getPlayer());
            $townCaptured = $town->toArray();
        }

        $combatData = null;
        $levelUpData = null;

        // Check for neutral stack encounter
        $neutralStack = $this->neutralStackRepository->findByPosition($game, $targetX, $targetY);
        if ($neutralStack) {
            $faction = $hero->getPlayer()->getFaction();
            $attackerStacks = [];
            foreach ($hero->getArmySlots() as $slot) {
                $attackerStacks[] = [
                    'factionId' => $faction,
                    'unitId' => $slot->getUnitId(),
                    'quantity' => $slot->getQuantity(),
                    'slotIndex' => $slot->getSlotIndex(),
                ];
            }

            $defenderStacks = [[
                'factionId' => $neutralStack->getFactionId(),
                'unitId' => $neutralStack->getUnitId(),
                'quantity' => $neutralStack->getQuantity(),
                'slotIndex' => 0,
            ]];

            $result = $this->combatService->resolveCombat($attackerStacks, $defenderStacks, $hero);

            if ($result->attackerWon) {
                // Remove defeated neutral stack
                $game->removeNeutralStack($neutralStack);
                $this->em->remove($neutralStack);

                // Check win condition
                $this->checkWinCondition($game);

                // Apply attacker losses
                foreach ($result->attackerLosses as $loss) {
                    foreach ($hero->getArmySlots() as $slot) {
                        if ($slot->getSlotIndex() === $loss['slotIndex']) {
                            if ($loss['remaining'] <= 0) {
                                $hero->removeArmySlot($slot);
                                $this->em->remove($slot);
                            } else {
                                $slot->setQuantity($loss['remaining']);
                            }
                            break;
                        }
                    }
                }

                // Add XP
                $levelUpResult = $hero->addExperience($result->experienceGained);
                if ($levelUpResult['levelsGained'] > 0) {
                    $growth = $hero->getHeroClass()->getStatGrowth();
                    $levelUpData = [
                        'levelsGained' => $levelUpResult['levelsGained'],
                        'newLevel' => $levelUpResult['newLevel'],
                        'statGrowth' => [
                            'attack' => $growth['attack'] * $levelUpResult['levelsGained'],
                            'defense' => $growth['defense'] * $levelUpResult['levelsGained'],
                            'spellPower' => $growth['spellPower'] * $levelUpResult['levelsGained'],
                            'knowledge' => $growth['knowledge'] * $levelUpResult['levelsGained'],
                        ],
                    ];
                }
            } else {
                // Attacker lost: reset hero to penultimate path step
                if (count($path) >= 2) {
                    $prevStep = $path[count($path) - 2];
                    $hero->setPosX($prevStep[0]);
                    $hero->setPosY($prevStep[1]);
                } else {
                    // Only 1 step: stay at start
                    $hero->setPosX($path[0][0]);
                    $hero->setPosY($path[0][1]);
                }

                // If army wiped out, remove hero
                $armyEmpty = true;
                foreach ($hero->getArmySlots() as $slot) {
                    // Check if this slot still has units after losses
                    foreach ($result->attackerLosses as $loss) {
                        if ($slot->getSlotIndex() === $loss['slotIndex']) {
                            if ($loss['remaining'] <= 0) {
                                $hero->removeArmySlot($slot);
                                $this->em->remove($slot);
                            } else {
                                $slot->setQuantity($loss['remaining']);
                                $armyEmpty = false;
                            }
                            break;
                        }
                    }
                }

                if ($armyEmpty) {
                    $player = $hero->getPlayer();
                    $player->removeHero($hero);
                    $this->em->remove($hero);

                    // Auto-advance turn if this player has no heroes left
                    if ($player->getHeroes()->isEmpty()) {
                        $this->turnManager->endTurn($game);
                    }
                }
            }

            $combatData = [
                'occurred' => true,
                'type' => 'neutral',
                'result' => $result->toArray(),
            ];
        }

        // Check for enemy hero encounter
        if (!$combatData) {
            foreach ($game->getPlayers() as $otherPlayer) {
                if ($otherPlayer->getId()->equals($hero->getPlayer()->getId())) {
                    continue;
                }
                foreach ($otherPlayer->getHeroes() as $enemyHero) {
                    if ($enemyHero->getPosX() === $targetX && $enemyHero->getPosY() === $targetY) {
                        $faction = $hero->getPlayer()->getFaction();
                        $attackerStacks = [];
                        foreach ($hero->getArmySlots() as $slot) {
                            $attackerStacks[] = [
                                'factionId' => $faction,
                                'unitId' => $slot->getUnitId(),
                                'quantity' => $slot->getQuantity(),
                                'slotIndex' => $slot->getSlotIndex(),
                            ];
                        }

                        $enemyFaction = $otherPlayer->getFaction();
                        $defenderStacks = [];
                        foreach ($enemyHero->getArmySlots() as $slot) {
                            $defenderStacks[] = [
                                'factionId' => $enemyFaction,
                                'unitId' => $slot->getUnitId(),
                                'quantity' => $slot->getQuantity(),
                                'slotIndex' => $slot->getSlotIndex(),
                            ];
                        }

                        $result = $this->combatService->resolveCombat($attackerStacks, $defenderStacks, $hero, $enemyHero);

                        if ($result->attackerWon) {
                            $otherPlayer->removeHero($enemyHero);
                            $this->em->remove($enemyHero);

                            foreach ($result->attackerLosses as $loss) {
                                foreach ($hero->getArmySlots() as $slot) {
                                    if ($slot->getSlotIndex() === $loss['slotIndex']) {
                                        if ($loss['remaining'] <= 0) {
                                            $hero->removeArmySlot($slot);
                                            $this->em->remove($slot);
                                        } else {
                                            $slot->setQuantity($loss['remaining']);
                                        }
                                        break;
                                    }
                                }
                            }

                            $levelUpResult = $hero->addExperience($result->experienceGained);
                            if ($levelUpResult['levelsGained'] > 0) {
                                $growth = $hero->getHeroClass()->getStatGrowth();
                                $levelUpData = [
                                    'levelsGained' => $levelUpResult['levelsGained'],
                                    'newLevel' => $levelUpResult['newLevel'],
                                    'statGrowth' => [
                                        'attack' => $growth['attack'] * $levelUpResult['levelsGained'],
                                        'defense' => $growth['defense'] * $levelUpResult['levelsGained'],
                                        'spellPower' => $growth['spellPower'] * $levelUpResult['levelsGained'],
                                        'knowledge' => $growth['knowledge'] * $levelUpResult['levelsGained'],
                                    ],
                                ];
                            }

                            $this->checkWinCondition($game);
                        } else {
                            if (count($path) >= 2) {
                                $prevStep = $path[count($path) - 2];
                                $hero->setPosX($prevStep[0]);
                                $hero->setPosY($prevStep[1]);
                            } else {
                                $hero->setPosX($path[0][0]);
                                $hero->setPosY($path[0][1]);
                            }

                            $armyEmpty = true;
                            foreach ($hero->getArmySlots() as $slot) {
                                foreach ($result->attackerLosses as $loss) {
                                    if ($slot->getSlotIndex() === $loss['slotIndex']) {
                                        if ($loss['remaining'] <= 0) {
                                            $hero->removeArmySlot($slot);
                                            $this->em->remove($slot);
                                        } else {
                                            $slot->setQuantity($loss['remaining']);
                                            $armyEmpty = false;
                                        }
                                        break;
                                    }
                                }
                            }

                            if ($armyEmpty) {
                                $player = $hero->getPlayer();
                                $player->removeHero($hero);
                                $this->em->remove($hero);

                                // Auto-advance turn if this player has no heroes left
                                if ($player->getHeroes()->isEmpty()) {
                                    $this->turnManager->endTurn($game);
                                }
                            }
                        }

                        $combatData = [
                            'occurred' => true,
                            'type' => 'hero',
                            'result' => $result->toArray(),
                        ];
                        break 2;
                    }
                }
            }
        }

        $this->em->flush();

        return new JsonResponse([
            'hero' => $hero->toArray(),
            'path' => $path,
            'cost' => $cost,
            'combat' => $combatData,
            'levelUp' => $levelUpData,
            'townCaptured' => $townCaptured,
            'game' => $game->toArray(),
        ]);
    }

    private function checkWinCondition(Game $game): void
    {
        $playersWithHeroes = 0;
        foreach ($game->getPlayers() as $p) {
            if (!$p->getHeroes()->isEmpty()) {
                $playersWithHeroes++;
            }
        }
        if ($playersWithHeroes <= 1 && $game->getNeutralStacks()->isEmpty()) {
            $game->setStatus('won');
        }
    }
}
