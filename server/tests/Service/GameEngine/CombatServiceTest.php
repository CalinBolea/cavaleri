<?php

namespace App\Tests\Service\GameEngine;

use App\Entity\Hero;
use App\Service\GameDataProvider;
use App\Service\GameEngine\CombatService;
use PHPUnit\Framework\TestCase;

class CombatServiceTest extends TestCase
{
    private CombatService $combatService;

    protected function setUp(): void
    {
        $gameDataProvider = $this->createMock(GameDataProvider::class);
        $gameDataProvider->method('getUnit')->willReturnCallback(function (string $faction, string $unitId) {
            $units = [
                'pikeman' => [
                    'id' => 'pikeman', 'name' => 'Pikeman', 'tier' => 1,
                    'attack' => 4, 'defense' => 5, 'minDamage' => 1, 'maxDamage' => 3,
                    'health' => 10, 'speed' => 4, 'abilities' => [], 'fightValue' => 80,
                ],
                'archer' => [
                    'id' => 'archer', 'name' => 'Archer', 'tier' => 2,
                    'attack' => 6, 'defense' => 3, 'minDamage' => 2, 'maxDamage' => 3,
                    'health' => 10, 'speed' => 4, 'abilities' => ['ranged'],
                    'shots' => 12, 'fightValue' => 126,
                ],
                'griffin' => [
                    'id' => 'griffin', 'name' => 'Griffin', 'tier' => 3,
                    'attack' => 8, 'defense' => 8, 'minDamage' => 3, 'maxDamage' => 6,
                    'health' => 25, 'speed' => 6, 'abilities' => ['flying', 'retaliate_twice'],
                    'fightValue' => 351,
                ],
                'swordsman' => [
                    'id' => 'swordsman', 'name' => 'Swordsman', 'tier' => 4,
                    'attack' => 10, 'defense' => 12, 'minDamage' => 6, 'maxDamage' => 9,
                    'health' => 35, 'speed' => 5, 'abilities' => [], 'fightValue' => 555,
                ],
                'skeleton' => [
                    'id' => 'skeleton', 'name' => 'Skeleton', 'tier' => 1,
                    'attack' => 5, 'defense' => 4, 'minDamage' => 1, 'maxDamage' => 3,
                    'health' => 6, 'speed' => 4, 'abilities' => ['undead'], 'fightValue' => 75,
                ],
                'vampire' => [
                    'id' => 'vampire', 'name' => 'Vampire', 'tier' => 4,
                    'attack' => 10, 'defense' => 9, 'minDamage' => 5, 'maxDamage' => 8,
                    'health' => 30, 'speed' => 6,
                    'abilities' => ['undead', 'flying', 'no_retaliation', 'life_drain'],
                    'fightValue' => 555,
                ],
                'lich' => [
                    'id' => 'lich', 'name' => 'Lich', 'tier' => 5,
                    'attack' => 13, 'defense' => 10, 'minDamage' => 11, 'maxDamage' => 13,
                    'health' => 30, 'speed' => 6, 'abilities' => ['undead', 'ranged'],
                    'shots' => 12, 'fightValue' => 848,
                ],
            ];
            return $units[$unitId] ?? null;
        });

        $this->combatService = new CombatService($gameDataProvider);
    }

    public function testStrongerAttackerWins(): void
    {
        $attacker = [['factionId' => 'castle', 'unitId' => 'pikeman', 'quantity' => 20, 'slotIndex' => 0]];
        $defender = [['factionId' => 'castle', 'unitId' => 'pikeman', 'quantity' => 5, 'slotIndex' => 0]];

        $result = $this->combatService->resolveCombat($attacker, $defender);

        $this->assertTrue($result->attackerWon);
        $this->assertEquals('attacker', $result->winner);
    }

    public function testDefenderWinsWhenStronger(): void
    {
        $attacker = [['factionId' => 'castle', 'unitId' => 'pikeman', 'quantity' => 3, 'slotIndex' => 0]];
        $defender = [['factionId' => 'castle', 'unitId' => 'griffin', 'quantity' => 20, 'slotIndex' => 0]];

        $result = $this->combatService->resolveCombat($attacker, $defender);

        $this->assertFalse($result->attackerWon);
        $this->assertEquals('defender', $result->winner);
    }

