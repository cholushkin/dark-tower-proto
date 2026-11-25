import type { BattleReplay } from '../../../model/types';
import { portraitFor } from '../../minionIdentity';
import { asset } from '../assets';
import type { BattleVisualizationViewModel } from './BattleVisualizationViewModel';

export function buildBattleVisualizationViewModel(replay: BattleReplay): BattleVisualizationViewModel {
  return {
    backgroundUrl: asset('battle-replay-field.webp'),
    attackers: replay.attackers.map(unit => ({
      id: unit.id,
      portrait: portraitFor(unit.id),
      rankLabel: `R${unit.rank}`,
      initialHealth: unit.health,
    })),
    defenders: replay.defenders.map(unit => ({
      id: unit.id,
      portrait: { kind: 'texture', src: asset('minions/prisoner-avatar.webp'), alt: 'Defender' },
      rankLabel: `R${unit.rank}`,
      initialHealth: unit.health,
    })),
    rounds: replay.rounds,
  };
}
