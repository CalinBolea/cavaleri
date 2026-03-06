<?php

namespace App\Entity;

use App\Repository\PlayerRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: PlayerRepository::class)]
class Player
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    private ?Uuid $id = null;

    #[ORM\ManyToOne(targetEntity: Game::class, inversedBy: 'players')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Game $game = null;

    #[ORM\Column(type: Types::STRING, length: 100)]
    private string $name;

    #[ORM\Column(type: Types::STRING, length: 50)]
    private string $faction = 'castle';

    #[ORM\Column(type: Types::STRING, length: 20)]
    private string $color = '#0000ff';

    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $isAI = false;

    #[ORM\Column(type: Types::JSON)]
    private array $resources = [
        'gold' => 2500,
        'wood' => 10,
        'ore' => 10,
        'mercury' => 0,
        'sulfur' => 0,
        'crystal' => 0,
        'gems' => 0,
    ];

    /** @var Collection<int, Hero> */
    #[ORM\OneToMany(targetEntity: Hero::class, mappedBy: 'player', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $heroes;

    public function __construct()
    {
        $this->heroes = new ArrayCollection();
    }

    public function getId(): ?Uuid
    {
        return $this->id;
    }

    public function getGame(): ?Game
    {
        return $this->game;
    }

    public function setGame(?Game $game): static
    {
        $this->game = $game;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;
        return $this;
    }

    public function getFaction(): string
    {
        return $this->faction;
    }

    public function setFaction(string $faction): static
    {
        $this->faction = $faction;
        return $this;
    }

    public function getColor(): string
    {
        return $this->color;
    }

    public function setColor(string $color): static
    {
        $this->color = $color;
        return $this;
    }

    public function isAI(): bool
    {
        return $this->isAI;
    }

    public function setIsAI(bool $isAI): static
    {
        $this->isAI = $isAI;
        return $this;
    }

    public function getResources(): array
    {
        return $this->resources;
    }

    public function setResources(array $resources): static
    {
        $this->resources = $resources;
        return $this;
    }

    /** @return Collection<int, Hero> */
    public function getHeroes(): Collection
    {
        return $this->heroes;
    }

    public function addHero(Hero $hero): static
    {
        if (!$this->heroes->contains($hero)) {
            $this->heroes->add($hero);
            $hero->setPlayer($this);
        }
        return $this;
    }

    public function removeHero(Hero $hero): static
    {
        if ($this->heroes->removeElement($hero)) {
            if ($hero->getPlayer() === $this) {
                $hero->setPlayer(null);
            }
        }
        return $this;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id?->toRfc4122(),
            'name' => $this->name,
            'faction' => $this->faction,
            'color' => $this->color,
            'isAI' => $this->isAI,
            'resources' => $this->resources,
            'heroes' => array_map(fn(Hero $h) => $h->toArray(), $this->heroes->toArray()),
        ];
    }
}
