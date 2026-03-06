// Resource bar types - integrated directly into AdventureMapScene for now
export interface ResourceDisplay {
    key: string;
    label: string;
    color: string;
}

export const RESOURCE_CONFIG: ResourceDisplay[] = [
    { key: 'gold', label: 'Gold', color: '#ffd700' },
    { key: 'wood', label: 'Wood', color: '#8b4513' },
    { key: 'ore', label: 'Ore', color: '#808080' },
    { key: 'mercury', label: 'Mercury', color: '#4488ff' },
    { key: 'sulfur', label: 'Sulfur', color: '#ffaa00' },
    { key: 'crystal', label: 'Crystal', color: '#ff4488' },
    { key: 'gems', label: 'Gems', color: '#44ff88' },
];
