<?php

namespace App\Entity;

use App\Repository\ArmySlotRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: ArmySlotRepository::class)]
class ArmySlot
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    private ?Uuid $id = null;

    #[ORM\ManyToOne(targetEntity: Hero::class, inversedBy: 'armySlots')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Hero $hero = null;

    #[ORM\Column(type: Types::INTEGER)]
    private int $slotIndex;

    #[ORM\Column(type: Types::STRING, length: 50)]
    private string $unitId;

    #[ORM\Column(type: Types::INTEGER)]
    private int $quantity;

    public function getId(): ?Uuid
    {
        return $this->id;
    }

    public function getHero(): ?Hero
    {
        return $this->hero;
    }

    public function setHero(?Hero $hero): static
    {
        $this->hero = $hero;
        return $this;
    }

    public function getSlotIndex(): int
    {
        return $this->slotIndex;
    }

    public function setSlotIndex(int $slotIndex): static
    {
        $this->slotIndex = $slotIndex;
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
            'slotIndex' => $this->slotIndex,
            'unitId' => $this->unitId,
            'quantity' => $this->quantity,
        ];
    }
}
