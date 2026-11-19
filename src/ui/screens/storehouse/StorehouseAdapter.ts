import { CONFIG } from '../../../data/config';
import type { GameEngine } from '../../../engine/GameEngine';
import type { SaleProcess } from '../../../model/types';
import { fullStackValue, instantSaleValue } from '../../../systems/storehouse';
import type { ItemComponentViewModel } from '../../components/ItemComponent/ItemComponent.types';
import { asset } from '../assets';
import { buildUpgradeLineViewModel, fmtHours, groupUpgradeFamilies, itemIconFor, roomUpgradeDefs } from '../shared';
import type { StorehouseAction, StorehouseViewModel } from './StorehouseViewModel';

const roomImage = asset('storehouse-room.webp');

export interface StorehouseUiState {
  activeTags: Set<string>;
}

const TAG_OPTIONS: ReadonlyArray<{ id: string; title: string; icon: string }> = [
  { id: 'treasure', title: 'Treasures', icon: '💰' },
  { id: 'materials', title: 'Materials', icon: '🪨' },
  { id: 'ingridients', title: 'Ingredients', icon: '🌿' },
  { id: 'weapons', title: 'Weapons', icon: '🗡️' },
];

export function createStorehouseUiState(): StorehouseUiState {
  return { activeTags: new Set(TAG_OPTIONS.map(tag => tag.id)) };
}

function itemDef(itemId: string) {
  return CONFIG.items.find(i => i.id === itemId)!;
}

function instantSellLabel(goldValue: number): string {
  const fraction = CONFIG.constants.instantSaleFraction;
  return `Instant Sale (${fraction * 100}%) · ${instantSaleValue(goldValue)} 🪙`;
}

export function buildStorehouseViewModel(engine: GameEngine, ui: StorehouseUiState): StorehouseViewModel {
  const state = engine.state;
  const upgrades = groupUpgradeFamilies(roomUpgradeDefs('storehouse')).map(family => {
    const icon = family[0].effect.type === 'saleEfficiency' ? '⏱️' : '📦';
    const title = family[0].effect.type === 'saleEfficiency' ? 'Sale Efficiency' : 'Storage Shelves';
    return buildUpgradeLineViewModel(state, family, icon, title);
  });

  const allTagsActive = TAG_OPTIONS.every(tag => ui.activeTags.has(tag.id));
  const matchesFilters = (itemId: string) => itemDef(itemId).tags.some(tag => ui.activeTags.has(tag));
  const readyItems: ItemComponentViewModel[] = state.stacks.filter(stack => matchesFilters(stack.itemId)).map(stack => {
    const def = itemDef(stack.itemId);
    const goldValue = fullStackValue(stack.itemId, stack.count);
    return {
      id: stack.id,
      title: def.name,
      description: `${def.name} — base value ${def.baseValueGold}g each.`,
      icon: itemIconFor(stack.itemId),
      tags: def.tags,
      stack: { label: `× ${stack.count}`, tooltip: `${stack.count} of ${def.maxStackSize} in stack` },
      sale: {
        status: 'ready',
        sellLabel: `Sell · ${goldValue} 🪙`,
        canSell: true,
        instantSellLabel: instantSellLabel(goldValue),
        canInstantSell: true,
      },
    };
  });
  // Active sales hold their stacks in the process until completion or cancellation.
  const sellingItems: ItemComponentViewModel[] = state.processes
    .filter((p): p is SaleProcess => p.type === 'sale')
    .filter(p => matchesFilters(p.itemId))
    .map(selling => {
      const def = itemDef(selling.itemId);
      return {
        id: selling.stackId,
        title: def.name,
        description: `${def.name} — base value ${def.baseValueGold}g each.`,
        icon: itemIconFor(selling.itemId),
        tags: def.tags,
        stack: { label: `× ${selling.count}`, tooltip: `${selling.count} of ${def.maxStackSize} in stack` },
        sale: {
          status: 'selling',
          sellLabel: `Sell · ${selling.goldValue} 🪙`,
          progress: Math.min(1, Math.max(0, (state.hours - selling.startHour) / (selling.endHour - selling.startHour))),
          remainingLabel: fmtHours(Math.max(0, selling.endHour - state.hours)),
          instantSellLabel: instantSellLabel(selling.goldValue),
          canInstantSell: true,
        },
      };
    });
  // Inventory stacks are appended with increasing stack IDs, which sale cards retain.
  const items = [...readyItems, ...sellingItems].sort(
    (a, b) => Number(a.id.slice('stack_'.length)) - Number(b.id.slice('stack_'.length)),
  );

  return {
    room: {
      id: 'storehouse',
      title: 'Storehouse',
      imageSrc: roomImage,
      imageAlt: 'The Storehouse room',
      stats: [
        { id: 'slots', icon: '📦', label: 'Slots used', value: `${state.usedSlots()} / ${state.storageSlots()}` },
        { id: 'sale-speed', icon: '⏱️', label: 'Sale speed', value: `${Math.round((1 / state.saleEfficiencyMultiplier()) * 100)}%`, emphasized: true },
      ],
    },
    upgrades,
    filters: {
      options: [
        { id: 'all', title: 'All', icon: '📦', active: allTagsActive },
        ...TAG_OPTIONS.map(t => ({ ...t, active: ui.activeTags.has(t.id) })),
      ],
    },
    items,
    inventoryLabel: `${items.length} stack${items.length === 1 ? '' : 's'}`,
    emptyMessage: allTagsActive ? 'Nothing stored yet. Raid the world map to bring back loot.' : 'No items match the selected filters.',
  };
}

export function handleStorehouseAction(engine: GameEngine, ui: StorehouseUiState, action: StorehouseAction): void {
  switch (action.type) {
    case 'upgradeRequested': {
      const family = groupUpgradeFamilies(roomUpgradeDefs('storehouse')).find(f => f.some(d => d.id.replace(/_\d+$/, '') === action.upgradeId));
      const ownedCount = family?.filter(d => engine.state.purchasedUpgrades.has(d.id)).length ?? 0;
      const next = family?.[ownedCount];
      if (next) engine.buyUpgrade(next.id);
      return;
    }
    case 'filterToggled':
      if (action.tag === 'all') {
        for (const tag of TAG_OPTIONS) ui.activeTags.add(tag.id);
      } else if (ui.activeTags.has(action.tag)) {
        ui.activeTags.delete(action.tag);
      } else if (TAG_OPTIONS.some(tag => tag.id === action.tag)) {
        ui.activeTags.add(action.tag);
      }
      return;
    case 'sellRequested':
      engine.startNormalSale(action.itemId);
      return;
    case 'instantSellRequested':
      engine.instantSale(action.itemId);
      return;
    case 'cancelSaleRequested':
      engine.cancelNormalSale(action.itemId);
      return;
  }
}
