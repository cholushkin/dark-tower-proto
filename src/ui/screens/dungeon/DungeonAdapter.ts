import type { GameEngine } from '../../../engine/GameEngine';
import type { PrisonCellViewModel, PrisonerViewModel } from '../../components/PrisonCell/PrisonCell.types';
import { asset } from '../assets';
import { buildUpgradeLineViewModel, fmtHours, groupUpgradeFamilies, roomUpgradeDefs } from '../shared';
import { nameFor } from '../../minionIdentity';
import type { DungeonAction, DungeonViewModel } from './DungeonViewModel';

const roomImage = asset('rooms/dungeon.webp');
const emptyCellImage = asset('empty-cell.webp');
const PRISONER_PORTRAITS = ['grub-prisoner', 'mork-prisoner', 'skrit-prisoner', 'brakka-prisoner'].map(name => asset(`${name}.webp`));

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
function prisonerPortrait(id: string): PrisonerViewModel['portrait'] {
  const index = Math.abs(hashCode(id)) % PRISONER_PORTRAITS.length;
  return { kind: 'texture', src: PRISONER_PORTRAITS[index], alt: `Portrait of ${nameFor(id)}`, fallbackEmoji: '🔗' };
}

export function buildDungeonViewModel(engine: GameEngine): DungeonViewModel {
  const state = engine.state;
  const upgrades = groupUpgradeFamilies(roomUpgradeDefs('dungeon')).map(family => {
    const icon = family[0].effect.type === 'dungeonCell' ? '⛓️' : family[0].effect.type === 'tortureEfficiency' ? '⏱️' : '🔍';
    const title = family[0].effect.type === 'dungeonCell' ? 'Extra Cells' : family[0].effect.type === 'tortureEfficiency' ? 'Torture Efficiency' : 'Recruitment Efficiency';
    return buildUpgradeLineViewModel(state, family, icon, title);
  });

  const total = state.dungeonCellCount();
  const assigned = state.prisoners.filter(p => p.processId !== null);
  const cells: PrisonCellViewModel[] = Array.from({ length: total }, (_, index) => {
    const prisoner = assigned[index];
    if (!prisoner || prisoner.processId === null) return { id: `cell-${index}`, label: `Cell ${index + 1}`, emptyArtSrc: emptyCellImage };
    const process = state.processes.find(p => p.id === prisoner.processId);
    if (!process || process.type !== 'dungeon') return { id: `cell-${index}`, label: `Cell ${index + 1}`, emptyArtSrc: emptyCellImage };
    const name = nameFor(prisoner.id);
    return {
      id: `cell-${index}`,
      label: `Cell ${index + 1}`,
      emptyArtSrc: emptyCellImage,
      prisoner: {
        id: prisoner.id,
        name,
        portrait: prisonerPortrait(prisoner.id),
        processLabel: 'Interrogating…',
        remainingLabel: fmtHours(Math.max(0, process.endHour - state.hours)),
        remainingTooltip: `${name} is being interrogated`,
        progress: Math.min(1, Math.max(0, (state.hours - process.startHour) / (process.endHour - process.startHour))),
      },
    };
  });

  const occupied = cells.filter(c => c.prisoner).length;
  return {
    room: {
      id: 'dungeon',
      title: 'Dungeon',
      imageSrc: roomImage,
      imageAlt: 'The Dungeon room',
      stats: [
        { id: 'cells', icon: '⛓️', label: 'Cells occupied', value: `${occupied} / ${total}` },
        { id: 'torture-speed', icon: '⏱️', label: 'Processing speed', value: `${Math.round((1 / state.tortureEfficiencyMultiplier()) * 100)}%`, emphasized: true },
      ],
    },
    upgrades,
    cells,
    cellsCaption: 'Prisoners',
    countCaption: `${occupied} / ${total}`,
    emptyMessage: 'No prisoners currently held. Raid the world map to capture some.',
  };
}

export function handleDungeonAction(engine: GameEngine, action: DungeonAction): void {
  switch (action.type) {
    case 'upgradeRequested': {
      const family = groupUpgradeFamilies(roomUpgradeDefs('dungeon')).find(f => f.some(d => d.id.replace(/_\d+$/, '') === action.upgradeId));
      const ownedCount = family?.filter(d => engine.state.purchasedUpgrades.has(d.id)).length ?? 0;
      const next = family?.[ownedCount];
      if (next) engine.buyUpgrade(next.id);
      return;
    }
  }
}
