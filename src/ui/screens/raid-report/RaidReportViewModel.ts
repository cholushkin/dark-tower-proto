import type {ItemTileViewModel} from '../../components/ItemTile/ItemTile.types';
import type {MinionComponentViewModel} from '../../components/MinionComponent/MinionComponent.types';

export interface ReportPrisonerViewModel {
  readonly id: string;
  readonly portraitSrc: string;
  readonly rankLabel: string;
  readonly rankTooltip: string;
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
  readonly defenderResultLabel: string;
  readonly recoveryLabel: string;
  readonly injurySummary: string;
  readonly currencies: ReadonlyArray<Readonly<{id:string; icon:string; label:string; amountLabel:string}>>;
  readonly loot: readonly Readonly<ItemTileViewModel>[];
  readonly prisoners: readonly Readonly<ReportPrisonerViewModel>[];
  readonly minions: readonly Readonly<MinionComponentViewModel>[];
  readonly claim: Readonly<{label:string; canClaim:boolean; disabledReason?:string}>;
  readonly canViewBattle: boolean;
  readonly pauseLabel: string;
}
export type RaidReportAction =
  | Readonly<{type:'claimRequested'; raidId:string}>
  | Readonly<{type:'closeRequested'; raidId:string}>
  | Readonly<{type:'battleVisualizationRequested'}>
  | Readonly<{type:'locationInfoRequested'; locationId:string}>
  | Readonly<{type:'characterInfoRequested'; characterId:string}>;
export type RaidReportActionHandler=(action:RaidReportAction)=>void;
export interface RaidReportViewHandle {setModel(model:Readonly<RaidReportViewModel>):void;destroy():void}
