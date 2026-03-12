<?php

namespace App\Controller\Api;

use App\Repository\GameRepository;
use App\Repository\TownRepository;
use App\Service\GameDataProvider;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api')]
class TownController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private GameRepository $gameRepository,
        private TownRepository $townRepository,
        private GameDataProvider $gameDataProvider,
    ) {
    }

    #[Route('/games/{gameId}/towns/{townId}/build', name: 'api_towns_build', methods: ['POST'])]
    public function build(string $gameId, string $townId, Request $request): JsonResponse
    {
        $game = $this->gameRepository->find($gameId);
        if (!$game) {
            return new JsonResponse(['error' => 'Game not found'], Response::HTTP_NOT_FOUND);
        }
        if ($game->getStatus() !== 'in_progress') {
            return new JsonResponse(['error' => 'Game is not in progress'], Response::HTTP_BAD_REQUEST);
        }

        $town = $this->townRepository->find($townId);
        if (!$town || $town->getGame() !== $game) {
            return new JsonResponse(['error' => 'Town not found'], Response::HTTP_NOT_FOUND);
        }

        $currentPlayer = $game->getPlayers()[$game->getCurrentPlayerIndex()] ?? null;
        if (!$currentPlayer || $town->getOwner() !== $currentPlayer) {
            return new JsonResponse(['error' => 'Not your town'], Response::HTTP_FORBIDDEN);
        }

        if ($town->hasBuiltToday()) {
            return new JsonResponse(['error' => 'Already built in this town today'], Response::HTTP_BAD_REQUEST);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $buildingId = $data['buildingId'] ?? null;
        if (!$buildingId) {
            return new JsonResponse(['error' => 'buildingId is required'], Response::HTTP_BAD_REQUEST);
        }

        $faction = $this->gameDataProvider->getFaction($town->getFactionId());
        if (!$faction) {
            return new JsonResponse(['error' => 'Invalid faction'], Response::HTTP_BAD_REQUEST);
        }

        $buildingDef = null;
        foreach ($faction['buildings'] as $b) {
            if ($b['id'] === $buildingId) {
                $buildingDef = $b;
                break;
            }
        }
        if (!$buildingDef) {
            return new JsonResponse(['error' => 'Building not found in faction'], Response::HTTP_BAD_REQUEST);
        }

        if ($town->hasBuilding($buildingId)) {
            return new JsonResponse(['error' => 'Building already built'], Response::HTTP_BAD_REQUEST);
        }

        foreach ($buildingDef['prerequisites'] as $prereq) {
            if (!$town->hasBuilding($prereq)) {
                return new JsonResponse(['error' => "Missing prerequisite: $prereq"], Response::HTTP_BAD_REQUEST);
            }
        }

        $resources = $currentPlayer->getResources();
        foreach ($buildingDef['cost'] as $resource => $amount) {
            if (($resources[$resource] ?? 0) < $amount) {
                return new JsonResponse(['error' => "Not enough $resource"], Response::HTTP_BAD_REQUEST);
            }
        }

        // Deduct resources
        foreach ($buildingDef['cost'] as $resource => $amount) {
            $resources[$resource] -= $amount;
        }
        $currentPlayer->setResources($resources);

        $town->addBuilding($buildingId);
        $town->setBuiltToday(true);

        $this->em->flush();

        return new JsonResponse([
            'town' => $town->toArray(),
            'resources' => $currentPlayer->getResources(),
        ]);
    }
}
