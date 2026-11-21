import type { RoomOverviewViewModel } from '../../components/RoomOverviewCard/RoomOverviewCard.types';
import type { UpgradeCardViewModel } from '../../components/UpgradeCard/UpgradeCard.types';

export interface LaboratoryViewModel {
  readonly room: RoomOverviewViewModel;
  readonly upgrades: readonly UpgradeCardViewModel[];
}
export type LaboratoryAction = Readonly<{ type: 'upgradeRequested'; upgradeId: string }>;
export type LaboratoryActionHandler = (action: LaboratoryAction) => void;
export interface LaboratoryViewHandle {
  setModel(model: Readonly<LaboratoryViewModel>): void;
  destroy(): void;
}
