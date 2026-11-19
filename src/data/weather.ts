import type { MissionDef } from './types';

/** Weather favors the Dark Tower. Multipliers apply to effective squad power. */
export const WEATHER: Record<MissionDef['weather'], { icon: string; label: string; powerMultiplier: number; description: string }> = {
    clear: { icon: '☀️', label: 'Clear skies', powerMultiplier: 1, description: 'Sunlight leaves defenders alert. Your tools and tactics operate at normal efficiency; squad power is unchanged.' },
    rain: { icon: '🌧️', label: 'Heavy rain', powerMultiplier: 1.1, description: 'Rain masks your approach and dampens enemy vigilance. Your raiding tools and tactics are more effective: +10% squad power.' },
    fog: { icon: '🌫️', label: 'Fog', powerMultiplier: 1.05, description: 'Fog conceals your forces from enemy lookouts. Ambushes become more effective: +5% squad power.' },
    storm: { icon: '⛈️', label: 'Storm', powerMultiplier: 1.15, description: 'Thunder covers your advance while frightened defenders seek shelter. The forces of evil thrive: +15% squad power.' },
};
