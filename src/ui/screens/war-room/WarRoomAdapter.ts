import { minionStatus } from '../../minionStatus';
import { CONFIG } from '../../../data/config';
import type { GameEngine } from '../../../engine/GameEngine';
import type { GameState } from '../../../model/GameState';
import { canLaunchRaid, missionDef } from '../../../systems/world';
import type { MinionComponentViewModel, MinionConditionDisplay } from '../../components/MinionComponent/MinionComponent.types';
import type { MissionPinViewModel, MissionVisualState } from '../../components/MissionPin/MissionPin.types';
import { asset } from '../assets';
import { buildUpgradeLineViewModel, fmtHours, groupUpgradeFamilies, itemIconFor, missionDifficultyIcons, missionLocationImage, missionWeather, pct, roomUpgradeDefs } from '../shared';
import { nameFor, portraitFor } from '../../minionIdentity';
import type { MissionDetailViewModel, MissionParameterViewModel, RewardPreviewViewModel, WarRoomAction, WarRoomMinionViewModel, WarRoomViewModel } from './WarRoomViewModel';

export interface WarRoomUiState {
  showMapCoordinates: boolean;
  selectedMissionId: string | null;
  squadSelection: Set<string>;
}

export function createWarRoomUiState(): WarRoomUiState {
  return { selectedMissionId: null, squadSelection: new Set(), showMapCoordinates: false };
}

const roomImage = asset('rooms/war-room.webp');


function minionViewModel(state: GameState, id: string): MinionComponentViewModel {
  const minion = state.findMinion(id)!;
  const name = nameFor(id);
  const rankDef = CONFIG.ranks[minion.rank - 1];
  const conditions: MinionConditionDisplay[] = [];
  if (minion.injured) conditions.push({ id: 'injured', label: 'Injured', icon: '🩹', tone: 'injured' });
  if (minion.tired) conditions.push({ id: 'tired', label: 'Tired', icon: '🌙', tone: 'tired' });
  return {
    id,
    name,
    description: `${name} is a Rank ${minion.rank} ${rankDef.name}.`,
    rank: { label: `${rankDef.name} (R${minion.rank})`, icon: minion.rank === 5 ? '👑' : '⌃', tooltip: `Rank ${minion.rank}: ${rankDef.name}` },
    portrait: portraitFor(id),
    conditions,
    status: minionStatus(state, minion),
  };
}

function missionPinState(state: GameState, missionId: string): MissionVisualState {
  switch (state.missionState(missionId)) {
    case 'LOCKED': return 'locked';
    case 'RUNNING': return 'inProgress';
    case 'COMPLETED_UNCLAIMED': return 'reportReady';
    case 'COOLDOWN': return 'completed';
    default: return 'available';
  }
}

