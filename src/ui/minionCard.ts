import { CONFIG } from '../data/config';
import type { GameState } from '../model/GameState';
import type { MinionComponentViewModel } from './components/MinionComponent/MinionComponent.types';
import { nameFor, portraitFor } from './minionIdentity';
import { minionStatus } from './minionStatus';
export function buildMinionCard(state: GameState, minion: GameState['minions'][number]): MinionComponentViewModel {
 const name = nameFor(minion.id);
 const rank = CONFIG.ranks[minion.rank - 1];
 return {id:minion.id,name,description:`${name} is a Rank ${minion.rank} ${rank.name} of the Dark Tower.`,
 rank:{label:`${rank.name} (R${minion.rank})`,icon:'⌃',tooltip:`Rank ${minion.rank}: ${rank.name}`},
 portrait:portraitFor(minion.id),conditions:[
 ...(minion.injured ? [{id:'injured',label:'Injured',icon:'🩹',tone:'injured' as const}] : []),
 ...(minion.tired ? [{id:'tired',label:'Tired',icon:'🌙',tone:'tired' as const}] : [])],status:minionStatus(state,minion)};
}
