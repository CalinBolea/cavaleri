<?php

namespace App\Repository;

use App\Entity\Game;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Game>
 */
class GameRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Game::class);
    }

    public function findInProgressOrderedByUpdated(): array
    {
        return $this->createQueryBuilder('g')
            ->where('g.status = :status')
            ->setParameter('status', 'in_progress')
            ->orderBy('g.updatedAt', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
