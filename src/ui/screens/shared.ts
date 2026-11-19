import { WEATHER } from '../../data/weather';
import type { MissionDef } from '../../data/types';
import type { ItemIcon } from '../components/ItemTile/ItemTile.types';
import { CONFIG } from '../../data/config';
import type { RoomId, UpgradeDef, UpgradeEffect } from '../../data/types';
import type { GameState } from '../../model/GameState';
import { canPurchaseUpgrade, isUpgradeInProgress } from '../../systems/upgrades';
import { canPurchaseIncremental, isIncrementalInProgress, nextCost, nextDuration } from '../../systems/incrementalUpgrades';
import type { IncrementalUpgradeDef } from '../../data/types';
import type { UpgradeCardViewModel } from '../components/UpgradeCard/UpgradeCard.types';
import { asset } from './assets';

/** Adapter-side formatting helpers shared by screen adapters. Views never see raw hours/numbers. */
export function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function effectLabel(effect: UpgradeEffect): string {
  switch (effect.type) {
    case 'storageSlots': return `+${effect.amount} slots`;
    case 'saleEfficiency': return `${Math.round((1 - effect.multiplier) * 100)}% faster sales`;
    case 'bed': return '+1 bed';
    case 'treatmentBed': return '+1 treatment bed';
    case 'treatmentEfficiency': return `${Math.round((1 - effect.multiplier) * 100)}% faster treatment`;
    case 'trainingUnlock': return `Unlocks training from Rank ${effect.fromRank}`;
    case 'researchTier': return `Unlocks Tier ${effect.tier} research`;
    case 'researchEfficiency': return `${Math.round((1 - effect.multiplier) * 100)}% faster research`;
    case 'dungeonCell': return '+1 cell';
    case 'tortureEfficiency': return `${Math.round((1 - effect.multiplier) * 100)}% faster processing`;
    case 'recruitmentEfficiency': return `+${Math.round(effect.bonus * 100)}% recruit chance`;
    case 'enemyIntel': return `Enemy intel Lv.${effect.level}`;
    case 'lootIntel': return `Loot intel Lv.${effect.level}`;
    default: return '';
  }
}

/**
 * Builds one UpgradeCard ViewModel for a chain of sequential UpgradeDefs (e.g. Storage Shelves
 * I/II/III) that share a `requires` chain. UpgradeCard shows a single current→next transition,
 * so this collapses the chain into "current level" vs "next purchasable tier".
 */
export function buildUpgradeLineViewModel(
  state: GameState,
  family: readonly UpgradeDef[],
  icon: string,
  title: string,
): UpgradeCardViewModel {
  const ownedCount = family.filter(d => state.purchasedUpgrades.has(d.id)).length;
  const next = family[ownedCount] as UpgradeDef | undefined;
  const current = family[ownedCount - 1] as UpgradeDef | undefined;
  const inProgress = next ? isUpgradeInProgress(state, next.id) : false;
  const process = state.processes.find(p => p.type === 'upgrade' && p.upgradeId === next?.id);
  const canUpgrade = !!next && !inProgress && canPurchaseUpgrade(state, next.id);

  let disabledReason: string | undefined;
  let statusText: string | undefined;
  if (!next) statusText = 'Maxed';
  else if (inProgress) { disabledReason = 'Under construction'; statusText = 'Under construction'; }
  else if (state.gold < next.costGold) disabledReason = `Need ${next.costGold}g`;
  else if (!next.requires.every(id => state.purchasedUpgrades.has(id))) disabledReason = 'Requires prior tier';

  return {
    id: family[0].id.replace(/_\d+$/, ''),
    icon,
    title,
    description: (next ?? current ?? family[0]).description,
    progress: process ? Math.min(1, Math.max(0, (state.hours - process.startHour) / (process.endHour - process.startHour))) : undefined,
    remainingLabel: process ? fmtHours(Math.max(0, process.endHour - state.hours)) : undefined,
    currentLevel: current ? `Lv.${ownedCount}` : 'Lv.0',
    nextLevel: next ? `Lv.${ownedCount + 1}` : 'MAX',
    currentEffect: current ? effectLabel(current.effect) : '—',
    nextEffect: next ? effectLabel(next.effect) : effectLabel(family[family.length - 1].effect),
    buttonLabel: next ? (inProgress ? 'Upgrade' : `Upgrade · 🪙 ${next.costGold} · ⏳ ${fmtHours(next.durationHours)}`) : 'Maxed',
    canUpgrade,
    disabledReason,
    statusText: inProgress ? undefined : statusText,
  };
}

/**
 * Builds one UpgradeCard ViewModel for a repeatable incremental upgrade (e.g. "Add Bed"): no tier
 * chain, no max level — cost/duration scale with the current level forever.
 */
