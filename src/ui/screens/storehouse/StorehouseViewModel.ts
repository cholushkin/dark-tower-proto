import type { ItemComponentAction, ItemComponentViewModel } from '../../components/ItemComponent/ItemComponent.types';
import type { RoomOverviewViewModel } from '../../components/RoomOverviewCard/RoomOverviewCard.types';
import type { TagFilterBarViewModel } from '../../components/TagFilterBar/TagFilterBar.types';
import type { UpgradeCardViewModel } from '../../components/UpgradeCard/UpgradeCard.types';

/** Display-only snapshot provided by the host adapter. No domain objects in this contract. */
export interface StorehouseViewModel {
  readonly room: Readonly<RoomOverviewViewModel>;
  readonly upgrades: readonly UpgradeCardViewModel[];
  readonly filters: Readonly<TagFilterBarViewModel>;
  /** Already filtered by the adapter/controller. One card per item stack. */
  readonly items: readonly ItemComponentViewModel[];
  readonly vacantSlots: number;
  readonly inventoryLabel: string;
  readonly emptyMessage: string;
  readonly busy?: boolean;
}

export type StorehouseAction =
  | Readonly<{ type: 'upgradeRequested'; upgradeId: string }>
  | Readonly<{ type: 'filterToggled'; tag: string }>
  | ItemComponentAction;

export type StorehouseActionHandler = (action: StorehouseAction) => void;
export interface StorehouseViewHandle {
  setModel(model: Readonly<StorehouseViewModel>): void;
  destroy(): void;
}
