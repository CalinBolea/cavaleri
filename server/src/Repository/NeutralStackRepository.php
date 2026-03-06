<?php

namespace App\Repository;

use App\Entity\Game;
use App\Entity\NeutralStack;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<NeutralStack>
 */
class NeutralStackRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, NeutralStack::class);
    }

    public function findByPosition(Game $game, int $posX, int $posY): ?NeutralStack
    {
        return $this->findOneBy([
            'game' => $game,
            'posX' => $posX,
            'posY' => $posY,
        ]);
    }
}