function buildMissionDetail(engine: GameEngine, ui: WarRoomUiState, missionId: string): MissionDetailViewModel {
  const state = engine.state;
  const mission = missionDef(missionId);
  const liveState = state.missionState(missionId);
  const visual = missionPinState(state, missionId);
  const squad = [...ui.squadSelection].filter(id => state.findMinion(id));
  const scouted = state.enemyIntelLevel() >= 1;
  const defendersKnown = scouted || state.everVisitedMissions.has(missionId);
  const village = state.villageState(missionId);
  const defenderCount = village.activeDefenderRanks.length;
  const garrisonSize = mission.defenderRanks.length;
  const recoveryIn = fmtHours(Math.max(0, (state.week + 1) * CONFIG.constants.weekDays * 24 - state.hours));
  const lootIntel = state.lootIntelLevel();

  const rewards: RewardPreviewViewModel[] = mission.loot.map(l => {
    const def = CONFIG.items.find(i => i.id === l.itemId)!;
    return { id: l.itemId, icon: lootIntel >= 1 ? itemIconFor(l.itemId) : { kind: 'emoji', value: '📦' }, chanceLabel: lootIntel >= 2 ? pct(l.chance) : '', label: lootIntel >= 2 ? `${def.name}: ${pct(l.chance)} chance on victory; ${l.min}–${l.max} found when dropped.` : lootIntel >= 1 ? `${def.name}. Upgrade Loot Intelligence to reveal its drop chance.` : 'Unknown loot type. Upgrade Loot Intelligence to identify it.' };
  });

  let statusLabel = 'Ready to raid';
  let activeProgress: number | undefined;
  let activeRemainingTime: string | undefined;
  if (liveState === 'RUNNING') {
    const processId = state.missionRunningProcess.get(missionId);
    const process = state.processes.find(p => p.id === processId);
    if (process) {
      activeProgress = Math.min(1, Math.max(0, (state.hours - process.startHour) / (process.endHour - process.startHour)));
      activeRemainingTime = fmtHours(Math.max(0, process.endHour - state.hours));
    }
    statusLabel = 'Raid in progress';
  } else if (liveState === 'COMPLETED_UNCLAIMED') statusLabel = 'Minions returning · View Report';
  else if (liveState === 'COOLDOWN') statusLabel = 'Village defeated — available next week';
  else if (liveState === 'LOCKED') statusLabel = 'Locked — unlock this World Tier first';

  const canRaid = liveState === 'AVAILABLE' ? canLaunchRaid(state, missionId, squad) : liveState === 'COMPLETED_UNCLAIMED';
  let raidDisabledReason: string | undefined;
  if (liveState === 'AVAILABLE' && !canRaid) raidDisabledReason = squad.length === 0 ? 'Select at least one minion' : 'Selected minions are unavailable';
  else if (liveState === 'RUNNING') raidDisabledReason = 'Raid already in progress';
  else if (liveState === 'COOLDOWN') raidDisabledReason = `Village already defeated. Available again in ${recoveryIn}.`;
  else if (liveState === 'LOCKED') raidDisabledReason = 'World Tier locked';

  const weather = missionWeather(mission);
  const parameters: MissionParameterViewModel[] = [
    { id: 'difficulty', icon: missionDifficultyIcons(mission), value: `Tier ${mission.tier}`,
      description: `World Tier ${mission.tier}.` },
    { id: 'duration', icon: '⌛', value: liveState === 'RUNNING' ? `${activeRemainingTime ?? '—'} remaining` : fmtHours(mission.durationHours),
      description: liveState === 'RUNNING' ? 'Time until this raid resolves, in game hours.' : 'Fixed raid duration in game hours.' },
    { id: 'defenders', icon: '🛡️',
      value: defendersKnown ? `Defenders: ${defenderCount} · Recovering: ${Math.max(0, garrisonSize - defenderCount)}` : 'Defenders unknown',
      description: defendersKnown ? `${defenderCount} defenders can fight. The garrison recovers at the start of next week, in ${recoveryIn}.` : 'Raid this village once or complete Enemy Intelligence I to reveal defender counts.' },
  ];
  if (scouted && defenderCount > 0) {
    const rankedCounts = CONFIG.ranks.map(({ rank }) => ({
      rank, count: village.activeDefenderRanks.filter(activeRank => activeRank === rank).length,
    }));
    parameters.push({ id: 'defender-ranks', icon: '♟',
      value: rankedCounts.filter(({ count }) => count > 0).map(({ rank, count }) => `R${rank} × ${count}`).join(' · '),
      description: 'Ranks of active defenders.' });
  }

  parameters.push({ id: 'weather', icon: weather.icon, value: weather.label, description: weather.description });
  if (state.enemyIntelLevel() >= 2) parameters.push({ id: 'village-rewards', icon: '🪙',
    value: `${village.rewards.gold} gold · ${village.rewards.crystals} crystals`,
    description: 'This week\'s village currency stock. Only a successful raid earns these rewards. Uncollected stock is replaced at the start of next week.' });

  return {
    id: missionId,
    name: mission.name,
    description: mission.description,
    locationImageSrc: missionLocationImage(mission),
    locationImageAlt: mission.name,
    rewards,
    rewardIntelLabel: lootIntel >= 2 ? 'Drop chances on victory' : lootIntel >= 1 ? 'Items revealed · chances unknown' : `${mission.loot.length} possible loot types · unidentified`,
    parameters,
    squadSelectionLabel: `${squad.length} selected`,
    state: visual,
    statusLabel,
    recoveryLabel: `Village recovery in ${recoveryIn} · defenders and rewards replenish weekly`,
    activeProgress,
    activeRemainingTime,
    canRaid,
    raidDisabledReason,
    canEditSquad: liveState === 'AVAILABLE',
    minionTrayLabel: 'Assign Minions',
  };
}

