import type { ItemIcon } from '../../components/ItemTile/ItemTile.types';
import type { RoomOverviewViewModel } from '../../components/RoomOverviewCard/RoomOverviewCard.types';
import type { UpgradeCardViewModel } from '../../components/UpgradeCard/UpgradeCard.types';
import type { MinionComponentViewModel } from '../../components/MinionComponent/MinionComponent.types';
import type { MissionPinViewModel, MissionVisualState } from '../../components/MissionPin/MissionPin.types';

export interface RewardPreviewViewModel {
  readonly id: string;
  readonly icon: ItemIcon;
  readonly chanceLabel: string;
  readonly label: string;
}
export interface MissionDetailViewModel {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly locationImageSrc: string;
  readonly locationImageAlt: string;
  readonly difficultyIcons: string;
  readonly weatherIcon: string;
  readonly weatherDescription: string;
  readonly rewards: readonly RewardPreviewViewModel[];
  readonly squadSizeLabel: string;
  readonly squadSelectionLabel: string;
  readonly estimatedDuration: string;
  readonly estimatedFatigue: string;
  /** Empty string when no estimate applies (not planning a raid right now). */
  readonly successEstimateLabel: string;
  readonly state: MissionVisualState;
  readonly statusLabel: string;
  readonly activeProgress?: number;
  readonly activeRemainingTime?: string;
  readonly canRaid: boolean;
  readonly raidDisabledReason?: string;
  readonly canEditSquad: boolean;
  readonly minionTrayLabel: string;
}
export interface WarRoomMinionViewModel {
  readonly minion: Readonly<MinionComponentViewModel>;
  readonly selected: boolean;
  readonly selectable: boolean;
  readonly unavailableReason?: string;
}
export interface WarRoomViewModel {
  readonly mapImageSrc: string;
  readonly mapImageAlt: string;
  readonly title: string;
  readonly room: Readonly<RoomOverviewViewModel>;
  readonly upgrades: readonly Readonly<UpgradeCardViewModel>[];
  readonly missions: readonly Readonly<MissionPinViewModel>[];
  readonly selectedMissionId: string | null;
  readonly selectedMission: Readonly<MissionDetailViewModel> | null;
  readonly minions: readonly Readonly<WarRoomMinionViewModel>[];
  /** Host-published state for presentation toggling. */
  readonly minionsExpanded: boolean;
}
export type WarRoomAction =
  | Readonly<{type:'upgradeRequested'; upgradeId:string}>
  | Readonly<{type:'missionSelected'; missionId:string}>
  | Readonly<{type:'missionInfoRequested'; missionId:string}>
  | Readonly<{type:'minionSelectionRequested'; missionId:string; minionId:string}>
  | Readonly<{type:'minionInfoRequested'; minionId:string}>
  | Readonly<{type:'minionTrayToggled'; expanded:boolean}>
  | Readonly<{type:'raidRequested'; missionId:string}>;
export type WarRoomActionHandler = (action:WarRoomAction) => void;
export interface WarRoomViewHandle {setModel(model:Readonly<WarRoomViewModel>): void;destroy():void}
