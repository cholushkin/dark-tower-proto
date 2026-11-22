import type { MinionComponentViewModel } from '../../components/MinionComponent/MinionComponent.types';
import type { RoomOverviewViewModel } from '../../components/RoomOverviewCard/RoomOverviewCard.types';
import type { UpgradeCardViewModel } from '../../components/UpgradeCard/UpgradeCard.types';
import type { TrainingStationViewModel } from '../../components/TrainingStation/TrainingStation.types';
import type { AssignmentPickerViewModel } from '../../components/AssignmentPicker/AssignmentPicker.types';

/** Display-ready snapshot; no engine classes, timers or mutable services. */
export interface TrainingHallViewModel {
  readonly room:Readonly<RoomOverviewViewModel>;
  readonly upgrades:readonly UpgradeCardViewModel[];
  readonly stations:readonly TrainingStationViewModel[];
  readonly roster: readonly { card: MinionComponentViewModel; trainLabel: string; canTrain: boolean; disabledReason?: string }[];
  readonly stationsCaption:string;
  readonly countCaption:string;
  readonly emptyMessage:string;
  readonly assignmentPicker?:Readonly<AssignmentPickerViewModel>;
  /** Authoritative selection from host whenever assignmentPicker is present. */
  readonly assignmentStationId?:string;
  readonly busy?:boolean;
}
export type TrainingHallAction =
 | Readonly<{type:'upgradeRequested';upgradeId:string}>
 | Readonly<{type:'trainRequested';minionId:string}>
 | Readonly<{type:'stationSelected';stationId:string}>
 | Readonly<{type:'assignRequested';stationId:string;minionId:string}>
 | Readonly<{type:'assignmentCancelled'}>;
export type TrainingHallActionHandler=(action:TrainingHallAction)=>void;
export interface TrainingHallViewHandle {setModel(model:Readonly<TrainingHallViewModel>):void;destroy():void;}
