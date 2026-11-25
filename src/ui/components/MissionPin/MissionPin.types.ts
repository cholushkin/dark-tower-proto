import type { ItemIcon } from '../ItemTile/ItemTile.types';
/** Map coordinates are percentages of the authored world-map canvas, not screen pixels. */
export type MissionVisualState = 'available' | 'inProgress' | 'reportReady' | 'completed' | 'locked';

export interface MissionPinViewModel {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly tier: number;
  readonly parameters: readonly Readonly<{ icon: string; value: string; description: string }>[];
  readonly rewards: readonly Readonly<{ icon: ItemIcon; chanceLabel: string; label: string }>[];
  readonly statusLabel: string;
  readonly state: MissionVisualState;
  readonly completed?: boolean;
  readonly defendersLabel?: string;
  /** 0..1; supplied by host, displayed only. */
  readonly progress?: number;
  readonly selected?: boolean;
}
export type MissionPinHandle = { setModel(value: Readonly<MissionPinViewModel>): void; destroy(): void };
