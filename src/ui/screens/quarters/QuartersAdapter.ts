import { minionStatus } from '../../minionStatus';
import { CONFIG } from '../../../data/config';
import type { GameEngine } from '../../../engine/GameEngine';
import type { MinionConditionDisplay } from '../../components/MinionComponent/MinionComponent.types';
import { asset } from '../assets';
import { buildIncrementalUpgradeViewModel, fmtHours, incrementalUpgradeDefs } from '../shared';
import { nameFor, portraitFor } from '../../minionIdentity';
import type { QuartersAction, QuartersViewModel } from './QuartersViewModel';

const roomImage = asset('rooms/quarters.webp');
const bedImage = asset('bed.svg');

export function buildQuartersViewModel(engine: GameEngine): QuartersViewModel {
  const state = engine.state;
  const upgrades = incrementalUpgradeDefs('quarters').map(def => buildIncrementalUpgradeViewModel(state, def, '🛏️'));

  const total = state.bedCount();
  const restProcesses = state.processes.filter(p => p.type === 'rest');
  const beds = Array.from({ length: total }, (_, index) => {
    const process = restProcesses[index];
    if (!process || process.type !== 'rest') return { id: `bed-${index}`, label: `Bed ${index + 1}`, presentation: 'rest' as const, bedImageSrc: bedImage };
    const minion = state.findMinion(process.minionId);
    if (!minion) return { id: `bed-${index}`, label: `Bed ${index + 1}`, presentation: 'rest' as const, bedImageSrc: bedImage };
    const name = nameFor(minion.id);
    const conditionBadges: MinionConditionDisplay[] = [];
    if (minion.injured) conditionBadges.push({ id: 'injured', label: 'Injured', icon: '🩹', tone: 'injured' });
    if (minion.tired) conditionBadges.push({ id: 'tired', label: 'Tired', icon: '🌙', tone: 'tired' });
    return {
      id: `bed-${index}`,
      label: `Bed ${index + 1}`,
      presentation: 'rest' as const,
      bedImageSrc: bedImage,
      occupant: {
        minionId: minion.id,
        name,
        portrait: portraitFor(minion.id),
        remainingLabel: fmtHours(Math.max(0, process.endHour - state.hours)),
        remainingTooltip: `${name} is resting`,
        restProgress: Math.min(1, Math.max(0, (state.hours - process.startHour) / (process.endHour - process.startHour))),
        conditionBadges,
      },
    };
  });

  const minions = state.minions.map(m => {
    const name = nameFor(m.id);
    const rankDef = CONFIG.ranks[m.rank - 1];
    const conditions: MinionConditionDisplay[] = [];
    if (m.injured) conditions.push({ id: 'injured', label: 'Injured', icon: '🩹', tone: 'injured' });
    if (m.tired) conditions.push({ id: 'tired', label: 'Tired', icon: '🌙', tone: 'tired' });
    return {
      id: m.id,
      name,
      description: `${name} is a Rank ${m.rank} ${rankDef.name} of the Dark Tower.`,
      rank: { label: `${rankDef.name} (R${m.rank})`, icon: m.rank === 5 ? '👑' : '⌃', tooltip: `Rank ${m.rank}: ${rankDef.name}` },
      portrait: portraitFor(m.id),
      conditions,
      status: minionStatus(state, m),
    };
  });

  const occupied = beds.filter(b => b.occupant).length;
  return {
    room: {
      id: 'quarters',
      title: 'Quarters',
      imageSrc: roomImage,
      imageAlt: 'The Quarters room',
      stats: [
        { id: 'beds', icon: '🛏️', label: 'Beds occupied', value: `${occupied} / ${total}` },
      ],
    },
    upgrades,
    beds,
    bedsCaption: 'Resting minions',
    countCaption: `${occupied} / ${total}`,
    emptyMessage: 'No beds built yet. Build a bed to let tired minions rest.',
    minions,
    minionsCaption: `${minions.length} minion${minions.length === 1 ? '' : 's'}`,
  };
}

export function handleQuartersAction(engine: GameEngine, action: QuartersAction): void {
  switch (action.type) {
    case 'upgradeRequested':
      engine.buyIncremental(action.upgradeId);
      return;
  }
}
