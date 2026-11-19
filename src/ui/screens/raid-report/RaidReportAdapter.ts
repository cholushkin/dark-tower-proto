import { CONFIG } from '../../../data/config';
import type { GameEngine } from '../../../engine/GameEngine';
import { adjustSelection, discoveredCounts, selectedSlots } from '../../../systems/raidReport';
import { missionDef, previewRaid } from '../../../systems/world';
import type { MinionComponentViewModel, MinionConditionDisplay } from '../../components/MinionComponent/MinionComponent.types';
import { fmtHours, itemIconFor, missionDifficultyIcons, missionLocationImage, missionWeather } from '../shared';
import { nameFor, portraitFor } from '../../minionIdentity';
import type { LootChoiceViewModel, RaidReportAction, RaidReportViewModel } from './RaidReportViewModel';

function itemDef(itemId: string) {
  return CONFIG.items.find(i => i.id === itemId)!;
}

/** Captured prisoners aren't admitted (don't have a Prisoner id) until the report is claimed, so
 * they're displayed with a synthetic per-draft id derived from their position + rank. */
function prisonerViewModel(rank: number, index: number): MinionComponentViewModel {
  const rankDef = CONFIG.ranks[rank - 1];
  return {
    id: `found-${index}-${rank}`,
    name: `Captured ${rankDef.name}`,
    description: `A Rank ${rank} ${rankDef.name} captured during the raid.`,
    rank: { label: `${rankDef.name} (R${rank})`, icon: rank === 5 ? '👑' : '⌃' },
    portrait: portraitFor(`found-${index}-${rank}`),
    conditions: [],
    status: { id: 'captured', label: 'Captured', icon: '⛓️' },
  };
}

export function buildRaidReportViewModel(engine: GameEngine, missionId: string): RaidReportViewModel | null {
  const state = engine.state;
  const draft = state.pendingReports.get(missionId);
  if (!draft) return null;
  const mission = missionDef(missionId);

  const counts = discoveredCounts(draft);
  const loot: LootChoiceViewModel[] = [];
  for (const [itemId, total] of Object.entries(counts)) {
    const def = itemDef(itemId);
    const selectedCount = draft.selection[itemId] ?? 0;
    const slotsBefore = Math.ceil(selectedCount / def.maxStackSize);
    const slotsAfter = Math.ceil((selectedCount + 1) / def.maxStackSize);
    const otherSlots = selectedSlots(draft) - slotsBefore;
    const canSelectOneMore = otherSlots + slotsAfter <= draft.carryLimit;
    for (let i = 0; i < total; i++) {
      const selected = i < selectedCount;
      loot.push({
        id: `${itemId}#${i}`,
        item: {
          id: `${itemId}#${i}`,
          title: def.name,
          description: `${def.name} — base value ${def.baseValueGold}g.`,
          icon: itemIconFor(itemId),
        },
        selected,
        canToggle: selected || canSelectOneMore,
        disabledReason: !selected && !canSelectOneMore ? 'Carry limit reached' : undefined,
      });
    }
  }

  const prisoners = draft.prisonersFound.map((rank, index) => prisonerViewModel(rank, index));

  const minions: MinionComponentViewModel[] = draft.squad.map(minionId => {
    const minion = state.findMinion(minionId);
    const name = nameFor(minionId);
    const rankDef = minion ? CONFIG.ranks[minion.rank - 1] : undefined;
    const injured = (draft.injuryRolls[minionId] ?? 0) > 0;
    const conditions: MinionConditionDisplay[] = [];
    if (injured) conditions.push({ id: 'injured', label: 'Injured', icon: '🩹', tone: 'injured' });
    conditions.push({ id: 'tired', label: 'Tired', icon: '🌙', tone: 'tired' });
    return {
      id: minionId,
      name,
      description: rankDef ? `${name} is a Rank ${minion!.rank} ${rankDef.name} of the Dark Tower.` : name,
      rank: rankDef ? { label: `${rankDef.name} (R${minion!.rank})`, icon: minion!.rank === 5 ? '👑' : '⌃' } : { label: '', icon: '' },
      portrait: portraitFor(minionId),
      conditions,
      status: draft.success
        ? { id: 'returned', label: 'Returned', icon: '✔️' }
        : { id: 'retreated', label: 'Retreated', icon: '🏃' },
    };
  });

  const preview = previewRaid(state, missionId, draft.squad);
  const slots = selectedSlots(draft);

  return {
    raidId: missionId,
    location: {
      id: missionId,
      title: mission.name,
      imageUrl: missionLocationImage(mission),
      description: `A Tier ${mission.tier} mission. Required power ${mission.requiredPower}.`,
      difficultyIcon: missionDifficultyIcons(mission),
      difficultyLabel: `Tier ${mission.tier}`,
      weatherIcon: missionWeather(mission).icon,
      weatherLabel: missionWeather(mission).label,
      result: draft.success ? 'victory' : 'defeat',
      resultLabel: draft.success ? 'Victory!' : 'Defeat',
      elapsedLabel: fmtHours(preview.durationHours),
      squadLabel: `${draft.squad.length} minion${draft.squad.length === 1 ? '' : 's'}`,
    },
    currencies: [
      { id: 'gold', icon: '🪙', label: 'Gold', amountLabel: `${draft.goldFound}` },
      { id: 'crystals', icon: '💎', label: 'Crystals', amountLabel: `${draft.crystalsFound}` },
    ],
    loot,
    selection: {
      selectedCountLabel: `${slots} / ${draft.carryLimit} slots`,
      capacityLabel: `Carry: ${draft.carryLimit} · Used: ${slots}`,
      hint: slots >= draft.carryLimit ? 'Carry limit reached.' : 'Select loot to bring home.',
    },
    prisoners,
    prisonerSummary: prisoners.length === 0 ? 'No prisoners captured' : `${prisoners.length} captured`,
    minions,
    claim: { label: draft.success ? 'Claim Rewards' : 'Acknowledge', canClaim: true },
    pauseLabel: 'Time is paused while viewing this report',
  };
}

export interface RaidReportNav {
  close(): void;
}

export function handleRaidReportAction(engine: GameEngine, missionId: string, action: RaidReportAction, nav: RaidReportNav): void {
  const draft = engine.state.pendingReports.get(missionId);
  switch (action.type) {
    case 'lootSelectionRequested':
      if (draft) {
        const itemId = action.lootCopyId.replace(/#\d+$/, '');
        adjustSelection(draft, itemId, action.selected ? 1 : -1);
      }
      return;
    case 'claimRequested':
      engine.claimReport(missionId);
      nav.close();
      return;
    case 'closeRequested':
      nav.close();
      return;
    case 'locationInfoRequested':
    case 'characterInfoRequested':
      return; // Informational only; no detail popover in this prototype.
  }
}
