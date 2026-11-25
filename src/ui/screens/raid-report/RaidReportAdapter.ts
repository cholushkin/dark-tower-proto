import { asset } from '../assets';
import { CONFIG } from '../../../data/config';
import type { GameEngine } from '../../../engine/GameEngine';
import { discoveredCounts } from '../../../systems/raidReport';
import { missionDef } from '../../../systems/world';
import type { MinionComponentViewModel, MinionConditionDisplay } from '../../components/MinionComponent/MinionComponent.types';
import { fmtHours, itemIconFor, missionDifficultyIcons, missionLocationImage, missionWeather } from '../shared';
import { nameFor, portraitFor } from '../../minionIdentity';
import { buildBattleVisualizationViewModel } from '../battle-visualization/BattleVisualizationAdapter';
import type { BattleVisualizationViewModel } from '../battle-visualization/BattleVisualizationViewModel';
import type { RaidReportAction, RaidReportViewModel, ReportPrisonerViewModel } from './RaidReportViewModel';

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

  const loot = Object.entries(discoveredCounts(draft)).map(([itemId, count]) => {
    const def = itemDef(itemId);
    return {
      id: itemId,
      title: def.name,
      description: `${def.name} — base value ${def.baseValueGold}g.`,
      icon: itemIconFor(itemId),
      stack: { label: `× ${count}`, tooltip: `${count} found` },
    };
  });

  const prisoners = draft.prisonersFound.map((rank, index) => prisonerViewModel(rank, index));

  const minions: MinionComponentViewModel[] = draft.squad.map(minionId => {
    const minion = state.findMinion(minionId);
    const name = nameFor(minionId);
    const rankDef = minion ? CONFIG.ranks[minion.rank - 1] : undefined;
    const injured = draft.injuredMinionIds.includes(minionId);
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

  const raidWeek = draft.raidWeek ?? state.week;
  const oldWeek = raidWeek < state.week;
  const village = state.villageState(missionId);
  const defendersKnown = draft.defendersBefore !== undefined && draft.defenderLosses !== undefined && draft.defendersRemaining !== undefined;
  const recoveryIn = fmtHours(Math.max(0, (state.week + 1) * CONFIG.constants.weekDays * 24 - state.hours));
  const injuredCount = draft.injuredMinionIds.length;
  const defenderResultLabel = defendersKnown
    ? `Defenders incapacitated: ${draft.defenderLosses} · Remaining: ${draft.defendersRemaining} of ${draft.defendersBefore}`
    : 'Defender results were not recorded in this older report.';
  const recoveryLabel = oldWeek
    ? `Week ${raidWeek + 1} report. The village has recovered for the current week (${village.activeDefenderRanks.length}/${mission.defenderRanks.length} defenders).`
    : draft.success
      ? `Village defeated for this week. Defenders and rewards recover in ${recoveryIn}. Completion stays recorded after Claim.`
      : `Teleport your minions back before raiding again. Defender losses last until weekly recovery in ${recoveryIn}.`;

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
      elapsedLabel: fmtHours(draft.durationHours ?? mission.durationHours),
      squadLabel: `${draft.squad.length} minion${draft.squad.length === 1 ? '' : 's'}`,
    },
    defenderResultLabel,
    recoveryLabel,
    injurySummary: `${injuredCount} injured · ${draft.squad.length} tired. Injured minions need Infirmary treatment before raiding again.`,
    currencies: [
      { id: 'gold', icon: '🪙', label: 'Gold', amountLabel: `${draft.goldFound}` },
      { id: 'crystals', icon: '💎', label: 'Crystals', amountLabel: `${draft.crystalsFound}` },
    ],
    loot,
    prisoners,
    minions,
    claim: { label: draft.success ? 'Claim Rewards' : 'Teleport Minions Back', canClaim: true },
    canViewBattle: draft.battleReplay !== undefined,
    pauseLabel: 'Time is paused while viewing this report',
  };
}

export interface RaidReportNav {
  close(): void;
  openBattleVisualization(model: BattleVisualizationViewModel): void;
}

export function handleRaidReportAction(engine: GameEngine, missionId: string, action: RaidReportAction, nav: RaidReportNav): void {
  switch (action.type) {
    case 'claimRequested':
      engine.claimReport(missionId);
      nav.close();
      return;
    case 'closeRequested':
      nav.close();
      return;
    case 'battleVisualizationRequested': {
      const replay = engine.state.pendingReports.get(missionId)?.battleReplay;
      if (replay) nav.openBattleVisualization(buildBattleVisualizationViewModel(replay));
      return;
    }
    case 'locationInfoRequested':
    case 'characterInfoRequested':
      return; // Informational only; no detail popover in this prototype.
  }
}
