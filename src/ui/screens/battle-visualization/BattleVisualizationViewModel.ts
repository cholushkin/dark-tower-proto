import type { BattleReplayRound } from '../../../model/types';
import type { MinionPortrait } from '../../components/MinionComponent/MinionComponent.types';

export interface BattleVisualizationUnit {
  readonly id: string;
  readonly portrait: MinionPortrait;
  readonly rankLabel: string;
  readonly initialHealth: number;
}

export interface BattleVisualizationViewModel {
  readonly backgroundUrl: string;
  readonly attackers: readonly BattleVisualizationUnit[];
  readonly defenders: readonly BattleVisualizationUnit[];
  readonly rounds: readonly BattleReplayRound[];
}
