import type {ItemTileViewModel} from '../../components/ItemTile/ItemTile.types';
import type {MinionComponentViewModel} from '../../components/MinionComponent/MinionComponent.types';

export interface ReportPrisonerViewModel {
  readonly id: string;
  readonly portraitSrc: string;
  readonly rankLabel: string;
  readonly rankTooltip: string;
}

export interface LootChoiceViewModel {
  readonly id: string; // unique copy ID, not item-type ID
  readonly item: Readonly<ItemTileViewModel>;
  readonly selected: boolean;
  readonly canToggle: boolean;
  readonly disabledReason?: string;
}
export interface RaidReportViewModel {
  readonly raidId: string;
  readonly location: Readonly<{
    id: string; title: string; imageUrl: string; description: string;
    difficultyIcon: string; difficultyLabel: string;
    weatherIcon: string; weatherLabel: string;
    result: 'victory'|'defeat'; resultLabel: string;
    elapsedLabel: string; squadLabel: string;
  }>;
  readonly currencies: ReadonlyArray<Readonly<{id:string; icon:string; label:string; amountLabel:string}>>;
  readonly loot: readonly Readonly<LootChoiceViewModel>[];
  readonly selection: Readonly<{
    selectedCountLabel: string; // e.g. 8 / 8 selected
    capacityLabel: string; // e.g. Carry: 8 · Free slots: 8
    hint: string;
  }>;
  readonly prisoners: readonly Readonly<ReportPrisonerViewModel>[];
  readonly minions: readonly Readonly<MinionComponentViewModel>[];
  readonly claim: Readonly<{label:string; canClaim:boolean; disabledReason?:string}>;
  readonly pauseLabel: string;
}
export type RaidReportAction =
  | Readonly<{type:'lootSelectionRequested'; raidId:string; lootCopyId:string; selected:boolean}>
  | Readonly<{type:'claimRequested'; raidId:string}>
  | Readonly<{type:'closeRequested'; raidId:string}>
  | Readonly<{type:'locationInfoRequested'; locationId:string}>
  | Readonly<{type:'characterInfoRequested'; characterId:string}>;
export type RaidReportActionHandler=(action:RaidReportAction)=>void;
export interface RaidReportViewHandle {setModel(model:Readonly<RaidReportViewModel>):void;destroy():void}
