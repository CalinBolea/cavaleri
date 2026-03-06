<?php

namespace App\Entity;

use App\Repository\HeroRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: HeroRepository::class)]
class Hero
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    private ?Uuid $id = null;

    #[ORM\ManyToOne(targetEntity: Player::class, inversedBy: 'heroes')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Player $player = null;

    #[ORM\Column(type: Types::STRING, length: 100)]
    private string $name;

    #[ORM\Column(type: Types::STRING, length: 50)]
    private string $heroClass = 'knight';

    #[ORM\Column(type: Types::INTEGER)]
    private int $posX;

    #[ORM\Column(type: Types::INTEGER)]
    private int $posY;

    #[ORM\Column(type: Types::INTEGER)]
    private int $movementPoints = 20;

    #[ORM\Column(type: Types::INTEGER)]
    private int $maxMovementPoints = 20;

    #[ORM\Column(type: Types::INTEGER)]
    private int $attack = 1;

    #[ORM\Column(type: Types::INTEGER)]
    private int $defense = 1;

    #[ORM\Column(type: Types::INTEGER)]
    private int $spellPower = 1;

    #[ORM\Column(type: Types::INTEGER)]
    private int $knowledge = 1;

    #[ORM\Column(type: Types::INTEGER)]
    private int $experience = 0;

    #[ORM\Column(type: Types::INTEGER)]
    private int $level = 1;

    /** @var Collection<int, ArmySlot> */
    #[ORM\OneToMany(targetEntity: ArmySlot::class, mappedBy: 'hero', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $armySlots;

    public function __construct()
    {
        $this->armySlots = new ArrayCollection();
    }

    public function getId(): ?Uuid
    {
        return $this->id;
    }

    public function getPlayer(): ?Player
    {
        return $this->player;
    }

    public function setPlayer(?Player $player): static
    {
        $this->player = $player;
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

    public function getHeroClass(): string
    {
        return $this->heroClass;
    }

    public function setHeroClass(string $heroClass): static
    {
        $this->heroClass = $heroClass;
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

    public function getMovementPoints(): int
    {
        return $this->movementPoints;
    }

    public function setMovementPoints(int $movementPoints): static
    {
        $this->movementPoints = $movementPoints;
        return $this;
    }

    public function getMaxMovementPoints(): int
    {
        return $this->maxMovementPoints;
    }

    public function setMaxMovementPoints(int $maxMovementPoints): static
    {
        $this->maxMovementPoints = $maxMovementPoints;
        return $this;
    }

    public function getAttack(): int
    {
        return $this->attack;
    }

    public function setAttack(int $attack): static
    {
        $this->attack = $attack;
        return $this;
    }

    public function getDefense(): int
    {
        return $this->defense;
    }

    public function setDefense(int $defense): static
    {
        $this->defense = $defense;
        return $this;
    }

    public function getSpellPower(): int
    {
        return $this->spellPower;
    }

    public function setSpellPower(int $spellPower): static
    {
        $this->spellPower = $spellPower;
        return $this;
    }

    public function getKnowledge(): int
    {
        return $this->knowledge;
    }

    public function setKnowledge(int $knowledge): static
    {
        $this->knowledge = $knowledge;
        return $this;
    }

    public function getExperience(): int
    {
        return $this->experience;
    }

    public function setExperience(int $experience): static
    {
        $this->experience = $experience;
        return $this;
    }

    public function getLevel(): int
    {
        return $this->level;
    }

    public function setLevel(int $level): static
    {
        $this->level = $level;
        return $this;
    }

    /** @return Collection<int, ArmySlot> */
    public function getArmySlots(): Collection
    {
        return $this->armySlots;
    }

    public function addArmySlot(ArmySlot $armySlot): static
    {
        if (!$this->armySlots->contains($armySlot)) {
            $this->armySlots->add($armySlot);
            $armySlot->setHero($this);
        }
        return $this;
    }

    public function removeArmySlot(ArmySlot $armySlot): static
    {
        if ($this->armySlots->removeElement($armySlot)) {
            if ($armySlot->getHero() === $this) {
                $armySlot->setHero(null);
            }
        }
        return $this;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id?->toRfc4122(),
            'name' => $this->name,
            'heroClass' => $this->heroClass,
            'posX' => $this->posX,
            'posY' => $this->posY,
            'movementPoints' => $this->movementPoints,
            'maxMovementPoints' => $this->maxMovementPoints,
            'attack' => $this->attack,
            'defense' => $this->defense,
            'spellPower' => $this->spellPower,
            'knowledge' => $this->knowledge,
            'experience' => $this->experience,
            'level' => $this->level,
            'army' => array_map(fn(ArmySlot $s) => $s->toArray(), $this->armySlots->toArray()),
        ];
    }
}
