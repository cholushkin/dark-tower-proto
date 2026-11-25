import type { MissionDef } from './types';

export const WEATHER: Record<MissionDef['weather'], { icon: string; label: string; description: string }> = {
    clear: { icon: '☀️', label: 'Clear skies', description: 'Clear skies over the village.' },
    rain: { icon: '🌧️', label: 'Heavy rain', description: 'Rain sweeps through the village.' },
    fog: { icon: '🌫️', label: 'Fog', description: 'Fog hangs over the village.' },
    storm: { icon: '⛈️', label: 'Storm', description: 'Thunder rolls above the village.' },
};
