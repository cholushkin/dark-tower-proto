import type { GameState } from '../model/GameState';
import type { Minion } from '../model/types';
import type { MinionStatusDisplay } from './components/MinionComponent/MinionComponent.types';

/** Shared status presentation for every live minion card. */
export function minionStatus(state: GameState, minion: Minion): MinionStatusDisplay {
  const labels = {
    idle: { label: 'Idle', icon: '🧍' },
    raid: { label: 'On Raid', icon: '⚔️' },
    training: { label: 'Training', icon: '🏋️' },
    resting: { label: 'Resting', icon: '💤' },
    treatment: { label: 'Healing', icon: '❤️‍🩹' },
  };
  let display = labels[minion.activity.type];
  let process = state.processes.find(p => p.id === minion.activity.processId);
  if (!process && minion.activity.type === 'raid') {
    process = state.processes.find(p => p.type === 'walkback' && p.missionId === minion.activity.missionId);
    if (process) display = { label: 'Returning', icon: '🚶' };
  }
  const progress = process ? Math.max(0, Math.min(1, (state.hours - process.startHour) / Math.max(Number.EPSILON, process.endHour - process.startHour))) : undefined;
  const remaining = process ? Math.max(0, process.endHour - state.hours).toFixed(1) : undefined;
  return { id: minion.activity.type, ...display, progress,
    tooltip: process ? `${display.label} · ${Math.round(progress! * 100)}% · ${remaining}h remaining` : display.label };
}
