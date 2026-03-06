<?php

namespace App\Service;

class GameDataProvider
{
    private array $factions = [];
    private array $units = [];

    public function __construct(private string $sharedDataDir)
    {
    }

    public function getFactions(): array
    {
        if (empty($this->factions)) {
            $json = file_get_contents($this->sharedDataDir . '/factions.json');
            $data = json_decode($json, true);
            foreach ($data['factions'] as $faction) {
                $this->factions[$faction['id']] = $faction;
            }
        }
        return $this->factions;
    }

    public function getFaction(string $id): ?array
    {
        return $this->getFactions()[$id] ?? null;
    }

    public function getUnits(string $faction): array
    {
        if (!isset($this->units[$faction])) {
            $path = $this->sharedDataDir . '/units/' . $faction . '.json';
            if (!file_exists($path)) {
                return [];
            }
            $json = file_get_contents($path);
            $data = json_decode($json, true);
            $this->units[$faction] = [];
            foreach ($data['units'] as $unit) {
                $this->units[$faction][$unit['id']] = $unit;
            }
        }
        return $this->units[$faction];
    }

    public function getUnit(string $faction, string $unitId): ?array
    {
        return $this->getUnits($faction)[$unitId] ?? null;
    }
}
