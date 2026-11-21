import { CONFIG } from '../../../data/config';
import type { GameEngine } from '../../../engine/GameEngine';
import type { GameState } from '../../../model/GameState';
import { canTrain, transitionFor } from '../../../systems/trainingHall';
import type { AssignmentCandidateViewModel } from '../../components/AssignmentPicker/AssignmentPicker.types';
import type { TrainingOccupantViewModel, TrainingStationViewModel } from '../../components/TrainingStation/TrainingStation.types';
import { asset } from '../assets';
import { buildUpgradeLineViewModel, fmtHours, groupUpgradeFamilies, roomUpgradeDefs } from '../shared';
import { nameFor, portraitFor } from '../../minionIdentity';
import type { TrainingHallAction, TrainingHallViewModel } from './TrainingHallViewModel';

const roomImage = asset('rooms/training-hall.webp');
const STATION_IMAGES = ['station-1', 'station-2', 'station-3', 'station-4'].map(name => asset(`${name}.webp`));

export interface TrainingHallUiState {
  assignmentStationId: string | null;
}
export function createTrainingHallUiState(): TrainingHallUiState {
  return { assignmentStationId: null };
}

function candidateDisabledReason(state: GameState, minionId: string): string | undefined {
  const minion = state.findMinion(minionId)!;
  if (minion.activity.type !== 'idle') return 'Currently busy';
  if (minion.injured) return 'Injured';
  if (minion.tired) return 'Tired';
  const transition = transitionFor(minion.rank);
  if (!transition) return 'Max rank reached';
  if (!state.isTrainingTransitionUnlocked(minion.rank)) return 'Unlock this transition first';
  if (state.gold < transition.costGold) return `Need ${transition.costGold}g`;
  return undefined;
}

export function buildTrainingHallViewModel(engine: GameEngine, ui: TrainingHallUiState): TrainingHallViewModel {
  const state = engine.state;
  const upgrades = groupUpgradeFamilies(roomUpgradeDefs('trainingHall')).map(family => {
    const fromRank = family[0].effect.type === 'trainingUnlock' ? family[0].effect.fromRank : 0;
    return buildUpgradeLineViewModel(state, family, '🏋️', `Unlock Rank ${fromRank}→${fromRank + 1}`);
  });

  const trainingProcesses = state.processes.filter(p => p.type === 'training');
  const total = state.trainingStationCount();
  const stations: TrainingStationViewModel[] = Array.from({ length: total }, (_, index) => {
    const process = trainingProcesses[index];
    const artworkSrc = STATION_IMAGES[index % STATION_IMAGES.length];
    if (!process || process.type !== 'training') {
      const hasEligibleMinion = state.minions.some(m => canTrain(state, m.id));
      return {
        id: `station-${index}`,
        label: `Station ${index + 1}`,
        artworkSrc,
        artworkAlt: `Training station ${index + 1}`,
        canAssign: hasEligibleMinion,
        disabledReason: hasEligibleMinion ? undefined : 'No minion is eligible for training right now',
      };
    }
    const minion = state.findMinion(process.minionId);
    if (!minion) return { id: `station-${index}`, label: `Station ${index + 1}`, artworkSrc, artworkAlt: `Training station ${index + 1}`, canAssign: false, disabledReason: 'Occupied' };
    const name = nameFor(minion.id);
    const fromRankDef = CONFIG.ranks[process.fromRank - 1];
    const toRankDef = CONFIG.ranks[process.toRank - 1];
    const occupant: TrainingOccupantViewModel = {
      minionId: minion.id,
      name,
      portrait: portraitFor(minion.id),
      rank: process.fromRank,
      nextRank: process.toRank,
      rankLabel: fromRankDef.name,
      nextRankLabel: toRankDef.name,
      timeRemainingLabel: fmtHours(Math.max(0, process.endHour - state.hours)),
      timeRemainingTooltip: `${name} is training`,
      progress: Math.min(1, Math.max(0, (state.hours - process.startHour) / (process.endHour - process.startHour))),
    };
    return { id: `station-${index}`, label: `Station ${index + 1}`, artworkSrc, artworkAlt: `Training station ${index + 1}`, canAssign: false, occupant };
  });

  const occupied = stations.filter(s => s.occupant).length;
  let assignmentPicker: TrainingHallViewModel['assignmentPicker'];
  if (ui.assignmentStationId) {
    const candidates: AssignmentCandidateViewModel[] = state.minions.map(m => {
      const name = nameFor(m.id);
      const transition = transitionFor(m.rank);
      const rankDef = CONFIG.ranks[m.rank - 1];
      const nextRankDef = transition ? CONFIG.ranks[transition.toRank - 1] : undefined;
      const disabledReason = candidateDisabledReason(state, m.id);
      return {
        id: m.id,
        name,
        portrait: portraitFor(m.id),
        detail: nextRankDef ? `${rankDef.name} → ${nextRankDef.name}` : rankDef.name,
        costLabel: transition ? `${transition.costGold}g` : '—',
        durationLabel: transition ? fmtHours(transition.durationHours) : '—',
        selectable: !disabledReason,
        disabledReason,
      };
    });
    assignmentPicker = {
      title: 'Assign a minion',
      subtitle: 'Pick who trains at this station',
      candidates,
      emptyLabel: candidates.length === 0 ? 'No minions in the roster.' : undefined,
    };
  }

  return {
    room: {
      id: 'trainingHall',
      title: 'Training Hall',
      imageSrc: roomImage,
      imageAlt: 'The Training Hall room',
      stats: [
        { id: 'stations', icon: '🏋️', label: 'Stations occupied', value: `${occupied} / ${total}` },
      ],
    },
    upgrades,
    stations,
    stationsCaption: 'Training stations',
    countCaption: `${occupied} / ${total}`,
    emptyMessage: 'No training stations built yet.',
    assignmentPicker,
    assignmentStationId: ui.assignmentStationId ?? undefined,
  };
}

export function handleTrainingHallAction(engine: GameEngine, ui: TrainingHallUiState, action: TrainingHallAction): void {
  switch (action.type) {
    case 'upgradeRequested': {
      const family = groupUpgradeFamilies(roomUpgradeDefs('trainingHall')).find(f => f.some(d => d.id.replace(/_\d+$/, '') === action.upgradeId));
      const ownedCount = family?.filter(d => engine.state.purchasedUpgrades.has(d.id)).length ?? 0;
      const next = family?.[ownedCount];
      if (next) engine.buyUpgrade(next.id);
      return;
    }
    case 'stationSelected':
      ui.assignmentStationId = action.stationId;
      return;
    case 'assignRequested':
      if (engine.startTraining(action.minionId)) ui.assignmentStationId = null;
      return;
    case 'assignmentCancelled':
      ui.assignmentStationId = null;
      return;
  }
}