    public function testCombatResultContainsLosses(): void
    {
        $attacker = [['factionId' => 'castle', 'unitId' => 'pikeman', 'quantity' => 20, 'slotIndex' => 0]];
        $defender = [['factionId' => 'castle', 'unitId' => 'pikeman', 'quantity' => 10, 'slotIndex' => 0]];

        $result = $this->combatService->resolveCombat($attacker, $defender);

        $this->assertNotEmpty($result->attackerLosses);
        $this->assertNotEmpty($result->defenderLosses);
        $this->assertArrayHasKey('unitId', $result->attackerLosses[0]);
        $this->assertArrayHasKey('lost', $result->attackerLosses[0]);
        $this->assertArrayHasKey('remaining', $result->attackerLosses[0]);
    }

    public function testExperienceGainedOnVictory(): void
    {
        $attacker = [['factionId' => 'castle', 'unitId' => 'pikeman', 'quantity' => 20, 'slotIndex' => 0]];
        $defender = [['factionId' => 'castle', 'unitId' => 'pikeman', 'quantity' => 5, 'slotIndex' => 0]];

        $result = $this->combatService->resolveCombat($attacker, $defender);

        $this->assertTrue($result->attackerWon);
        $this->assertGreaterThan(0, $result->experienceGained);
    }

    public function testRangedUnitsNoRetaliation(): void
    {
        $attacker = [['factionId' => 'castle', 'unitId' => 'archer', 'quantity' => 10, 'slotIndex' => 0]];
        $defender = [['factionId' => 'castle', 'unitId' => 'pikeman', 'quantity' => 5, 'slotIndex' => 0]];

        $result = $this->combatService->resolveCombat($attacker, $defender);

        // Check first round - archer attacks should not trigger retaliation
        $firstRound = $result->rounds[0];
        $retaliations = array_filter($firstRound['actions'], fn($a) => $a['isRetaliation'] && $a['attacker'] === 'pikeman' && $a['defender'] === 'archer');
        $this->assertEmpty($retaliations);
    }

    public function testRetaliationOccursInMelee(): void
    {
        $attacker = [['factionId' => 'castle', 'unitId' => 'pikeman', 'quantity' => 10, 'slotIndex' => 0]];
        $defender = [['factionId' => 'castle', 'unitId' => 'pikeman', 'quantity' => 10, 'slotIndex' => 0]];

        $result = $this->combatService->resolveCombat($attacker, $defender);

        // Both sides should take losses from retaliation
        $hasRetaliation = false;
        foreach ($result->rounds as $round) {
            foreach ($round['actions'] as $action) {
                if ($action['isRetaliation']) {
                    $hasRetaliation = true;
                    break 2;
                }
            }
        }
        $this->assertTrue($hasRetaliation);
    }

    public function testHeroAttackBonusIncreasesDamage(): void
    {
        $attacker = [['factionId' => 'castle', 'unitId' => 'pikeman', 'quantity' => 10, 'slotIndex' => 0]];
        $defender = [['factionId' => 'castle', 'unitId' => 'pikeman', 'quantity' => 10, 'slotIndex' => 0]];

        // Run without hero multiple times to get average losses
        $noHeroDefenderLosses = 0;
        $runs = 20;
        for ($i = 0; $i < $runs; $i++) {
            $result = $this->combatService->resolveCombat($attacker, $defender);
            $noHeroDefenderLosses += $result->defenderLosses[0]['lost'];
        }

        // Run with hero (high attack) multiple times
        $hero = new Hero();
        $hero->setName('Strong Hero');
        $hero->setPosX(0);
        $hero->setPosY(0);
        $hero->setAttack(10);
        $hero->setDefense(1);

        $withHeroDefenderLosses = 0;
        for ($i = 0; $i < $runs; $i++) {
            $result = $this->combatService->resolveCombat($attacker, $defender, $hero);
            $withHeroDefenderLosses += $result->defenderLosses[0]['lost'];
        }

        $this->assertGreaterThan($noHeroDefenderLosses, $withHeroDefenderLosses);
    }

