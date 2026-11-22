import type { MinionComponentViewModel, MinionPortrait } from '../MinionComponent/MinionComponent.types';

/** Read-only UI representation of an automatically assigned bed. */
export interface BedOccupantViewModel {
  readonly card: MinionComponentViewModel;
  readonly minionId: string;
  readonly name: string;
  readonly portrait: MinionPortrait;
  /** Display-ready countdown provided by the adapter, never calculated inside the view. */
  readonly remainingLabel: string;
  readonly remainingTooltip?: string;
  /** 0..1 fraction complete, supplied by caller. */
  readonly restProgress: number;
  readonly conditionBadges: readonly {
    readonly id: string;
    readonly icon: string;
    readonly label: string;
    readonly tone: 'injured' | 'tired' | 'neutral';
  }[];
}
export interface BedSlotViewModel {
  readonly id: string;
  readonly label: string;
  /** Resting in Quarters or treatment in the Infirmary; visual-only. */
  readonly presentation?: 'rest' | 'treatment';
  /** Resolved by the adapter via asset() — this component never hardcodes a URL. */
  readonly bedImageSrc: string;
  readonly occupant?: Readonly<BedOccupantViewModel>;
}
export interface BedSlotHandle {
  setModel(model: Readonly<BedSlotViewModel>): void;
  destroy(): void;
}
