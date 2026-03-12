<?php

namespace App\Entity;

use App\Repository\TownRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: TownRepository::class)]
class Town
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    private ?Uuid $id = null;

    #[ORM\ManyToOne(targetEntity: Game::class, inversedBy: 'towns')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Game $game = null;

    #[ORM\ManyToOne(targetEntity: Player::class, inversedBy: 'towns')]
    #[ORM\JoinColumn(nullable: true)]
    private ?Player $owner = null;

    #[ORM\Column(type: Types::INTEGER)]
    private int $posX;

    #[ORM\Column(type: Types::INTEGER)]
    private int $posY;

    #[ORM\Column(type: Types::STRING, length: 50)]
    private string $factionId;

    #[ORM\Column(type: Types::JSON)]
    private array $buildings = [];

    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $builtToday = false;

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

    public function getOwner(): ?Player
    {
        return $this->owner;
    }

    public function setOwner(?Player $owner): static
    {
        $this->owner = $owner;
        return $this;
    }

    public function getPosX(): int
    {
        return $this->posX;
    }

    public function setPosX(int $posX): static
    {
        $this->posX = $posX;
        return $this;
    }

    public function getPosY(): int
    {
        return $this->posY;
    }

    public function setPosY(int $posY): static
    {
        $this->posY = $posY;
        return $this;
    }

    public function getFactionId(): string
    {
        return $this->factionId;
    }

    public function setFactionId(string $factionId): static
    {
        $this->factionId = $factionId;
        return $this;
    }

    public function getBuildings(): array
    {
        return $this->buildings;
    }

    public function setBuildings(array $buildings): static
    {
        $this->buildings = $buildings;
        return $this;
    }

    public function hasBuilding(string $id): bool
    {
        return in_array($id, $this->buildings, true);
    }

    public function addBuilding(string $id): static
    {
        if (!$this->hasBuilding($id)) {
            $this->buildings[] = $id;
        }
        return $this;
    }

    public function hasBuiltToday(): bool
    {
        return $this->builtToday;
    }

    public function setBuiltToday(bool $builtToday): static
    {
        $this->builtToday = $builtToday;
        return $this;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id?->toRfc4122(),
            'posX' => $this->posX,
            'posY' => $this->posY,
            'factionId' => $this->factionId,
            'ownerId' => $this->owner?->getId()?->toRfc4122(),
            'buildings' => $this->buildings,
            'builtToday' => $this->builtToday,
        ];
    }
}
