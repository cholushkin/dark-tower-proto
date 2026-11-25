import {mountItemTile} from '../../components/ItemTile/ItemTile';
import type {ItemTileHandle} from '../../components/ItemTile/ItemTile.types';
import {mountMinionComponent} from '../../components/MinionComponent/MinionComponent';
import type {MinionComponentHandle} from '../../components/MinionComponent/MinionComponent.types';
import type {RaidReportViewModel,RaidReportViewHandle,RaidReportActionHandler,LootChoiceViewModel} from './RaidReportViewModel';
import './RaidReportView.css';

type LootEntry={root:HTMLElement;tile:ItemTileHandle;abort:AbortController};
type CharacterEntry={root:HTMLElement;tile:MinionComponentHandle};

/** State-free Raid Report popup. Parent supplies a complete immutable snapshot. */
export function mountRaidReportView(host:HTMLElement,initialModel:Readonly<RaidReportViewModel>,onAction:RaidReportActionHandler):RaidReportViewHandle {
  let model=initialModel;
  let destroyed=false;
  const abort=new AbortController();
  const lootNodes=new Map<string,LootEntry>();
  const prisonerNodes=new Map<string,HTMLElement>();
  const minionNodes=new Map<string,CharacterEntry>();
  const root=document.createElement('main');
  root.className='dt-raid__popup';
  root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');
  root.setAttribute('aria-labelledby','dt-raid-heading');
  root.innerHTML=`
     <header class="dt-raid__top"><div class="dt-raid__title-ornament">◆</div><h1 id="dt-raid-heading">Raid Report</h1><div class="dt-raid__title-ornament">◆</div>
        <button class="dt-raid__close" type="button" aria-label="Close Raid Report" title="Close report without claiming">×</button>
     </header>
     <div class="dt-raid__body">
       <section class="dt-raid__location" aria-label="Location and raid results">
         <div class="dt-raid__location-art"><img class="dt-raid__location-image" alt=""/><button class="dt-raid__location-info" type="button" aria-label="Mission information">i</button></div>
         <div class="dt-raid__location-meta"><h2 class="dt-raid__location-title"></h2><p class="dt-raid__location-description"></p>
           <div class="dt-raid__location-sub"><span class="dt-raid__difficulty"></span><span class="dt-raid__weather"></span></div>
         </div>
         <div class="dt-raid__result"><div class="dt-raid__result-label"></div><div class="dt-raid__result-stat"><span>⏱ Raid time</span><strong class="dt-raid__duration"></strong></div><div class="dt-raid__result-stat"><span>♟ Squad</span><strong class="dt-raid__squad"></strong></div><div class="dt-raid__result-stat dt-raid__odds-row" hidden><span>🎯 Victory chance</span><strong class="dt-raid__odds"></strong></div></div>
       </section>
       <section class="dt-raid__village-result" aria-label="Defender losses and village recovery"><strong class="dt-raid__defenders"></strong><p class="dt-raid__recovery"></p></section>
       <div class="dt-raid__collection-row">
         <section class="dt-raid__collection dt-raid__loot" aria-labelledby="dt-raid-loot-heading">
           <div class="dt-raid__collection-heading"><h3 id="dt-raid-loot-heading">📦 Loot Found</h3><span class="dt-raid__selection-count"></span></div>
           <div class="dt-raid__currencies" aria-label="Automatically collected currency"></div>
           <div class="dt-raid__horizontal-scroll dt-raid__loot-list" aria-label="Select loot stacks"></div>
           <p class="dt-raid__collection-note dt-raid__loot-note"></p>
         </section>
         <section class="dt-raid__collection dt-raid__prisoners" aria-labelledby="dt-raid-prisoner-heading">
           <div class="dt-raid__collection-heading"><h3 id="dt-raid-prisoner-heading">⛓ Prisoners</h3><span class="dt-raid__prisoner-count"></span></div>
           <div class="dt-raid__horizontal-scroll dt-raid__prisoner-list" aria-label="Prisoners"></div>
         </section>
       </div>
       <section class="dt-raid__minions" aria-labelledby="dt-raid-minions-heading">
         <div class="dt-raid__collection-heading"><h3 id="dt-raid-minions-heading">♟ Minion Results</h3><span class="dt-raid__minion-count"></span></div>
         <p class="dt-raid__injury-summary"></p>
         <div class="dt-raid__horizontal-scroll dt-raid__minion-list" aria-label="Raid squad results"></div>
       </section>
     </div>
     <footer class="dt-raid__footer"><div class="dt-raid__footer-info"><span class="dt-raid__pause-label"></span><span class="dt-raid__claim-summary"></span></div>
       <button class="dt-raid__claim" type="button">Claim <span aria-hidden="true">✦</span></button>
     </footer>`;
  function required<T extends Element>(q:string):T {const result=root.querySelector<T>(q);if(!result)throw new Error(`RaidReport template missing ${q}`);return result;}
  const get=(s:string)=>required<HTMLElement>(s);
  const lootList=get('.dt-raid__loot-list');
  const prisonerList=get('.dt-raid__prisoner-list');
  const minionList=get('.dt-raid__minion-list');
  const claim=required<HTMLButtonElement>('.dt-raid__claim');
  const close=required<HTMLButtonElement>('.dt-raid__close');
  const locationInfo=required<HTMLButtonElement>('.dt-raid__location-info');
  const locImage=required<HTMLImageElement>('.dt-raid__location-image');
  function dispatch(action:Parameters<RaidReportActionHandler>[0]):void{if(!destroyed)onAction(action);}
  claim.addEventListener('click',()=>{if(model.claim.canClaim)dispatch({type:'claimRequested',raidId:model.raidId});},{signal:abort.signal});
  close.addEventListener('click',()=>dispatch({type:'closeRequested',raidId:model.raidId}),{signal:abort.signal});
  locationInfo.addEventListener('click',()=>dispatch({type:'locationInfoRequested',locationId:model.location.id}),{signal:abort.signal});

  function toggle(stackId:string):void {
    const choice=model.loot.find(x=>x.id===stackId);
    if(!choice?.canToggle)return;
    dispatch({type:'lootSelectionRequested',raidId:model.raidId,lootStackId:stackId,selected:!choice.selected});
  }
  function renderLoot():void {
    const scrollLeft=lootList.scrollLeft;
    const currentIds=new Set(model.loot.map(x=>x.id));
    for(const [key,entry] of lootNodes){if(!currentIds.has(key)){entry.tile.destroy();entry.abort.abort();entry.root.remove();lootNodes.delete(key);}}
    const elements:HTMLElement[]=[];
    for(const choice of model.loot){
      let entry=lootNodes.get(choice.id);
      if(!entry){
        const wrapper=document.createElement('div');
        wrapper.className='dt-raid__tile-slot dt-raid__loot-choice';
        wrapper.tabIndex=0;
        wrapper.setAttribute('role','checkbox');
        wrapper.innerHTML='<div class="dt-raid__tile-mount"></div>';
        const tile=mountItemTile(wrapper.querySelector<HTMLElement>('.dt-raid__tile-mount')!,choice.item);
        const localAbort=new AbortController();
        wrapper.addEventListener('click',(e)=>{if((e.target as HTMLElement).closest('.dt-item__info'))return;toggle(choice.id);},{signal:localAbort.signal});
        wrapper.addEventListener('keydown',(e)=>{if(e.target!==wrapper)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(choice.id);}}, {signal:localAbort.signal});
        entry={root:wrapper,tile,abort:localAbort};lootNodes.set(choice.id,entry);
      }
      entry.tile.setModel(choice.item);
      entry.root.classList.toggle('dt-raid__loot-choice--selected',choice.selected);
      entry.root.classList.toggle('dt-raid__loot-choice--disabled',!choice.canToggle);
      entry.root.dataset.lootStackId=choice.id;
      entry.root.setAttribute('aria-label',`${choice.item.title}, ${choice.quantity} items, 1 carry slot; ${choice.selected?'selected':'not selected'}${choice.disabledReason?`; ${choice.disabledReason}`:''}`);
      entry.root.setAttribute('aria-checked',String(choice.selected));
      entry.root.setAttribute('aria-disabled',String(!choice.canToggle));
      entry.root.title=choice.disabledReason??(choice.selected?'Click to leave behind':'Click to take');
      elements.push(entry.root);
    }
    lootList.replaceChildren(...elements);
    lootList.scrollLeft=scrollLeft;
  }
  function renderPrisoners():void {
    const scrollLeft=prisonerList.scrollLeft;
    const keep=new Set(model.prisoners.map(prisoner=>prisoner.id));
    for(const [id,node] of prisonerNodes)if(!keep.has(id)){node.remove();prisonerNodes.delete(id);}
    const elements:HTMLElement[]=[];
    for(const prisoner of model.prisoners){
      let node=prisonerNodes.get(prisoner.id);
      if(!node){
        node=document.createElement('div');
        node.className='dt-raid__tile-slot dt-raid__character dt-raid__character--prisoner';
        node.innerHTML='<article class="dt-minion"><div class="dt-minion__portrait"><img class="dt-minion__portrait-texture" alt="Anonymous hooded prisoner"></div><span class="dt-minion__rank"></span></article>';
        prisonerNodes.set(prisoner.id,node);
      }
      const portrait=node.querySelector<HTMLImageElement>('img')!;
      if(portrait.getAttribute('src')!==prisoner.portraitSrc)portrait.src=prisoner.portraitSrc;
      const rank=node.querySelector<HTMLElement>('.dt-minion__rank')!;
      rank.textContent=prisoner.rankLabel;
      rank.title=prisoner.rankTooltip;
      node.setAttribute('aria-label',`Prisoner, ${prisoner.rankTooltip}`);
      elements.push(node);
    }
    prisonerList.replaceChildren(...elements);
    prisonerList.scrollLeft=scrollLeft;
    prisonerList.classList.toggle('dt-raid__horizontal-scroll--empty',elements.length===0);
    if(!elements.length){const note=document.createElement('p');note.className='dt-raid__empty';note.textContent='No prisoners';prisonerList.append(note);}
  }
  function renderMinions():void {
    const collection=model.minions;
    const list=minionList;
    const store=minionNodes;
    const scrollLeft=list.scrollLeft;
    const keep=new Set(collection.map(m=>m.id));
    for(const [key,entry] of store){if(!keep.has(key)){entry.tile.destroy();entry.root.remove();store.delete(key);}}
    const elements:HTMLElement[]=[];
    for(const character of collection){
      let entry=store.get(character.id);
      if(!entry){
        const wrapper=document.createElement('div');
        wrapper.className=`dt-raid__tile-slot dt-raid__character dt-raid__character--minion`;
        const tile=mountMinionComponent(wrapper,character,action=>{if(action.type==='infoRequested')dispatch({type:'characterInfoRequested',characterId:action.minionId});});
        entry={root:wrapper,tile};store.set(character.id,entry);
      }
      entry.tile.setModel(character);
      elements.push(entry.root);
    }
    list.replaceChildren(...elements);
    list.scrollLeft=scrollLeft;
    list.classList.toggle('dt-raid__horizontal-scroll--empty',elements.length===0);
    if(elements.length===0){const note=document.createElement('p');note.className='dt-raid__empty';note.textContent='No minions participated';list.append(note);}
  }
  function setModel(next:Readonly<RaidReportViewModel>):void {
    if(destroyed)return;
    model=next;
    get('.dt-raid__location-title').textContent=next.location.title;
    get('.dt-raid__location-description').textContent=next.location.description;
    get('.dt-raid__difficulty').textContent=next.location.difficultyIcon;
    get('.dt-raid__difficulty').title=next.location.difficultyLabel;
    get('.dt-raid__weather').textContent=next.location.weatherIcon;
    get('.dt-raid__weather').title=next.location.weatherLabel;
    locImage.alt=next.location.title;
    if(locImage.getAttribute('src')!==next.location.imageUrl)locImage.src=next.location.imageUrl;
    get('.dt-raid__result-label').textContent=next.location.resultLabel;
    get('.dt-raid__result-label').dataset.result=next.location.result;
    get('.dt-raid__duration').textContent=next.location.elapsedLabel;
    get('.dt-raid__squad').textContent=next.location.squadLabel;
    get('.dt-raid__odds-row').hidden=!next.location.victoryChanceLabel;
    get('.dt-raid__odds').textContent=next.location.victoryChanceLabel??'';
    get('.dt-raid__defenders').textContent=next.defenderResultLabel;
    get('.dt-raid__recovery').textContent=next.recoveryLabel;
    get('.dt-raid__injury-summary').textContent=next.injurySummary;
    get('.dt-raid__selection-count').textContent=next.selection.selectedCountLabel;
    get('.dt-raid__loot-note').textContent=next.selection.hint;
    get('.dt-raid__prisoner-count').textContent=String(next.prisoners.length);
    get('.dt-raid__minion-count').textContent=String(next.minions.length);
    get('.dt-raid__pause-label').textContent=next.pauseLabel;
    get('.dt-raid__claim-summary').textContent=next.selection.capacityLabel;
    const currencies=get('.dt-raid__currencies');
    currencies.replaceChildren(...next.currencies.map(currency=>{
      const cell=document.createElement('div');cell.className='dt-raid__currency';
      const icon=document.createElement('span');icon.className='dt-raid__currency-icon';icon.textContent=currency.icon;
      const name=document.createElement('span');name.textContent=currency.label;
      const amount=document.createElement('strong');amount.textContent=currency.amountLabel;
      cell.append(icon,name,amount);return cell;
    }));
    renderLoot();renderPrisoners();renderMinions();
    claim.textContent=next.claim.label;
    claim.disabled=!next.claim.canClaim;
    claim.title=next.claim.disabledReason??'';
  }
  host.replaceChildren(root);setModel(initialModel);
  return {setModel,destroy(){if(destroyed)return;destroyed=true;abort.abort();for(const value of lootNodes.values()){value.tile.destroy();value.abort.abort();}for(const value of minionNodes.values())value.tile.destroy();lootNodes.clear();prisonerNodes.clear();minionNodes.clear();root.remove();}};
}