export function buildIncrementalUpgradeViewModel(state: GameState, def: IncrementalUpgradeDef, icon: string): UpgradeCardViewModel {
  const level = state.incrementalLevel(def.id);
  const inProgress = isIncrementalInProgress(state, def.id);
  const process = state.processes.find(p => p.type === 'incrementalUpgrade' && p.upgradeId === def.id);
  const canUpgrade = !inProgress && canPurchaseIncremental(state, def.id);
  const cost = nextCost(def.id, level);
  const duration = nextDuration(def.id, level);

  let disabledReason: string | undefined;
  let statusText: string | undefined;
  if (inProgress) { disabledReason = 'Under construction'; statusText = 'Under construction'; }
  else if (state.gold < cost) disabledReason = `Need ${cost}g`;

  return {
    id: def.id,
    icon,
    title: def.name,
    description: def.description,
    progress: process ? Math.min(1, Math.max(0, (state.hours - process.startHour) / (process.endHour - process.startHour))) : undefined,
    remainingLabel: process ? fmtHours(Math.max(0, process.endHour - state.hours)) : undefined,
    currentLevel: `Lv.${level}`,
    nextLevel: `Lv.${level + 1}`,
    currentEffect: level === 0 ? '—' : `${level} built`,
    nextEffect: `${level + 1} built`,
    buttonLabel: inProgress ? 'Upgrade' : `Upgrade · 🪙 ${cost} · ⏳ ${fmtHours(duration)}`,
    canUpgrade,
    disabledReason,
    statusText: inProgress ? undefined : statusText,
  };
}

export function incrementalUpgradeDefs(room: RoomId): IncrementalUpgradeDef[] {
  return CONFIG.incrementalUpgrades.filter(u => u.room === room);
}

/** Groups a room's fixed UpgradeDefs by family (id with the trailing _<n> tier suffix stripped). */
export function groupUpgradeFamilies(defs: readonly UpgradeDef[]): UpgradeDef[][] {
  const families = new Map<string, UpgradeDef[]>();
  for (const def of defs) {
    const family = def.id.replace(/_\d+$/, '');
    const list = families.get(family) ?? [];
    list.push(def);
    families.set(family, list);
  }
  return [...families.values()];
}

export function roomUpgradeDefs(room: RoomId): UpgradeDef[] {
  return CONFIG.upgrades.filter(u => u.room === room);
}

const ITEM_ICONS: Record<string, string> = {
  golden_cup: '🏆',
  ancient_crown: '👑',
  silver_necklace: '📿',
  enchanted_gem: '🔮',
  cow: '🐄',
  cobblestone: '🪨',
  iron_ore: '⛏️',
  wheat_sack: '🌾',
  leather_hide: '🧵',
  ruby_amulet: '💎',
  jeweled_scepter: '🔱',
  silver_chalice: '🍷',
  obsidian_shard: '⚫',
  mithril_ingot: '⚙️',
  goat: '🐐',
  honey_jar: '🍯',
  steel_sword: '🗡️',
  war_banner: '🚩',
};

export function iconForItem(itemId: string): string {
  return ITEM_ICONS[itemId] ?? '📦';
}

// Only map matching subjects; the rest retain their original emoji.
const ITEM_TEXTURES: Readonly<Record<string, string>> = {
  golden_cup: 'golden-cup',
  ancient_crown: 'crown',
  cow: 'cow',
  cobblestone: 'cobblestone',
  steel_sword: 'sword',
};

export function itemIconFor(itemId: string): ItemIcon {
  const texture = ITEM_TEXTURES[itemId];
  const fallbackEmoji = iconForItem(itemId);
  return texture
    ? { kind: 'texture', src: asset(`items/${texture}.png`), alt: CONFIG.items.find(item => item.id === itemId)?.name ?? itemId, fallbackEmoji }
    : { kind: 'emoji', value: fallbackEmoji };
}

/** Shared mission presentation. Location artwork is selected by mission index. */
export const WORLD_TIER_ICON = ['⚔️', '🛡️', '☠️'];
const MISSION_LOCATION_IMAGES = ['aqueducts', 'frost-bridge', 'grave-orchard', 'ashen-gate', 'sunken-vault', 'green-hollow', 'flame-bastion'].map(name => asset(`${name}.webp`));

export function missionLocationImage(mission: { id: string }): string {
  return MISSION_LOCATION_IMAGES[CONFIG.missions.findIndex(m => m.id === mission.id) % MISSION_LOCATION_IMAGES.length];
}
export function missionWeather(mission: Pick<MissionDef, 'weather'>) {
  return WEATHER[mission.weather];
}
export function missionDifficultyIcons(mission: { tier: number }): string {
  return WORLD_TIER_ICON[Math.min(2, mission.tier - 1)].repeat(mission.tier);
}
