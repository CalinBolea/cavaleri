<?php

namespace App\Service\GameEngine;

use App\DTO\CombatResult;
use App\Entity\Hero;
use App\Service\GameDataProvider;

class CombatService
{
    public function __construct(private GameDataProvider $gameDataProvider)
    {
    }

    /**
     * @param array $attackerStacks [{factionId, unitId, quantity, slotIndex}]
     * @param array $defenderStacks [{factionId, unitId, quantity, slotIndex}]
     */
    public function resolveCombat(
        array $attackerStacks,
        array $defenderStacks,
        ?Hero $attackerHero = null,
        ?Hero $defenderHero = null,
    ): CombatResult {
        $combatants = [];

        foreach ($attackerStacks as $stack) {
            $unitData = $this->gameDataProvider->getUnit($stack['factionId'], $stack['unitId']);
            if (!$unitData) {
                continue;
            }
            $combatants[] = [
                'unitId' => $stack['unitId'],
                'factionId' => $stack['factionId'],
                'quantity' => $stack['quantity'],
                'startingQuantity' => $stack['quantity'],
                'totalHp' => $stack['quantity'] * $unitData['health'],
                'topStackHp' => $unitData['health'],
                'unitData' => $unitData,
                'side' => 'attacker',
                'shotsRemaining' => $unitData['shots'] ?? 0,
                'retaliatedThisRound' => false,
                'slotIndex' => $stack['slotIndex'] ?? 0,
            ];
        }

        foreach ($defenderStacks as $stack) {
            $unitData = $this->gameDataProvider->getUnit($stack['factionId'], $stack['unitId']);
            if (!$unitData) {
                continue;
            }
            $combatants[] = [
                'unitId' => $stack['unitId'],
                'factionId' => $stack['factionId'],
                'quantity' => $stack['quantity'],
                'startingQuantity' => $stack['quantity'],
                'totalHp' => $stack['quantity'] * $unitData['health'],
                'topStackHp' => $unitData['health'],
                'unitData' => $unitData,
                'side' => 'defender',
                'shotsRemaining' => $unitData['shots'] ?? 0,
                'retaliatedThisRound' => false,
                'slotIndex' => $stack['slotIndex'] ?? 0,
            ];
        }

        $rounds = [];
        $maxRounds = 50;

        for ($round = 1; $round <= $maxRounds; $round++) {
            // Reset retaliation flags
            foreach ($combatants as &$c) {
                $c['retaliatedThisRound'] = false;
            }
            unset($c);

            // Sort by speed desc, attacker first on ties
            usort($combatants, function ($a, $b) {
                if ($b['unitData']['speed'] !== $a['unitData']['speed']) {
                    return $b['unitData']['speed'] - $a['unitData']['speed'];
                }
                return $a['side'] === 'attacker' ? -1 : 1;
            });

            $roundActions = [];

            foreach ($combatants as $idx => &$attacker) {
                if ($attacker['quantity'] <= 0) {
                    continue;
                }

                // Find target: first living enemy
                $targetIdx = $this->findTarget($combatants, $attacker['side']);
                if ($targetIdx === null) {
                    break;
                }

                $isRanged = $attacker['shotsRemaining'] > 0 && in_array('ranged', $attacker['unitData']['abilities'] ?? []);

                // Calculate damage
                $damage = $this->calculateDamage(
                    $attacker,
                    $combatants[$targetIdx],
                    $isRanged,
                    $attacker['side'] === 'attacker' ? $attackerHero : $defenderHero,
                    $attacker['side'] === 'attacker' ? $defenderHero : $attackerHero,
                );

                $killed = $this->applyDamage($combatants[$targetIdx], $damage);

                if ($isRanged) {
                    $attacker['shotsRemaining']--;
                }

                $roundActions[] = [
                    'attacker' => $attacker['unitId'],
                    'defender' => $combatants[$targetIdx]['unitId'],
                    'damage' => $damage,
                    'killed' => $killed,
                    'isRetaliation' => false,
                ];

                // Life drain: heal attacker based on damage dealt
                if (in_array('life_drain', $attacker['unitData']['abilities'] ?? []) && $damage > 0 && $attacker['quantity'] > 0) {
                    $hp = $attacker['unitData']['health'];
                    $maxHp = $attacker['quantity'] * $hp;
                    $currentHp = ($attacker['quantity'] - 1) * $hp + $attacker['topStackHp'];
                    $healedHp = min($damage, $maxHp - $currentHp + ($attacker['startingQuantity'] - $attacker['quantity']) * $hp);
                    if ($healedHp > 0) {
                        $restoredUnits = (int) floor(($attacker['topStackHp'] + $healedHp - 1) / $hp);
                        $attacker['quantity'] = min($attacker['startingQuantity'], $attacker['quantity'] + $restoredUnits);
                        $attacker['topStackHp'] = $hp - (($attacker['quantity'] * $hp - ($currentHp + $healedHp)) % $hp);
                        if ($attacker['topStackHp'] > $hp) {
                            $attacker['topStackHp'] = $hp;
                        }
                        $attacker['totalHp'] = ($attacker['quantity'] - 1) * $hp + $attacker['topStackHp'];
                    }
                }

                // Retaliation (only in melee, defender alive, and attacker doesn't have no_retaliation)
                $attackerAbilities = $attacker['unitData']['abilities'] ?? [];
                if (!$isRanged && !in_array('no_retaliation', $attackerAbilities) && $combatants[$targetIdx]['quantity'] > 0) {
                    $maxRetaliations = in_array('retaliate_twice', $combatants[$targetIdx]['unitData']['abilities'] ?? []) ? 2 : 1;
                    $retaliationCount = $combatants[$targetIdx]['retaliatedThisRound'] ? 1 : 0;

                    if ($retaliationCount < $maxRetaliations) {
                        $retDamage = $this->calculateDamage(
                            $combatants[$targetIdx],
                            $attacker,
                            false,
                            $combatants[$targetIdx]['side'] === 'attacker' ? $attackerHero : $defenderHero,
                            $combatants[$targetIdx]['side'] === 'attacker' ? $defenderHero : $attackerHero,
                        );
                        $retKilled = $this->applyDamage($attacker, $retDamage);

                        $combatants[$targetIdx]['retaliatedThisRound'] = true;

                        $roundActions[] = [
                            'attacker' => $combatants[$targetIdx]['unitId'],
                            'defender' => $attacker['unitId'],
                            'damage' => $retDamage,
                            'killed' => $retKilled,
                            'isRetaliation' => true,
                        ];
                    }
                }
            }
            unset($attacker);

            $rounds[] = [
                'roundNumber' => $round,
                'actions' => $roundActions,
            ];

            // Check if one side is eliminated
            $attackersAlive = $this->sideAlive($combatants, 'attacker');
            $defendersAlive = $this->sideAlive($combatants, 'defender');

            if (!$attackersAlive || !$defendersAlive) {
                break;
            }
        }

        $attackersAlive = $this->sideAlive($combatants, 'attacker');
        $defendersAlive = $this->sideAlive($combatants, 'defender');

        if ($attackersAlive && !$defendersAlive) {
            $winner = 'attacker';
        } elseif (!$attackersAlive && $defendersAlive) {
            $winner = 'defender';
        } else {
            $winner = 'defender'; // draw goes to defender
        }

        $attackerLosses = [];
        $defenderLosses = [];

        foreach ($combatants as $c) {
            $lost = $c['startingQuantity'] - max(0, $c['quantity']);
            $entry = [
                'unitId' => $c['unitId'],
                'slotIndex' => $c['slotIndex'],
                'lost' => $lost,
                'remaining' => max(0, $c['quantity']),
            ];
            if ($c['side'] === 'attacker') {
                $attackerLosses[] = $entry;
            } else {
                $defenderLosses[] = $entry;
            }
        }

        // XP: sum of killed defender units * fightValue
        $xp = 0;
        if ($winner === 'attacker') {
            foreach ($combatants as $c) {
                if ($c['side'] === 'defender') {
                    $killed = $c['startingQuantity'] - max(0, $c['quantity']);
                    $fightValue = $c['unitData']['fightValue'] ?? ($c['unitData']['tier'] * $c['unitData']['health'] * 5);
                    $xp += $killed * $fightValue;
                }
            }
        }

        return new CombatResult(
            winner: $winner,
            attackerWon: $winner === 'attacker',
            attackerLosses: $attackerLosses,
            defenderLosses: $defenderLosses,
            experienceGained: $xp,
            rounds: $rounds,
        );
    }

