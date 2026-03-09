<?php

namespace App\Entity;

use App\Repository\GameRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: GameRepository::class)]
#[ORM\HasLifecycleCallbacks]
class Game
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    private ?Uuid $id = null;

    #[ORM\Column(type: Types::STRING, length: 20)]
    private string $status = 'in_progress';

    #[ORM\Column(type: Types::INTEGER)]
    private int $currentDay = 1;

    #[ORM\Column(type: Types::INTEGER)]
    private int $currentWeek = 1;

    #[ORM\Column(type: Types::INTEGER)]
    private int $currentMonth = 1;

    #[ORM\Column(type: Types::INTEGER)]
    private int $currentPlayerIndex = 0;

    #[ORM\Column(type: Types::INTEGER)]
    private int $mapWidth;

    #[ORM\Column(type: Types::INTEGER)]
    private int $mapHeight;

    #[ORM\Column(type: Types::JSON)]
    private array $mapData = [];

    /** @var Collection<int, Player> */
    #[ORM\OneToMany(targetEntity: Player::class, mappedBy: 'game', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['id' => 'ASC'])]
    private Collection $players;

    /** @var Collection<int, NeutralStack> */
    #[ORM\OneToMany(targetEntity: NeutralStack::class, mappedBy: 'game', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $neutralStacks;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private ?\DateTimeImmutable $updatedAt = null;

    public function __construct()
    {
        $this->players = new ArrayCollection();
        $this->neutralStacks = new ArrayCollection();
    }

    public function getId(): ?Uuid
    {
        return $this->id;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): static
    {
        $this->status = $status;
        return $this;
    }

    public function getCurrentDay(): int
    {
        return $this->currentDay;
    }

    public function setCurrentDay(int $currentDay): static
    {
        $this->currentDay = $currentDay;
        return $this;
    }

    public function getCurrentWeek(): int
    {
        return $this->currentWeek;
    }

    public function setCurrentWeek(int $currentWeek): static
    {
        $this->currentWeek = $currentWeek;
        return $this;
    }

    public function getCurrentMonth(): int
    {
        return $this->currentMonth;
    }

    public function setCurrentMonth(int $currentMonth): static
    {
        $this->currentMonth = $currentMonth;
        return $this;
    }

    public function getCurrentPlayerIndex(): int
    {
        return $this->currentPlayerIndex;
    }

    public function setCurrentPlayerIndex(int $currentPlayerIndex): static
    {
        $this->currentPlayerIndex = $currentPlayerIndex;
        return $this;
    }

    public function getMapWidth(): int
    {
        return $this->mapWidth;
    }

    public function setMapWidth(int $mapWidth): static
    {
        $this->mapWidth = $mapWidth;
        return $this;
    }

    public function getMapHeight(): int
    {
        return $this->mapHeight;
    }

    public function setMapHeight(int $mapHeight): static
    {
        $this->mapHeight = $mapHeight;
        return $this;
    }

    public function getMapData(): array
    {
        return $this->mapData;
    }

    public function setMapData(array $mapData): static
    {
        $this->mapData = $mapData;
        return $this;
    }

    /** @return Collection<int, Player> */
    public function getPlayers(): Collection
    {
        return $this->players;
    }

    public function addPlayer(Player $player): static
    {
        if (!$this->players->contains($player)) {
            $this->players->add($player);
            $player->setGame($this);
        }
        return $this;
    }

    public function removePlayer(Player $player): static
    {
        if ($this->players->removeElement($player)) {
            if ($player->getGame() === $this) {
                $player->setGame(null);
            }
        }
        return $this;
    }

    /** @return Collection<int, NeutralStack> */
    public function getNeutralStacks(): Collection
    {
        return $this->neutralStacks;
    }

    public function addNeutralStack(NeutralStack $neutralStack): static
    {
        if (!$this->neutralStacks->contains($neutralStack)) {
            $this->neutralStacks->add($neutralStack);
            $neutralStack->setGame($this);
        }
        return $this;
    }

    public function removeNeutralStack(NeutralStack $neutralStack): static
    {
        if ($this->neutralStacks->removeElement($neutralStack)) {
            if ($neutralStack->getGame() === $this) {
                $neutralStack->setGame(null);
            }
        }
        return $this;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?\DateTimeImmutable
    {
        return $this->updatedAt;
    }

    #[ORM\PrePersist]
    public function onPrePersist(): void
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
    }

    #[ORM\PreUpdate]
    public function onPreUpdate(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function toSummaryArray(): array
    {
        return [
            'id' => $this->id?->toRfc4122(),
            'status' => $this->status,
            'currentDay' => $this->currentDay,
            'currentWeek' => $this->currentWeek,
            'currentMonth' => $this->currentMonth,
            'mapWidth' => $this->mapWidth,
            'mapHeight' => $this->mapHeight,
            'players' => array_values(array_map(fn(Player $p) => [
                'name' => $p->getName(),
                'faction' => $p->getFaction(),
            ], $this->players->toArray())),
            'createdAt' => $this->createdAt?->format(\DateTimeInterface::ATOM),
            'updatedAt' => $this->updatedAt?->format(\DateTimeInterface::ATOM),
        ];
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id?->toRfc4122(),
            'status' => $this->status,
            'currentDay' => $this->currentDay,
            'currentWeek' => $this->currentWeek,
            'currentMonth' => $this->currentMonth,
            'currentPlayerIndex' => $this->currentPlayerIndex,
            'mapWidth' => $this->mapWidth,
            'mapHeight' => $this->mapHeight,
            'mapData' => $this->mapData,
            'players' => array_values(array_map(fn(Player $p) => $p->toArray(), $this->players->toArray())),
            'neutralStacks' => array_values(array_map(fn(NeutralStack $n) => $n->toArray(), $this->neutralStacks->toArray())),
            'createdAt' => $this->createdAt?->format(\DateTimeInterface::ATOM),
            'updatedAt' => $this->updatedAt?->format(\DateTimeInterface::ATOM),
        ];
    }
}
