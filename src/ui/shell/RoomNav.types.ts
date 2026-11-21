export interface RoomNavEntryViewModel {
  readonly id: string;
  /** Resolved URL of the room's transparent white glyph asset. */
  readonly icon: string;
  readonly label: string;
  readonly active: boolean;
}
export interface RoomNavViewModel {
  readonly rooms: readonly RoomNavEntryViewModel[];
}
export type RoomNavAction = Readonly<{ type: 'navigate'; id: string }>;
export type RoomNavActionHandler = (action: RoomNavAction) => void;
export interface RoomNavHandle {
  setModel(model: Readonly<RoomNavViewModel>): void;
  destroy(): void;
}