    private function findTarget(array &$combatants, string $side): ?int
    {
        $enemySide = $side === 'attacker' ? 'defender' : 'attacker';
        foreach ($combatants as $idx => $c) {
            if ($c['side'] === $enemySide && $c['quantity'] > 0) {
                return $idx;
            }
        }
        return null;
    }

    private function calculateDamage(
        array &$attacker,
        array &$defender,
        bool $isRanged,
        ?Hero $attackerHero,
        ?Hero $defenderHero,
    ): int {
        $unitData = $attacker['unitData'];
        $baseDmg = random_int($unitData['minDamage'], $unitData['maxDamage']) * $attacker['quantity'];

        // If ranged unit has no shots left, half damage (melee fallback)
        if (in_array('ranged', $unitData['abilities'] ?? []) && $attacker['shotsRemaining'] <= 0 && !$isRanged) {
            $baseDmg = (int) ceil($baseDmg / 2);
        }

        $attackSkill = $unitData['attack'] + ($attackerHero ? $attackerHero->getAttack() : 0);
        $defenseSkill = $defender['unitData']['defense'] + ($defenderHero ? $defenderHero->getDefense() : 0);
        $diff = $attackSkill - $defenseSkill;

        if ($diff > 0) {
            $modifier = 1.0 + ($diff * 0.05);
            $modifier = min($modifier, 3.0);
        } elseif ($diff < 0) {
            $modifier = 1.0 + ($diff * 0.025);
            $modifier = max($modifier, 0.3);
        } else {
            $modifier = 1.0;
        }

        $damage = (int) round($baseDmg * $modifier);
        return max(1, $damage);
    }

