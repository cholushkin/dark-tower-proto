import type { MissionDef } from './types';

/** Weather describes the location; numerical advantage alone determines victory odds. */
export const WEATHER: Record<MissionDef['weather'], { icon: string; label: string; powerMultiplier: number; description: string }> = {
    clear: { icon: '☀️', label: 'Clear skies', powerMultiplier: 1, description: 'Clear skies over the village. Weather does not change victory odds.' },
    rain: { icon: '🌧️', label: 'Heavy rain', powerMultiplier: 1, description: 'Rain sweeps through the village. Weather does not change victory odds.' },
    fog: { icon: '🌫️', label: 'Fog', powerMultiplier: 1, description: 'Fog hangs over the village. Weather does not change victory odds.' },
    storm: { icon: '⛈️', label: 'Storm', powerMultiplier: 1, description: 'Thunder rolls above the village. Weather does not change victory odds.' },
};
