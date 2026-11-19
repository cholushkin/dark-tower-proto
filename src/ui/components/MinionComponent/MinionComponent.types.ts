/** Read-only, display-ready contract for a single minion card. No game state or service types. */
export type MinionPortrait = Readonly<{ kind: 'texture'; src: string; alt: string }>;

export interface MinionRankDisplay {
  readonly label: string;
  /** Small rank icon. */
  readonly icon: string;
  readonly tooltip?: string;
}

export type MinionConditionTone = 'injured' | 'tired' | 'neutral';
export interface MinionConditionDisplay {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly tone: MinionConditionTone;
  readonly tooltip?: string;
}

export interface MinionStatusDisplay {
  /** Process completion from 0 to 1; absent for statuses without a process. */
  readonly progress?: number;
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly tooltip?: string;
}

export interface MinionComponentViewModel {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly rank: Readonly<MinionRankDisplay>;
  readonly portrait: MinionPortrait;
  /** Ordered, displayed conditions. 0–2 typical, but component supports more. */
  readonly conditions: readonly Readonly<MinionConditionDisplay>[];
  readonly status: Readonly<MinionStatusDisplay>;
}

/** The only user intent; status, rank, and condition labels are not actions. */
export type MinionComponentAction = Readonly<{
  type: 'infoRequested';
  minionId: string;
}>;
export type MinionComponentActionHandler = (action: MinionComponentAction) => void;

export interface MinionComponentHandle {
  setModel(model: Readonly<MinionComponentViewModel>): void;
  destroy(): void;
}