    private function applyDamage(array &$target, int $damage): int
    {
        $startQuantity = $target['quantity'];
        $hp = $target['unitData']['health'];

        // Eat into top stack hp first
        if ($damage <= $target['topStackHp']) {
            $target['topStackHp'] -= $damage;
            if ($target['topStackHp'] <= 0) {
                $target['quantity']--;
                $target['topStackHp'] = $hp;
            }
        } else {
            $damage -= $target['topStackHp'];
            $target['quantity']--;
            $killed = (int) floor($damage / $hp);
            $target['quantity'] -= $killed;
            $remainder = $damage % $hp;
            if ($target['quantity'] > 0) {
                $target['topStackHp'] = $hp - $remainder;
                if ($target['topStackHp'] <= 0) {
                    $target['quantity']--;
                    $target['topStackHp'] = $hp;
                }
            }
        }

        $target['quantity'] = max(0, $target['quantity']);
        $target['totalHp'] = ($target['quantity'] > 0)
            ? ($target['quantity'] - 1) * $hp + $target['topStackHp']
            : 0;

        return $startQuantity - $target['quantity'];
    }

    private function sideAlive(array &$combatants, string $side): bool
    {
        foreach ($combatants as $c) {
            if ($c['side'] === $side && $c['quantity'] > 0) {
                return true;
            }
        }
        return false;
    }
}
