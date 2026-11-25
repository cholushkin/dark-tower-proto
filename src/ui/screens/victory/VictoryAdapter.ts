import type { GameEngine } from '../../../engine/GameEngine';
import { asset } from '../assets';
import type { VictoryAction, VictoryViewModel } from './VictoryViewModel';

const illustration = asset('victory-tower.webp');

export function hasWonGame(engine: GameEngine): boolean {
  return engine.state.hasCompletedWorld();
}

export function buildVictoryViewModel(engine: GameEngine): VictoryViewModel {
  const state = engine.state;
  return {
    title: 'Victory!',
    message: 'Every village has fallen before the Dark Tower. The world is conquered.',
    illustrationSrc: illustration,
    stats: [
      { id: 'completion-time', icon: '⌛', label: 'World completion time', value: `${((state.worldCompletedAtHour ?? state.hours) / 24).toFixed(1)} days` },
      { id: 'week', icon: '📅', label: 'Weeks played', value: `${state.week + 1}` },
      { id: 'tower', icon: '🏰', label: 'Tower level', value: `${state.towerLevel()}` },
      { id: 'gold', icon: '🪙', label: 'Gold banked', value: `${state.gold}` },
    ],
    canEnterNextWorld: false,
    nextWorldDisabledReason: 'Coming soon',
    canContinue: true,
  };
}

export interface VictoryNav {
  dismiss(): void;
}

export function handleVictoryAction(action: VictoryAction, nav: VictoryNav): void {
  switch (action.type) {
    case 'continueRequested':
      nav.dismiss();
      return;
    case 'nextWorldRequested':
      return; // Not available in this prototype.
  }
}
