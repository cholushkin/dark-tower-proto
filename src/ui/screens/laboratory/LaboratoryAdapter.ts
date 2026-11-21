import { CONFIG } from '../../../data/config';
import type { GameEngine } from '../../../engine/GameEngine';
import { asset } from '../assets';
import { buildUpgradeLineViewModel, fmtHours, groupUpgradeFamilies, roomUpgradeDefs } from '../shared';
import type { LaboratoryAction, LaboratoryResearchViewModel, LaboratoryViewModel } from './LaboratoryViewModel';

const roomImage = asset('rooms/laboratory.webp');
const ICON_TIER = asset('icon-tier2.png');
// Note: icon-efficiency.png and icon-potion.png have "Research" text baked into the source PNG
// (a ViewModelsProto mock asset defect) — avoided here in favor of clean icons.
const ICON_EFFICIENCY = asset('icon-recon.png');
const RESEARCH_ICONS: Record<string, string> = {
  res_improved_weapons: asset('icon-training.png'),
  res_improved_armor: asset('icon-medical.png'),
  res_fury_spell: asset('icon-alchemy.png'),
};
const DEFAULT_RESEARCH_ICON = asset('icon-loot.png');

export function buildLaboratoryViewModel(engine: GameEngine): LaboratoryViewModel {
  const state = engine.state;

  const upgrades = groupUpgradeFamilies(roomUpgradeDefs('laboratory')).map(family => {
    const isTierFamily = family[0].effect.type === 'researchTier';
    return {
      ...buildUpgradeLineViewModel(state, family, '', isTierFamily ? 'Research Tier Unlock' : 'Research Efficiency'),
      iconSrc: isTierFamily ? ICON_TIER : ICON_EFFICIENCY,
    };
  });

  const research: LaboratoryResearchViewModel[] = CONFIG.research.map(def => {
    const completed = state.completedResearch.has(def.id);
    const tierLocked = def.tier > state.researchTierUnlocked();
    const missingPrereq = !def.requires.every(id => state.completedResearch.has(id));
    const locked = !completed && (tierLocked || missingPrereq);
    const busy = state.activeResearchId !== null;
    const isActive = state.activeResearchId === def.id;
    const actionEnabled = !completed && !locked && !busy && state.gold >= def.costGold;

    let hint: string | undefined;
    if (locked) hint = tierLocked ? `Requires Tier ${def.tier} unlock` : 'Requires prior research';
    else if (completed) hint = 'Already researched';
    else if (isActive) hint = undefined;
    else if (busy) hint = 'Another project is active';
    else if (state.gold < def.costGold) hint = `Need ${def.costGold}g`;

    return {
      id: def.id,
      title: def.name,
      description: def.description,
      icon: RESEARCH_ICONS[def.id] ?? DEFAULT_RESEARCH_ICON,
      durationText: fmtHours(def.durationHours * state.researchEfficiencyMultiplier()),
      costText: `${def.costGold}g`,
      actionLabel: completed ? 'Researched' : isActive ? 'Researching…' : 'Research',
      actionEnabled,
      hint,
      status: completed ? 'completed' : locked ? 'locked' : 'ready',
    };
  });

  let activeProject: LaboratoryViewModel['activeProject'] = null;
  if (state.activeResearchId) {
    const def = CONFIG.research.find(r => r.id === state.activeResearchId);
    const process = state.processes.find(p => p.type === 'research' && p.researchId === state.activeResearchId);
    if (def && process) {
      activeProject = {
        id: def.id,
        title: def.name,
        description: def.description,
        icon: RESEARCH_ICONS[def.id] ?? DEFAULT_RESEARCH_ICON,
        progress: Math.min(1, Math.max(0, (state.hours - process.startHour) / (process.endHour - process.startHour))),
        remainingText: fmtHours(Math.max(0, process.endHour - state.hours)),
        statusText: 'Researching…',
      };
    }
  }

  return {
    image: roomImage,
    stats: [
      { icon: 'flask', label: 'Research tier', value: `Tier ${state.researchTierUnlocked()}` },
      { icon: 'clock', label: 'Research speed', value: `${Math.round((1 / state.researchEfficiencyMultiplier()) * 100)}%` },
    ],
    upgrades,
    activeProject,
    research,
  };
}

export function handleLaboratoryAction(engine: GameEngine, action: LaboratoryAction): void {
  switch (action.type) {
    case 'upgradeRequested': {
      const family = groupUpgradeFamilies(roomUpgradeDefs('laboratory')).find(f => f.some(d => d.id.replace(/_\d+$/, '') === action.upgradeId));
      const ownedCount = family?.filter(d => engine.state.purchasedUpgrades.has(d.id)).length ?? 0;
      const next = family?.[ownedCount];
      if (next) engine.buyUpgrade(next.id);
      return;
    }
    case 'startResearchRequested':
      engine.startResearch(action.researchId);
      return;
  }
}
