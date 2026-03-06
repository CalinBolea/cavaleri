<?php

namespace App\Entity;

use App\Repository\NeutralStackRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: NeutralStackRepository::class)]
class NeutralStack
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    private ?Uuid $id = null;

    #[ORM\ManyToOne(targetEntity: Game::class, inversedBy: 'neutralStacks')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Game $game = null;

    #[ORM\Column(type: Types::INTEGER)]
    private int $posX;

    #[ORM\Column(type: Types::INTEGER)]
    private int $posY;

    #[ORM\Column(type: Types::STRING, length: 50)]
    private string $factionId;

    #[ORM\Column(type: Types::STRING, length: 50)]
    private string $unitId;

    #[ORM\Column(type: Types::INTEGER)]
    private int $quantity;

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

    public function getUnitId(): string
    {
        return $this->unitId;
    }

    public function setUnitId(string $unitId): static
    {
        $this->unitId = $unitId;
        return $this;
    }

    public function getQuantity(): int
    {
        return $this->quantity;
    }

    public function setQuantity(int $quantity): static
    {
        $this->quantity = $quantity;
        return $this;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id?->toRfc4122(),
            'posX' => $this->posX,
            'posY' => $this->posY,
            'factionId' => $this->factionId,
            'unitId' => $this->unitId,
            'quantity' => $this->quantity,
        ];
    }
}