    public function testMinimumOneDamage(): void
    {
        // High defense unit vs low attack: should still deal at least 1 damage
        $attacker = [['factionId' => 'castle', 'unitId' => 'pikeman', 'quantity' => 1, 'slotIndex' => 0]];
        $defender = [['factionId' => 'castle', 'unitId' => 'griffin', 'quantity' => 50, 'slotIndex' => 0]];

        $result = $this->combatService->resolveCombat($attacker, $defender);

        // Check first round: attacker should deal at least 1 damage
        $firstAction = $result->rounds[0]['actions'][0] ?? null;
        if ($firstAction && !$firstAction['isRetaliation']) {
            $this->assertGreaterThanOrEqual(1, $firstAction['damage']);
        }
    }

    public function testNoRetaliationAbility(): void
    {
        // Vampires have no_retaliation — defenders should never retaliate
        $attacker = [['factionId' => 'necropolis', 'unitId' => 'vampire', 'quantity' => 5, 'slotIndex' => 0]];
        $defender = [['factionId' => 'castle', 'unitId' => 'swordsman', 'quantity' => 5, 'slotIndex' => 0]];

        $result = $this->combatService->resolveCombat($attacker, $defender);

        foreach ($result->rounds as $round) {
            foreach ($round['actions'] as $action) {
                if ($action['attacker'] === 'vampire') {
                    // The next action should not be a retaliation against vampire
                    continue;
                }
                if ($action['defender'] === 'vampire' && $action['isRetaliation']) {
                    $this->fail('Swordsman should not retaliate against vampire (no_retaliation)');
                }
            }
        }
        $this->assertTrue(true);
    }

    public function testCrossFactionCombat(): void
    {
        $attacker = [['factionId' => 'castle', 'unitId' => 'swordsman', 'quantity' => 10, 'slotIndex' => 0]];
        $defender = [['factionId' => 'necropolis', 'unitId' => 'skeleton', 'quantity' => 20, 'slotIndex' => 0]];

        $result = $this->combatService->resolveCombat($attacker, $defender);

        // Swordsmen are much stronger, should win
        $this->assertTrue($result->attackerWon);
        $this->assertGreaterThan(0, $result->experienceGained);
    }

    public function testMultiStackCombat(): void
    {
        $attacker = [
            ['factionId' => 'castle', 'unitId' => 'pikeman', 'quantity' => 10, 'slotIndex' => 0],
            ['factionId' => 'castle', 'unitId' => 'archer', 'quantity' => 5, 'slotIndex' => 1],
        ];
        $defender = [
            ['factionId' => 'necropolis', 'unitId' => 'skeleton', 'quantity' => 15, 'slotIndex' => 0],
            ['factionId' => 'necropolis', 'unitId' => 'lich', 'quantity' => 2, 'slotIndex' => 1],
        ];

        $result = $this->combatService->resolveCombat($attacker, $defender);

        // Both sides should have 2 loss entries
        $this->assertCount(2, $result->attackerLosses);
        $this->assertCount(2, $result->defenderLosses);
    }

    public function testLifeDrainHealing(): void
    {
        // Vampires should heal by draining — run many times and check they tend to survive better
        $vampireSurvivors = 0;
        $runs = 20;
        for ($i = 0; $i < $runs; $i++) {
            $attacker = [['factionId' => 'necropolis', 'unitId' => 'vampire', 'quantity' => 5, 'slotIndex' => 0]];
            $defender = [['factionId' => 'castle', 'unitId' => 'pikeman', 'quantity' => 15, 'slotIndex' => 0]];

            $result = $this->combatService->resolveCombat($attacker, $defender);
            if ($result->attackerWon) {
                $vampireSurvivors += $result->attackerLosses[0]['remaining'];
            }
        }
        // Vampires (no retaliation + life drain) should win most fights and have survivors
        $this->assertGreaterThan(0, $vampireSurvivors);
    }
}
