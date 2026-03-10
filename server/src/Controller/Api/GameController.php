<?php

namespace App\Controller\Api;

use App\Entity\ArmySlot;
use App\Entity\Game;
use App\Entity\Hero;
use App\Entity\NeutralStack;
use App\Entity\Player;
use App\Entity\Town;
use App\Enum\HeroClass;
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

    private const PLAYER_COLORS = ['#0066cc', '#cc3333', '#33aa33', '#cc9900'];

    private const FACTION_STARTING_ARMY = [
        'castle' => [
            ['unitId' => 'pikeman', 'min' => 10, 'max' => 5000],
            ['unitId' => 'archer', 'min' => 10, 'max' => 5000],
        ],
        'necropolis' => [
            ['unitId' => 'skeleton', 'min' => 10, 'max' => 50],
            ['unitId' => 'walking_dead', 'min' => 10, 'max' => 50],
        ],
        'rampart' => [
            ['unitId' => 'centaur', 'min' => 10, 'max' => 50],
            ['unitId' => 'dwarf', 'min' => 10, 'max' => 50],
        ],
        'tower' => [
            ['unitId' => 'gremlin', 'min' => 10, 'max' => 50],
            ['unitId' => 'stone_gargoyle', 'min' => 10, 'max' => 50],
        ],
        'inferno' => [
            ['unitId' => 'imp', 'min' => 10, 'max' => 50],
            ['unitId' => 'gog', 'min' => 10, 'max' => 50],
        ],
        'dungeon' => [
            ['unitId' => 'troglodyte', 'min' => 10, 'max' => 50],
            ['unitId' => 'harpy', 'min' => 10, 'max' => 50],
        ],
        'stronghold' => [
            ['unitId' => 'goblin', 'min' => 10, 'max' => 50],
            ['unitId' => 'wolf_rider', 'min' => 10, 'max' => 50],
        ],
        'fortress' => [
            ['unitId' => 'gnoll', 'min' => 10, 'max' => 50],
            ['unitId' => 'lizardman', 'min' => 10, 'max' => 50],
        ],
    ];

    private const HERO_NAMES = [
        'knight' => ['Sir Galahad', 'Lord Haart', 'Sorsha', 'Tyris'],
        'wizard' => ['Sandro', 'Vidomina', 'Thant', 'Isra'],
        'ranger' => ['Jenova', 'Ryland', 'Mephala', 'Gelu'],
        'demoniac' => ['Calh', 'Nymus', 'Rashka', 'Xeron'],
        'overlord' => ['Gunnar', 'Lorelei', 'Mutare', 'Alamar'],
        'barbarian' => ['Crag Hack', 'Gretchin', 'Shiva', 'Tyraxor'],
        'beastmaster' => ['Bron', 'Drakon', 'Tazar', 'Wystan'],
    ];

    private const FACTION_HERO_CLASS = [
        'castle' => 'knight',
        'necropolis' => 'wizard',
        'rampart' => 'ranger',
        'tower' => 'wizard',
        'inferno' => 'demoniac',
        'dungeon' => 'overlord',
        'stronghold' => 'barbarian',
        'fortress' => 'beastmaster',
    ];

    #[Route('/games', name: 'api_games_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?? [];

        // Support new players array or legacy single-player format
        $playersData = $data['players'] ?? [
            ['name' => $data['playerName'] ?? 'Player 1', 'faction' => $data['faction'] ?? 'castle'],
        ];

        $playerCount = min(count($playersData), 4);
        $playersData = array_slice($playersData, 0, $playerCount);

        $mapSizeKey = $data['mapSize'] ?? 'S';
        if (!isset(MapGenerator::MAP_SIZES[$mapSizeKey])) {
            return new JsonResponse(
                ['error' => 'Invalid map size. Valid sizes: ' . implode(', ', array_keys(MapGenerator::MAP_SIZES))],
                Response::HTTP_BAD_REQUEST,
            );
        }
        $mapConfig = MapGenerator::getMapConfig($mapSizeKey);
        $mapWidth = $mapConfig['width'];
        $mapHeight = $mapConfig['height'];

        // Select starting positions for the number of players
        $startPositions = array_slice($mapConfig['startPositions'], 0, $playerCount);

        // Generate map
        $mapData = $this->mapGenerator->generate($mapWidth, $mapHeight, $startPositions);

        // Create game
        $game = new Game();
        $game->setMapWidth($mapWidth);
        $game->setMapHeight($mapHeight);
        $game->setMapData($mapData);
        $game->setStatus('in_progress');

        // Create players
        foreach ($playersData as $i => $pd) {
            $faction = $pd['faction'] ?? 'castle';
            $player = new Player();
            $player->setName($pd['name'] ?? 'Player ' . ($i + 1));
            $player->setFaction($faction);
            $player->setColor(self::PLAYER_COLORS[$i] ?? '#0066cc');
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

            // Create hero with faction-appropriate starting army
            $hero = new Hero();
            $heroClassValue = self::FACTION_HERO_CLASS[$faction] ?? 'knight';
            $heroClass = HeroClass::from($heroClassValue);
            $names = self::HERO_NAMES[$heroClassValue] ?? self::HERO_NAMES['knight'];
            $hero->setName($names[array_rand($names)]);
            $hero->setHeroClass($heroClass);
            $hero->setPosX($startPositions[$i][0]);
            $hero->setPosY($startPositions[$i][1]);

            $armyConfig = self::FACTION_STARTING_ARMY[$faction] ?? self::FACTION_STARTING_ARMY['castle'];
            foreach ($armyConfig as $slotIdx => $unitCfg) {
                $slot = new ArmySlot();
                $slot->setSlotIndex($slotIdx);
                $slot->setUnitId($unitCfg['unitId']);
                $slot->setQuantity(random_int($unitCfg['min'], $unitCfg['max']));
                $hero->addArmySlot($slot);
            }

            $player->addHero($hero);

            // Create player's starting town
            $town = new Town();
            $town->setPosX($startPositions[$i][0]);
            $town->setPosY($startPositions[$i][1]);
            $town->setFactionId($faction);
            $town->setOwner($player);
            $game->addTown($town);
        }

        // Generate neutral stacks
        $neutralStackData = $this->mapGenerator->generateNeutralStacks($mapData, $mapConfig['neutralStackCount'], $startPositions);
        foreach ($neutralStackData as $stackData) {
            $neutralStack = new NeutralStack();
            $neutralStack->setPosX($stackData['posX']);
            $neutralStack->setPosY($stackData['posY']);
            $neutralStack->setFactionId($stackData['factionId']);
            $neutralStack->setUnitId($stackData['unitId']);
            $neutralStack->setQuantity($stackData['quantity']);
            $game->addNeutralStack($neutralStack);
        }

        // Generate neutral towns
        $neutralStackPositions = array_map(fn($s) => [$s['posX'], $s['posY']], $neutralStackData);
        $neutralTownData = $this->mapGenerator->generateNeutralTowns($mapData, $mapConfig['neutralTownCount'], $startPositions, $neutralStackPositions);
        foreach ($neutralTownData as $td) {
            $town = new Town();
            $town->setPosX($td['posX']);
            $town->setPosY($td['posY']);
            $town->setFactionId($td['factionId']);
            $game->addTown($town);
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

    #[Route('/games/{id}', name: 'api_games_delete', methods: ['DELETE'])]
    public function delete(string $id): Response
    {
        $game = $this->gameRepository->find($id);

        if (!$game) {
            return new JsonResponse(['error' => 'Game not found'], Response::HTTP_NOT_FOUND);
        }

        $this->em->remove($game);
        $this->em->flush();

        return new Response(null, Response::HTTP_NO_CONTENT);
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
