import type { GameEngine } from '../../../engine/GameEngine';
import { asset } from '../assets';
import { buildUpgradeLineViewModel, groupUpgradeFamilies, roomUpgradeDefs } from '../shared';
import type { LaboratoryAction, LaboratoryViewModel } from './LaboratoryViewModel';

const ICONS: Record<string, string> = {
  lab_tier: 'icon-tier2.png',
  res_improved_weapons: 'icon-training.png',
  res_improved_armor: 'icon-medical.png',
  res_fury_spell: 'icon-alchemy.png',
};

export function buildLaboratoryViewModel(engine: GameEngine): LaboratoryViewModel {
  const state = engine.state;
  const definitions = roomUpgradeDefs('laboratory');
  return {
    room: {
      id: 'laboratory', title: 'Laboratory', imageSrc: asset('rooms/laboratory.webp'), imageAlt: 'Laboratory room illustration',
      stats: [
        { id: 'tier', icon: '⚗️', label: 'Laboratory tier', value: `Tier ${state.laboratoryTierUnlocked()}` },
        { id: 'active', icon: '⏳', label: 'Active upgrades', value: String(state.processes.filter(process => process.type === 'upgrade' && definitions.some(def => def.id === process.upgradeId)).length) },
      ],
    },
    upgrades: groupUpgradeFamilies(definitions).map(family => ({
      ...buildUpgradeLineViewModel(state, family, '', family[0].effect.type === 'laboratoryTier' ? 'Laboratory Tier Unlock' : family[0].name),
      iconSrc: asset(ICONS[family[0].id.replace(/_\d+$/, '')] ?? 'icon-loot.png'),
    })),
  };
}

export function handleLaboratoryAction(engine: GameEngine, action: LaboratoryAction): void {
  const family = groupUpgradeFamilies(roomUpgradeDefs('laboratory')).find(defs => defs[0].id.replace(/_\d+$/, '') === action.upgradeId);
  const next = family?.find(def => !engine.state.purchasedUpgrades.has(def.id));
  if (next) engine.buyUpgrade(next.id);
}
