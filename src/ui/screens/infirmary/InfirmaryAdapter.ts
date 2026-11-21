import type { GameEngine } from '../../../engine/GameEngine';
import type { MinionConditionDisplay } from '../../components/MinionComponent/MinionComponent.types';
import { asset } from '../assets';
import { buildIncrementalUpgradeViewModel, fmtHours, incrementalUpgradeDefs } from '../shared';
import { nameFor, portraitFor } from '../../minionIdentity';
import type { InfirmaryAction, InfirmaryViewModel } from './InfirmaryViewModel';

const roomImage = asset('rooms/infirmary.webp');
const bedImage = asset('infirmary-bed.svg');

export function buildInfirmaryViewModel(engine: GameEngine): InfirmaryViewModel {
  const state = engine.state;
  const upgrades = incrementalUpgradeDefs('infirmary').map(def => buildIncrementalUpgradeViewModel(state, def, '💗'));

  const total = state.treatmentBedCount();
  const treatmentProcesses = state.processes.filter(p => p.type === 'treatment');
  const beds = Array.from({ length: total }, (_, index) => {
    const process = treatmentProcesses[index];
    if (!process || process.type !== 'treatment') return { id: `bed-${index}`, label: `Bed ${index + 1}`, presentation: 'treatment' as const, bedImageSrc: bedImage };
    const minion = state.findMinion(process.minionId);
    if (!minion) return { id: `bed-${index}`, label: `Bed ${index + 1}`, presentation: 'treatment' as const, bedImageSrc: bedImage };
    const name = nameFor(minion.id);
    const conditionBadges: MinionConditionDisplay[] = [];
    if (minion.injured) conditionBadges.push({ id: 'injured', label: 'Injured', icon: '🩹', tone: 'injured' });
    if (minion.tired) conditionBadges.push({ id: 'tired', label: 'Tired', icon: '🌙', tone: 'tired' });
    return {
      id: `bed-${index}`,
      label: `Bed ${index + 1}`,
      presentation: 'treatment' as const,
      bedImageSrc: bedImage,
      occupant: {
        minionId: minion.id,
        name,
        portrait: portraitFor(minion.id),
        remainingLabel: fmtHours(Math.max(0, process.endHour - state.hours)),
        remainingTooltip: `${name} is being treated`,
        restProgress: Math.min(1, Math.max(0, (state.hours - process.startHour) / (process.endHour - process.startHour))),
        conditionBadges,
      },
    };
  });

  const occupied = beds.filter(b => b.occupant).length;
  return {
    room: {
      id: 'infirmary',
      title: 'Infirmary',
      imageSrc: roomImage,
      imageAlt: 'The Infirmary room',
      stats: [
        { id: 'beds', icon: '💗', label: 'Beds occupied', value: `${occupied} / ${total}` },
        { id: 'efficiency', icon: '⏱️', label: 'Treatment speed', value: `${Math.round((1 / state.treatmentEfficiencyMultiplier()) * 100)}%`, emphasized: true },
      ],
    },
    upgrades,
    beds,
    bedsCaption: 'Injured minions',
    countCaption: `${occupied} / ${total}`,
    emptyMessage: 'No treatment beds built yet. Build one to treat injured minions.',
  };
}

export function handleInfirmaryAction(engine: GameEngine, action: InfirmaryAction): void {
  switch (action.type) {
    case 'upgradeRequested':
      engine.buyIncremental(action.upgradeId);
      return;
  }
}
