import { mountMinionComponent } from '../../components/MinionComponent/MinionComponent';
import type { MinionComponentHandle } from '../../components/MinionComponent/MinionComponent.types';
import { mountRoomSummary } from '../../components/RoomSummary/RoomSummary';
import { mountTrainingStation } from '../../components/TrainingStation/TrainingStation';
import type { TrainingStationHandle } from '../../components/TrainingStation/TrainingStation.types';
import { mountAssignmentPicker } from '../../components/AssignmentPicker/AssignmentPicker';
import type { AssignmentPickerHandle } from '../../components/AssignmentPicker/AssignmentPicker.types';
import type { TrainingHallActionHandler, TrainingHallViewHandle, TrainingHallViewModel } from './TrainingHallViewModel';
import './TrainingHallView.css';
import '../../components/RoomSlot.css';

interface Mounted<T>{ host:HTMLElement; handle:T }
/** Reusable screen composition; no game rules or simulated time in the View. */
export function mountTrainingHallView(host:HTMLElement, initial:Readonly<TrainingHallViewModel>, onAction:TrainingHallActionHandler):TrainingHallViewHandle{
 const abort=new AbortController();
 const root=document.createElement('main');root.className='dt-training-hall';
 root.innerHTML=`
 <div class="dt-training-hall__mountains" aria-hidden="true"></div>
 <div class="dt-training-hall__shell"><section class="dt-training-hall__window" aria-label="Training Hall window">
   <div class="dt-room-summary-host"></div>
   <section class="dt-training-hall__stations-section" aria-label="Training stations">
     <div class="dt-training-hall__stations-topline"><span class="dt-training-hall__stations-title"></span><span class="dt-training-hall__stations-count"></span></div>
     <div class="dt-training-hall__stations-viewport" tabindex="0" aria-label="Scrollable training stations"><div class="dt-training-hall__stations-grid"></div>
       <div class="dt-training-hall__no-stations" role="status" hidden><span>⚔️</span><strong>No stations available</strong><p></p></div>
     </div>
   </section>
 <section class="dt-training-hall__roster-section" aria-label="Minion roster"><h2>Minion Roster</h2><div class="dt-training-hall__roster"></div></section>
 </section></div><div class="dt-training-hall__picker-host"></div>`;
 const required=<T extends Element=HTMLElement>(selector:string):T=>{const el=root.querySelector<T>(selector);if(!el)throw new Error(`TrainingHallView missing ${selector}`);return el;};
  const room = mountRoomSummary(root.querySelector<HTMLElement>('.dt-room-summary-host')!, initial.room, initial.upgrades, upgradeId => onAction({ type: 'upgradeRequested', upgradeId }));
 const stationsViewport=required<HTMLElement>('.dt-training-hall__stations-viewport');
 const stationGrid=required<HTMLElement>('.dt-training-hall__stations-grid');
 const noStations=required<HTMLElement>('.dt-training-hall__no-stations');
 const pickerHost=required<HTMLElement>('.dt-training-hall__picker-host');
 const stations=new Map<string,Mounted<TrainingStationHandle>>();
 let picker:AssignmentPickerHandle|undefined;
 let selectedStationId:string|undefined;
 const roster = new Map<string, {host:HTMLElement; handle:MinionComponentHandle; button:HTMLButtonElement}>();
 let disposed=false;
 function setModel(model:Readonly<TrainingHallViewModel>){
  if(disposed)return;
  room.setModel(model.room, model.upgrades);
  required<HTMLElement>('.dt-training-hall__stations-title').textContent=model.stationsCaption;
  required<HTMLElement>('.dt-training-hall__stations-count').textContent=model.countCaption;
  required<HTMLElement>('.dt-training-hall__no-stations p').textContent=model.emptyMessage;
  root.classList.toggle('dt-training-hall--busy',!!model.busy);

  const stationIds=new Set(model.stations.map(s=>s.id));
  for(const [id,item] of stations)if(!stationIds.has(id)){item.handle.destroy();stations.delete(id);}
  const orderedStations:HTMLElement[]=[];
  for(const data of model.stations){
   let item=stations.get(data.id);
   if(!item){const slot=document.createElement('div');slot.className='dt-training-hall__station-slot';item={host:slot,handle:mountTrainingStation(slot,data,action=>onAction(action))};stations.set(data.id,item);}
   else item.handle.setModel(data);
   orderedStations.push(item.host);
  }
  const previousScroll=stationsViewport.scrollTop;
  if(stationGrid.childElementCount!==orderedStations.length||orderedStations.some((el,i)=>stationGrid.children[i]!==el))stationGrid.replaceChildren(...orderedStations);
  stationsViewport.scrollTop=previousScroll;
  stationGrid.hidden=model.stations.length===0;noStations.hidden=model.stations.length!==0;
  const rosterIds=new Set(model.roster.map(entry=>entry.card.id));
  for(const [id,item] of roster) if(!rosterIds.has(id)){item.handle.destroy();item.host.remove();roster.delete(id);}
  const orderedRoster:HTMLElement[]=[];
  for(const entry of model.roster){
   let item=roster.get(entry.card.id);
   if(!item){
    const slot=document.createElement('div');const cardHost=document.createElement('div');const button=document.createElement('button');
    button.type='button';button.className='dt-training-hall__train';
    button.addEventListener('click',()=>onAction({type:'trainRequested',minionId:entry.card.id}),{signal:abort.signal});
    slot.append(cardHost,button);item={host:slot,handle:mountMinionComponent(cardHost,entry.card),button};roster.set(entry.card.id,item);
   }else item.handle.setModel(entry.card);
   item.button.textContent=entry.trainLabel;item.button.disabled=!entry.canTrain;item.button.title=entry.disabledReason??'Assign a free training station';
   orderedRoster.push(item.host);
  }
  const rosterGrid=required<HTMLElement>('.dt-training-hall__roster');
  if(rosterGrid.childElementCount!==orderedRoster.length||orderedRoster.some((el,i)=>rosterGrid.children[i]!==el))rosterGrid.replaceChildren(...orderedRoster);
  if(!model.assignmentPicker){picker?.destroy();picker=undefined;selectedStationId=undefined;}
  else{
   // Stable selection is carried by the caller in the picker subtitle? The View records only the clicked station id in local presentation state.
   // But assigning is game-relevant, so that id must be supplied by the host, not inferred here.
   if(!model.assignmentStationId)throw new Error('assignmentStationId required while picker is visible');
   selectedStationId=model.assignmentStationId;
   if(picker)picker.setModel(model.assignmentPicker);
   else picker=mountAssignmentPicker(pickerHost,model.assignmentPicker,minionId=>onAction({type:'assignRequested',stationId:selectedStationId!,minionId}),()=>onAction({type:'assignmentCancelled'}));
  }
 }
 host.replaceChildren(root);setModel(initial);
 return {setModel,destroy(){if(disposed)return;disposed=true;abort.abort();picker?.destroy();room.destroy();for(const item of stations.values())item.handle.destroy();stations.clear();for(const item of roster.values())item.handle.destroy();roster.clear();root.remove();}};
}
