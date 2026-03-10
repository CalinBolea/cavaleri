<?php

namespace App\Repository;

use App\Entity\Game;
use App\Entity\Town;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Town>
 */
class TownRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Town::class);
    }

    public function findByPosition(Game $game, int $posX, int $posY): ?Town
    {
        return $this->findOneBy([
            'game' => $game,
            'posX' => $posX,
            'posY' => $posY,
        ]);
    }
}