export function buildWarRoomViewModel(engine: GameEngine, ui: WarRoomUiState): WarRoomViewModel {
  const state = engine.state;
  const upgrades = groupUpgradeFamilies(roomUpgradeDefs('warRoom')).map(family => {
    const icon = family[0].effect.type === 'lootIntel' ? '🔍' : '🗺️';
    const title = family[0].effect.type === 'lootIntel' ? 'Loot Intelligence' : 'Enemy Intelligence';
    return buildUpgradeLineViewModel(state, family, icon, title);
  });

  const world = CONFIG.worlds.find(world => world.id === CONFIG.startingWorldId);
  if (!world) throw new Error(`Unknown starting world: ${CONFIG.startingWorldId}`);
  const missions: MissionPinViewModel[] = world.missions.filter(mission => state.missionState(mission.id) !== 'LOCKED').map(mission => {
    const pos = mission.mapPosition;
    const detail = buildMissionDetail(engine, mission.id === ui.selectedMissionId ? ui : { ...ui, squadSelection: new Set() }, mission.id);
    const walkback = detail.state === 'reportReady'
      ? state.processes.find(p => p.type === 'walkback' && p.missionId === mission.id)
      : undefined;
    return {
      id: mission.id,
      name: mission.name,
      x: pos.x,
      y: pos.y,
      tier: mission.tier,
      parameters: detail.parameters,
      rewards: detail.rewards,
      statusLabel: detail.statusLabel,
      state: detail.state,
      completed: state.everClaimedMissions.has(mission.id),
      defendersLabel: state.enemyIntelLevel() >= 1 || state.everVisitedMissions.has(mission.id)
        ? String(state.villageState(mission.id).activeDefenderRanks.length) : undefined,
      progress: walkback && walkback.endHour > walkback.startHour
        ? Math.min(1, Math.max(0, (state.hours - walkback.startHour) / (walkback.endHour - walkback.startHour)))
        : detail.activeProgress,
      selected: mission.id === ui.selectedMissionId,
    };
  });

  const selectedMission = ui.selectedMissionId && state.missionState(ui.selectedMissionId) !== 'LOCKED'
    ? buildMissionDetail(engine, ui, ui.selectedMissionId) : null;
  const canEditSquad = selectedMission?.canEditSquad ?? false;

  const minions: WarRoomMinionViewModel[] = state.minions.map(m => {
    const idle = m.activity.type === 'idle' && !m.tired && !m.injured;
    const selected = ui.squadSelection.has(m.id);
    return {
      minion: minionViewModel(state, m.id),
      selected,
      selectable: canEditSquad && (idle || selected),
      unavailableReason: idle || !canEditSquad ? undefined : m.activity.type === 'raid' ? 'Reserved until the raid report is Claimed' : m.injured ? 'Injured — needs Infirmary treatment' : m.tired ? 'Tired — needs rest' : 'Busy with another activity',
    };
  });

  return {
    title: 'War Room',
    worldName: world.name,
    showMapCoordinates: ui.showMapCoordinates,
    mapImageSrc: `${import.meta.env?.BASE_URL ?? '/'}${world.mapImage}`,
    mapImageAlt: `${world.name} map`,
    room: {
      id: 'warRoom',
      title: 'War Room',
      imageSrc: roomImage,
      imageAlt: 'The War Room',
      stats: [
        { id: 'enemy-intel', icon: '🔍', label: 'Enemy Intel', value: `Lv.${state.enemyIntelLevel()}` },
        { id: 'loot-intel', icon: '🗺️', label: 'Loot Intel', value: `Lv.${state.lootIntelLevel()}`, emphasized: true },
      ],
    },
    upgrades,
    missions,
    selectedMissionId: selectedMission?.id ?? null,
    selectedMission,
    minions,
  };
}

export interface WarRoomNav {
  openRaidReport(missionId: string): void;
}

export function handleWarRoomAction(engine: GameEngine, ui: WarRoomUiState, action: WarRoomAction, nav: WarRoomNav): void {
  const state = engine.state;
  switch (action.type) {
    case 'upgradeRequested': {
      const family = groupUpgradeFamilies(roomUpgradeDefs('warRoom')).find(f => f.some(d => d.id.replace(/_\d+$/, '') === action.upgradeId));
      const ownedCount = family?.filter(d => state.purchasedUpgrades.has(d.id)).length ?? 0;
      const next = family?.[ownedCount];
      if (next) engine.buyUpgrade(next.id);
      return;
    }
    case 'missionSelected':
      ui.selectedMissionId = action.missionId;
      ui.squadSelection = new Set();
      if (state.pendingReports.has(action.missionId)) nav.openRaidReport(action.missionId);
      return;
    case 'missionInfoRequested':
    case 'minionInfoRequested':
      return; // Informational only; the components show their own tooltips.
    case 'minionSelectionRequested':
      if (ui.squadSelection.has(action.minionId)) ui.squadSelection.delete(action.minionId);
      else ui.squadSelection.add(action.minionId);
      return;
    case 'missionClosed':
      ui.selectedMissionId = null;
      ui.squadSelection.clear();
      return;
    case 'raidRequested': {
      const missionState = state.missionState(action.missionId);
      if (missionState === 'AVAILABLE') {
        if (engine.launchRaid(action.missionId, [...ui.squadSelection])) ui.squadSelection = new Set();
      } else if (missionState === 'COMPLETED_UNCLAIMED') {
        nav.openRaidReport(action.missionId);
      }
      return;
    }
  }
}
