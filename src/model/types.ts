export type MinionActivityType = "idle" | "raid" | "training" | "resting" | "treatment";

export interface MinionActivity {
    type: MinionActivityType;
    processId?: string;
    missionId?: string;
}

export interface Minion {
    id: string;
    rank: number;
    tired: boolean;
    injured: boolean;
    activity: MinionActivity;
    /** Game-hour timestamp since this minion became free + (Tired or Injured) without a bed. */
    waitingSince: number | null;
}

export type PrisonerOutcome = "recruit" | "interrogate" | "death";

export interface Prisoner {
    id: string;
    rank: number;
    processId: string | null;
}

export interface ItemStack {
    id: string;
    itemId: string;
    count: number;
}

interface BaseProcess {
    id: string;
    startHour: number;
    endHour: number;
}

export interface RaidProcess extends BaseProcess {
    type: "raid";
    missionId: string;
    squad: string[];
    /** Launch snapshots isolate ongoing raids from weekly recovery. Optional for old saves. */
    raidWeek?: number;
    defenderRanks?: number[];
    rewards?: VillageRewards;
}

export interface VillageRewards {
    gold: number;
    crystals: number;
    lootCopies: string[];
    prisoners: number[];
}

export interface VillageState {
    week: number;
    activeDefenderRanks: number[];
    rewards: VillageRewards;
    raided: boolean;
}

export interface RestProcess extends BaseProcess {
    type: "rest";
    minionId: string;
}

export interface TreatmentProcess extends BaseProcess {
    type: "treatment";
    minionId: string;
    /** Fatigue gained during treatment starts a new rest interval. Defaults to admission. */
    restStartHour?: number;
}

export interface TrainingProcess extends BaseProcess {
    type: "training";
    minionId: string;
    fromRank: number;
    toRank: number;
}

export interface SaleProcess extends BaseProcess {
    type: "sale";
    stackId: string;
    itemId: string;
    count: number;
    goldValue: number;
}

export interface UpgradeProcess extends BaseProcess {
    type: "upgrade";
    upgradeId: string;
}

export interface IncrementalUpgradeProcess extends BaseProcess {
    type: "incrementalUpgrade";
    upgradeId: string;
}

export interface DungeonProcess extends BaseProcess {
    type: "dungeon";
    prisonerId: string;
    rank: number;
}

export interface WalkbackProcess extends BaseProcess {
    type: "walkback";
    missionId: string;
}

export type Process =
    | RaidProcess
    | RestProcess
    | TreatmentProcess
    | TrainingProcess
    | SaleProcess
    | UpgradeProcess
    | IncrementalUpgradeProcess
    | DungeonProcess
    | WalkbackProcess;

export type MissionState =
    | "LOCKED"
    | "AVAILABLE"
    | "RUNNING"
    | "COMPLETED_UNCLAIMED"
    | "COOLDOWN";

export interface BattleReplayUnit {
    readonly id: string;
    readonly rank: number;
    readonly health: number;
}

export interface BattleReplayHit {
    readonly attackerId: string;
    readonly targetId: string;
    readonly damage: number;
}

export interface BattleReplayRound {
    readonly hits: readonly BattleReplayHit[];
    readonly endHealth: readonly { readonly unitId: string; readonly health: number }[];
}

export interface BattleReplay {
    readonly attackers: readonly BattleReplayUnit[];
    readonly defenders: readonly BattleReplayUnit[];
    readonly rounds: readonly BattleReplayRound[];
}

export interface RaidReportDraft {
    missionId: string;
    success: boolean;
    squad: string[];
    goldFound: number;
    crystalsFound: number;
    /** One entry per discovered physical item copy. */
    lootCopies: string[];
    prisonersFound: number[];
    injuredMinionIds: string[];
    raidWeek?: number;
    defendersBefore?: number;
    defenderLosses?: number;
    defendersRemaining?: number;
    durationHours?: number;
    battleReplay?: BattleReplay;
}
