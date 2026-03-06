<?php

namespace App\Controller\Api;

use App\Repository\GameRepository;
use App\Repository\HeroRepository;
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
    ) {
    }

    #[Route('/games/{gameId}/heroes/{heroId}/move', name: 'api_heroes_move', methods: ['POST'])]
    public function move(string $gameId, string $heroId, Request $request): JsonResponse
    {
        $game = $this->gameRepository->find($gameId);
        if (!$game) {
            return new JsonResponse(['error' => 'Game not found'], Response::HTTP_NOT_FOUND);
        }

        $hero = $this->heroRepository->find($heroId);
        if (!$hero || !$hero->getPlayer()->getGame()->getId()->equals($game->getId())) {
            return new JsonResponse(['error' => 'Hero not found'], Response::HTTP_NOT_FOUND);
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

        $this->em->flush();

        return new JsonResponse([
            'hero' => $hero->toArray(),
            'path' => $path,
            'cost' => $cost,
            'game' => $game->toArray(),
        ]);
    }
}
