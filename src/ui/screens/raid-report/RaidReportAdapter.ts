import { asset } from '../assets';
import { CONFIG } from '../../../data/config';
import type { GameEngine } from '../../../engine/GameEngine';
import { adjustSelection, discoveredCounts, selectedSlots } from '../../../systems/raidReport';
import { missionDef, previewRaid } from '../../../systems/world';
import type { MinionComponentViewModel, MinionConditionDisplay } from '../../components/MinionComponent/MinionComponent.types';
import { fmtHours, itemIconFor, missionDifficultyIcons, missionLocationImage, missionWeather, pct } from '../shared';
import { nameFor, portraitFor } from '../../minionIdentity';
import type { LootChoiceViewModel, RaidReportAction, RaidReportViewModel, ReportPrisonerViewModel } from './RaidReportViewModel';

function itemDef(itemId: string) {
  return CONFIG.items.find(i => i.id === itemId)!;
}

/** Captured prisoners aren't admitted (don't have a Prisoner id) until the report is claimed, so
 * they're displayed with a synthetic per-draft id derived from their position + rank. */
function prisonerViewModel(rank: number, index: number): ReportPrisonerViewModel {
  const rankDef = CONFIG.ranks[rank - 1];
  return {
    id: `found-${index}-${rank}`,
    portraitSrc: asset('minions/prisoner-avatar.webp'),
    rankLabel: `R${rank}`,
    rankTooltip: `Rank ${rank}: ${rankDef.name}`,
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
    const fullSelectedStacks = Math.floor(selectedCount / def.maxStackSize);
    const selectedRemainder = selectedCount % def.maxStackSize;
    for (let offset = 0, i = 0; offset < total; offset += def.maxStackSize, i++) {
      const quantity = Math.min(def.maxStackSize, total - offset);
      const selected = quantity === def.maxStackSize
        ? i < fullSelectedStacks
        : selectedRemainder >= quantity;
      const nextCount = selectedCount + quantity;
      const canSelect = selectedSlots(draft) - Math.ceil(selectedCount / def.maxStackSize)
        + Math.ceil(nextCount / def.maxStackSize) <= draft.carryLimit;
      loot.push({
        id: `${itemId}#${i}`,
        itemId,
        quantity,
        item: {
          id: `${itemId}#${i}`,
          title: def.name,
          description: `${def.name} — base value ${def.baseValueGold}g.`,
          icon: itemIconFor(itemId),
          stack: { label: `× ${quantity}`, tooltip: `${quantity} / ${def.maxStackSize} items · 1 carry slot` },
        },
        selected,
        canToggle: selected || canSelect,
        disabledReason: !selected && !canSelect ? 'Carry limit reached' : undefined,
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
  const raidWeek = draft.raidWeek ?? state.week;
  const oldWeek = raidWeek < state.week;
  const village = state.villageState(missionId);
  const defendersKnown = draft.defendersBefore !== undefined && draft.defenderLosses !== undefined && draft.defendersRemaining !== undefined;
  const recoveryIn = fmtHours(Math.max(0, (state.week + 1) * CONFIG.constants.weekDays * 24 - state.hours));
  const injuredCount = draft.squad.filter(id => (draft.injuryRolls[id] ?? 0) > 0).length;
  const defenderResultLabel = defendersKnown
    ? `Defenders incapacitated: ${draft.defenderLosses} · Remaining: ${draft.defendersRemaining} of ${draft.fullDefenders ?? mission.fullDefenders}`
    : 'Defender results were not recorded in this older report.';
  const recoveryLabel = oldWeek
    ? `Week ${raidWeek + 1} report. This village has already recovered for the current week (${village.activeDefenders}/${village.fullDefenders} defenders). Claim releases this squad; the new week's village is unchanged.`
    : draft.success
      ? `Village defeated for this week. Defenders and rewards recover in ${recoveryIn}. Completion stays recorded after Claim.`
      : `Claim to release this squad and attack again. Defender losses last until weekly recovery in ${recoveryIn}. No village rewards on defeat.`;

  return {
    raidId: missionId,
    location: {
      id: missionId,
      title: mission.name,
      imageUrl: missionLocationImage(mission),
      description: mission.description,
      difficultyIcon: missionDifficultyIcons(mission),
      difficultyLabel: `Tier ${mission.tier}`,
      weatherIcon: missionWeather(mission).icon,
      weatherLabel: missionWeather(mission).label,
      result: draft.success ? 'victory' : 'defeat',
      resultLabel: draft.success ? 'Victory!' : 'Defeat',
      elapsedLabel: fmtHours(draft.durationHours ?? preview.durationHours),
      squadLabel: `${draft.squad.length} minion${draft.squad.length === 1 ? '' : 's'}`,
      victoryChanceLabel: state.enemyIntelLevel() >= 1 && draft.victoryChance !== undefined
        ? draft.victoryChance === 1 ? 'Guaranteed' : pct(draft.victoryChance) : undefined,
    },
    defenderResultLabel,
    recoveryLabel,
    injurySummary: `${injuredCount} injured · ${draft.squad.length} tired. Injured minions need Infirmary treatment before raiding again.`,
    currencies: [
      { id: 'gold', icon: '🪙', label: 'Gold', amountLabel: `${draft.goldFound}` },
      { id: 'crystals', icon: '💎', label: 'Crystals', amountLabel: `${draft.crystalsFound}` },
    ],
    loot,
    selection: {
      selectedCountLabel: `${slots} / ${draft.carryLimit} slots`,
      capacityLabel: `Carry: ${draft.carryLimit} · Used: ${slots}`,
      hint: !draft.success ? 'No village loot on defeat. Claim releases the squad.' : slots >= draft.carryLimit ? 'Carry limit reached.' : 'Select stacks to bring home. Each stack uses one carry slot.',
    },
    prisoners,
    minions,
    claim: { label: draft.success ? 'Claim Rewards' : 'Claim Report', canClaim: true },
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
        const choice = buildRaidReportViewModel(engine, missionId)?.loot.find(x => x.id === action.lootStackId);
        if (choice?.canToggle && choice.selected !== action.selected) {
          adjustSelection(draft, choice.itemId, action.selected ? choice.quantity : -choice.quantity);
        }
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
