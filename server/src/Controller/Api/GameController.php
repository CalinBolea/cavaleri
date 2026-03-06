<?php

namespace App\Controller\Api;

use App\Entity\ArmySlot;
use App\Entity\Game;
use App\Entity\Hero;
use App\Entity\NeutralStack;
use App\Entity\Player;
use App\Repository\GameRepository;
use App\Service\GameDataProvider;
use App\Service\GameEngine\TurnManager;
use App\Service\Map\MapGenerator;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api')]
class GameController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private GameRepository $gameRepository,
        private MapGenerator $mapGenerator,
        private GameDataProvider $gameDataProvider,
        private TurnManager $turnManager,
    ) {
    }

    #[Route('/games', name: 'api_games_index', methods: ['GET'])]
    public function index(): JsonResponse
    {
        $games = $this->gameRepository->findInProgressOrderedByUpdated();
        return new JsonResponse(array_map(fn(Game $g) => $g->toSummaryArray(), $games));
    }

    #[Route('/games', name: 'api_games_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?? [];
        $playerName = $data['playerName'] ?? 'Player 1';
        $faction = $data['faction'] ?? 'castle';

        $mapWidth = 20;
        $mapHeight = 20;

        // Generate map
        $mapData = $this->mapGenerator->generate($mapWidth, $mapHeight);

        // Create game
        $game = new Game();
        $game->setMapWidth($mapWidth);
        $game->setMapHeight($mapHeight);
        $game->setMapData($mapData);
        $game->setStatus('in_progress');

        // Create player
        $player = new Player();
        $player->setName($playerName);
        $player->setFaction($faction);
        $player->setColor('#0066cc');
        $player->setResources([
            'gold' => 2500,
            'wood' => 10,
            'ore' => 10,
            'mercury' => 0,
            'sulfur' => 0,
            'crystal' => 0,
            'gems' => 0,
        ]);
        $game->addPlayer($player);

        // Create hero with starting army
        $hero = new Hero();
        $hero->setName('Lord Haart');
        $hero->setHeroClass('knight');
        $hero->setPosX(3);
        $hero->setPosY(3);

        $slot1 = new ArmySlot();
        $slot1->setSlotIndex(0);
        $slot1->setUnitId('pikeman');
        $slot1->setQuantity(random_int(10, 50));
        $hero->addArmySlot($slot1);

        $slot2 = new ArmySlot();
        $slot2->setSlotIndex(1);
        $slot2->setUnitId('archer');
        $slot2->setQuantity(random_int(10, 50));
        $hero->addArmySlot($slot2);

        $player->addHero($hero);

        // Generate neutral stacks
        $neutralStackData = $this->mapGenerator->generateNeutralStacks($mapData);
        foreach ($neutralStackData as $stackData) {
            $neutralStack = new NeutralStack();
            $neutralStack->setPosX($stackData['posX']);
            $neutralStack->setPosY($stackData['posY']);
            $neutralStack->setFactionId($stackData['factionId']);
            $neutralStack->setUnitId($stackData['unitId']);
            $neutralStack->setQuantity($stackData['quantity']);
            $game->addNeutralStack($neutralStack);
        }

        $this->em->persist($game);
        $this->em->flush();

        return new JsonResponse($game->toArray(), Response::HTTP_CREATED);
    }

    #[Route('/games/{id}', name: 'api_games_show', methods: ['GET'])]
    public function show(string $id): JsonResponse
    {
        $game = $this->gameRepository->find($id);

        if (!$game) {
            return new JsonResponse(['error' => 'Game not found'], Response::HTTP_NOT_FOUND);
        }

        return new JsonResponse($game->toArray());
    }

    #[Route('/games/{id}/end-turn', name: 'api_games_end_turn', methods: ['POST'])]
    public function endTurn(string $id): JsonResponse
    {
        $game = $this->gameRepository->find($id);

        if (!$game) {
            return new JsonResponse(['error' => 'Game not found'], Response::HTTP_NOT_FOUND);
        }

        if ($game->getStatus() !== 'in_progress') {
            return new JsonResponse(['error' => 'Game is over'], Response::HTTP_BAD_REQUEST);
        }

        $this->turnManager->endTurn($game);

        return new JsonResponse($game->toArray());
    }
}
