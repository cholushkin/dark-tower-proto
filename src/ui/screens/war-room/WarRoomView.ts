import { mountRoomSummary } from '../../components/RoomSummary/RoomSummary';
import { mountMinionComponent } from '../../components/MinionComponent/MinionComponent';
import type { MinionComponentHandle } from '../../components/MinionComponent/MinionComponent.types';
import { mountMissionPin } from '../../components/MissionPin/MissionPin';
import type { MissionPinHandle } from '../../components/MissionPin/MissionPin.types';
import type { WarRoomActionHandler, WarRoomViewHandle, WarRoomViewModel } from './WarRoomViewModel';
import './WarRoomView.css';

interface Mounted<T> { host: HTMLElement; handle: T }

/** Presentation-only War Room. Does not launch raids or alter roster, time, currencies, or mission progress. */
export function mountWarRoomView(host: HTMLElement, initial: Readonly<WarRoomViewModel>, onAction: WarRoomActionHandler): WarRoomViewHandle {
  const abort = new AbortController();
  let disposed = false;
  let current = initial;
  const root = document.createElement('main');
  root.className = 'dt-warroom';
  root.innerHTML = `<div class="dt-warroom__window">
    <div class="dt-room-summary-host"></div>
    <section class="dt-warroom__map-area" aria-label="World map with missions">
      <div class="dt-warroom__map-viewport" tabindex="0" aria-label="Scrollable world map — select a mission pin">
        <div class="dt-warroom__map-stage">
          <img class="dt-warroom__map-art" alt="" draggable="false" />
          <div class="dt-warroom__mission-pins"></div>
        </div>
      </div>
      <div class="dt-warroom__world-name"></div>
      <div class="dt-warroom__map-coordinates" hidden></div>
    </section>
    <section class="dt-warroom__planning" aria-label="Selected mission and raid planning" hidden>
      <div class="dt-warroom__mission-info">
        <div class="dt-warroom__location">
          <img class="dt-warroom__location-art" alt="" />
          <button class="dt-warroom__location-info" type="button" title="Mission information" aria-label="Mission information">i</button>
          <div class="dt-warroom__location-bottom"><div class="dt-warroom__location-name"></div></div>
        </div>
        <div class="dt-warroom__raid-block">
          <ul class="dt-warroom__parameters" aria-label="Mission parameters"></ul>
          <div class="dt-warroom__raid-active" hidden><div class="dt-warroom__raid-active-label"></div><div class="dt-warroom__raid-active-track"><span></span></div><div class="dt-warroom__raid-active-remaining"></div></div>
        </div>
        <div class="dt-warroom__reward-block" role="group" aria-label="Reward estimation"><div class="dt-warroom__rewards"></div></div>
        <div class="dt-warroom__tray">
          <div class="dt-warroom__tray-viewport" aria-label="Minions available for raid assignment" tabindex="0"><div class="dt-warroom__minion-track" role="listbox" aria-label="Select minions" aria-multiselectable="true"></div></div>
        </div>
        <button class="dt-warroom__raid-button" type="button" aria-label="Launch selected raid"><span class="dt-warroom__raid-icon" aria-hidden="true">⚔️</span><strong>Raid!</strong></button>
      </div>
      <div class="dt-warroom__village-status"><span class="dt-warroom__availability"></span><span class="dt-warroom__recovery"></span></div>
    </section>
  </div>`;
  const get = <T extends Element>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`WarRoomView missing ${selector}`);
    return element;
  };
  const pinHost = get<HTMLElement>('.dt-warroom__mission-pins');
  const mapViewport = get<HTMLElement>('.dt-warroom__map-viewport');
  const worldName = get<HTMLElement>('.dt-warroom__world-name');
  const mapStage = get<HTMLElement>('.dt-warroom__map-stage');
  const mapCoordinates = get<HTMLElement>('.dt-warroom__map-coordinates');
  let mapPointer: { x: number; y: number } | null = null;
  const refreshMapCoordinates = () => {
    mapCoordinates.hidden = !current.showMapCoordinates || !mapPointer;
    if (mapCoordinates.hidden || !mapPointer) return;
    const bounds = mapStage.getBoundingClientRect();
    const percent = (position: number, start: number, size: number) =>
      Math.min(100, Math.max(0, (position - start) / size * 100)).toFixed(1);
    mapCoordinates.textContent = `X: ${percent(mapPointer.x, bounds.left, bounds.width)}%  Y: ${percent(mapPointer.y, bounds.top, bounds.height)}%`;
  };
  mapViewport.addEventListener('pointermove', event => {
    mapPointer = { x: event.clientX, y: event.clientY };
    refreshMapCoordinates();
  }, { signal: abort.signal });
  const clearMapPointer = () => { mapPointer = null; refreshMapCoordinates(); };
  mapViewport.addEventListener('pointerleave', clearMapPointer, { signal: abort.signal });
  mapViewport.addEventListener('pointercancel', clearMapPointer, { signal: abort.signal });
  mapViewport.addEventListener('scroll', refreshMapCoordinates, { signal: abort.signal, passive: true });
  window.addEventListener('resize', refreshMapCoordinates, { signal: abort.signal });
  const planning = get<HTMLElement>('.dt-warroom__planning');
  const missionInfo = get<HTMLElement>('.dt-warroom__mission-info');
  const locationImg = get<HTMLImageElement>('.dt-warroom__location-art');
  const locationName = get<HTMLElement>('.dt-warroom__location-name');
  const locationInfo = get<HTMLButtonElement>('.dt-warroom__location-info');
  const rewardHost = get<HTMLElement>('.dt-warroom__rewards');
  const parameters = get<HTMLElement>('.dt-warroom__parameters');
  const rewardBlock = get<HTMLElement>('.dt-warroom__reward-block');
  const activeProgress = get<HTMLElement>('.dt-warroom__raid-active');
  const activeLabel = get<HTMLElement>('.dt-warroom__raid-active-label');
  const activeBar = get<HTMLElement>('.dt-warroom__raid-active-track span');
  const activeRemaining = get<HTMLElement>('.dt-warroom__raid-active-remaining');
  const raidButton = get<HTMLButtonElement>('.dt-warroom__raid-button');
  const minionTray = get<HTMLElement>('.dt-warroom__tray');
  const minionTrack = get<HTMLElement>('.dt-warroom__minion-track');

  const room = mountRoomSummary(root.querySelector<HTMLElement>('.dt-room-summary-host')!, initial.room, initial.upgrades, upgradeId => onAction({ type: 'upgradeRequested', upgradeId }));
  const pins = new Map<string, Mounted<MissionPinHandle>>();
  const minions = new Map<string, Mounted<MinionComponentHandle>>();

  locationInfo.addEventListener('click', () => {
    if (current.selectedMissionId) onAction({type:'missionInfoRequested',missionId:current.selectedMissionId});
  }, {signal:abort.signal});
  raidButton.addEventListener('click', () => {
    if (current.selectedMission?.canRaid && current.selectedMissionId) onAction({type:'raidRequested',missionId:current.selectedMissionId});
  }, {signal:abort.signal});
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && current.selectedMissionId) onAction({type:'missionClosed'});
  }, {signal:abort.signal});

  // Presentation-only map dragging. No zoom chrome or instructional message.
  let dragging: {id:number;x:number;y:number;left:number;top:number;moved:boolean}|null = null;
  mapViewport.addEventListener('pointerdown', (event:PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('.dt-mission-pin')) return;
    dragging = {id:event.pointerId,x:event.clientX,y:event.clientY,left:mapViewport.scrollLeft,top:mapViewport.scrollTop,moved:false};
    mapViewport.setPointerCapture(event.pointerId);
    mapViewport.classList.add('dt-warroom__map-viewport--dragging');
  }, {signal:abort.signal});
  mapViewport.addEventListener('pointermove', (event:PointerEvent) => {
    if (!dragging || event.pointerId !== dragging.id) return;
    if (Math.hypot(event.clientX-dragging.x,event.clientY-dragging.y)>5) dragging.moved=true;
    mapViewport.scrollLeft = dragging.left + (dragging.x-event.clientX);
    mapViewport.scrollTop = dragging.top + (dragging.y-event.clientY);
  }, {signal:abort.signal});
  const finishDrag = () => {dragging=null;mapViewport.classList.remove('dt-warroom__map-viewport--dragging');};
  mapViewport.addEventListener('pointerup', (event:PointerEvent) => {
    const dismiss = dragging && event.pointerId === dragging.id && !dragging.moved && Math.hypot(event.clientX-dragging.x,event.clientY-dragging.y)<=5;
    finishDrag();
    if (dismiss && current.selectedMissionId) onAction({type:'missionClosed'});
  }, {signal:abort.signal});
  mapViewport.addEventListener('pointercancel', finishDrag, {signal:abort.signal});
  mapViewport.addEventListener('lostpointercapture', finishDrag, {signal:abort.signal});

  let mapPositionInitialized = false;
  let rewardSignature = '';
  function setModel(model: Readonly<WarRoomViewModel>): void {
    if (disposed) return;
    current = model;
    refreshMapCoordinates();
    const mapArt = root.querySelector<HTMLImageElement>('.dt-warroom__map-art')!;
    if (mapArt.getAttribute('src') !== model.mapImageSrc) mapArt.src = model.mapImageSrc;
    mapArt.alt = model.mapImageAlt;
    worldName.textContent = model.worldName;
    room.setModel(model.room, model.upgrades);

    const activeMissions = new Set(model.missions.map(m=>m.id));
    for (const [id,entry] of pins) if (!activeMissions.has(id)) {entry.handle.destroy();entry.host.remove();pins.delete(id);}
    const pinHosts: HTMLElement[]=[];
    for (const mission of model.missions) {
      let entry=pins.get(mission.id);
      if (!entry) {const slot=document.createElement('div');entry={host:slot,handle:mountMissionPin(slot,mission,id=>onAction({type:'missionSelected',missionId:id}))};pins.set(mission.id,entry);}
      else entry.handle.setModel(mission);
      pinHosts.push(entry.host);
    }
    if (pinHost.childElementCount!==pinHosts.length || pinHosts.some((node,i)=>pinHost.children[i]!==node)) pinHost.replaceChildren(...pinHosts);
    const mission=model.selectedMission;
    planning.hidden=!mission;
    missionInfo.hidden=!mission;
    minionTray.hidden=!mission;
    if (mission) {
      locationImg.src=mission.locationImageSrc;locationImg.alt=mission.locationImageAlt;
      locationName.textContent=mission.name;
      locationInfo.title=mission.description;
      get<HTMLElement>('.dt-warroom__availability').textContent=mission.statusLabel;
      get<HTMLElement>('.dt-warroom__recovery').textContent=mission.recoveryLabel;
      rewardBlock.setAttribute('aria-label', `Reward estimation: ${mission.rewardIntelLabel}`);
      rewardBlock.title=mission.rewardIntelLabel;
      const nextRewardSignature = JSON.stringify(mission.rewards);
      if (nextRewardSignature !== rewardSignature) {
        rewardSignature = nextRewardSignature;
        rewardHost.replaceChildren(...mission.rewards.map(reward=>{
        const node=document.createElement('div');node.className='dt-warroom__reward';node.title=reward.label;node.tabIndex=0;node.setAttribute('aria-label',reward.label);
        const art=document.createElement('span');art.className='dt-warroom__reward-icon';if(reward.icon.kind==='texture'){
          const image=document.createElement('img');image.src=reward.icon.src;image.alt=reward.icon.alt;
          const fallback=reward.icon.fallbackEmoji??'📦';
          image.addEventListener('error',()=>{art.textContent=fallback;},{once:true});
          art.append(image);
        }else art.textContent=reward.icon.value;
        const chance=document.createElement('span');chance.textContent=reward.chanceLabel;
        node.append(art,chance);return node;
        }));
      }
      // Keep parameter nodes stable across ticks so keyboard focus and hover persist.
      for (const node of Array.from(parameters.children)) {
        if (!mission.parameters.some(p => p.id === (node as HTMLElement).dataset.parameterId)) node.remove();
      }
      for (const parameter of mission.parameters) {
        let row = parameters.querySelector<HTMLElement>(`[data-parameter-id="${parameter.id}"]`);
        if (!row) {
          row=document.createElement('li');row.className='dt-warroom__parameter';row.tabIndex=0;
          row.dataset.parameterId=parameter.id;
          const icon=document.createElement('span');icon.className='dt-warroom__parameter-icon';icon.setAttribute('aria-hidden','true');
          const value=document.createElement('span');value.className='dt-warroom__parameter-value';
          const tip=document.createElement('span');tip.className='dt-warroom__parameter-tooltip';tip.id=`mission-parameter-${parameter.id}`;tip.setAttribute('role','tooltip');
          row.setAttribute('aria-describedby',tip.id);row.append(icon,value,tip);parameters.append(row);
        }
        row.title=parameter.description;
        row.querySelector('.dt-warroom__parameter-icon')!.textContent=parameter.icon;
        row.querySelector('.dt-warroom__parameter-value')!.textContent=parameter.value;
        row.querySelector('.dt-warroom__parameter-tooltip')!.textContent=parameter.description;
      }
      const ongoing=mission.state==='inProgress';
      const reportReady=mission.state==='reportReady';
      activeProgress.hidden=!ongoing;
      activeLabel.textContent=mission.statusLabel;
      activeBar.style.width=`${Math.max(0,Math.min(100,(mission.activeProgress??0)*100))}%`;
      activeRemaining.textContent=mission.activeRemainingTime??'';
      raidButton.disabled=!mission.canRaid;
      raidButton.setAttribute('aria-label',reportReady?'View Report':'Launch selected raid');
      raidButton.title=mission.canRaid?(reportReady?'Open raid report':'Launch raid'):mission.raidDisabledReason??mission.statusLabel;
      raidButton.classList.toggle('dt-warroom__raid-button--running',ongoing);
      raidButton.querySelector<HTMLElement>('strong')!.textContent=ongoing?'Active':mission.state==='locked'?'Locked':reportReady?'View Report':mission.state==='completed'?'Next Week':'Raid!';
      minionTrack.setAttribute('aria-label',`Assign minions: ${mission.squadSelectionLabel}`);
    }
    const activeMinions=new Set(model.minions.map(x=>x.minion.id));
    for (const [id,entry] of minions) if (!activeMinions.has(id)) {entry.handle.destroy();entry.host.remove();minions.delete(id);}
    const minionHosts:HTMLElement[]=[];
    for (const entryModel of model.minions) {
      const m=entryModel.minion;
      let entry=minions.get(m.id);
      if (!entry) {
        const slot=document.createElement('div');slot.className='dt-warroom__minion-slot';
        slot.tabIndex=0;slot.setAttribute('role','option');slot.dataset.minionId=m.id;
        slot.addEventListener('click',(event)=>{
          if ((event.target as HTMLElement).closest('.dt-minion__info')) return;
          if (current.selectedMissionId && current.selectedMission?.canEditSquad && current.minions.find(x=>x.minion.id===m.id)?.selectable)
            onAction({type:'minionSelectionRequested',missionId:current.selectedMissionId,minionId:m.id});
        },{signal:abort.signal});
        slot.addEventListener('keydown',(event)=>{
          if ((event.key==='Enter'||event.key===' ') && event.target===slot){event.preventDefault();slot.click();}
        },{signal:abort.signal});
        const cardHost=document.createElement('div');slot.append(cardHost);
        entry={host:slot,handle:mountMinionComponent(cardHost,m,action=>onAction({type:'minionInfoRequested',minionId:action.minionId}))};minions.set(m.id,entry);
      } else entry.handle.setModel(m);
      entry.host.classList.toggle('dt-warroom__minion-slot--selected',entryModel.selected);
      entry.host.classList.toggle('dt-warroom__minion-slot--disabled',!entryModel.selectable);
      entry.host.setAttribute('aria-selected',String(entryModel.selected));
      entry.host.setAttribute('aria-label',`${m.name}, ${m.rank.label}, ${entryModel.selected?'assigned':'not assigned'}${entryModel.unavailableReason?', '+entryModel.unavailableReason:''}`);
      entry.host.title=entryModel.unavailableReason??'';
      minionHosts.push(entry.host);
    }
    if (minionTrack.childElementCount!==minionHosts.length || minionHosts.some((node,i)=>minionTrack.children[i]!==node)) minionTrack.replaceChildren(...minionHosts);
    if (!mapPositionInitialized) {
      mapPositionInitialized=true;
      requestAnimationFrame(()=>{
        if (disposed) return;
        mapViewport.scrollLeft=Math.max(0,(mapViewport.scrollWidth-mapViewport.clientWidth)/2);
        mapViewport.scrollTop=Math.max(0,(mapViewport.scrollHeight-mapViewport.clientHeight)/2);
      });
    }
  }
  host.replaceChildren(root);
  setModel(initial);
  return {setModel,destroy(){if(disposed)return;disposed=true;abort.abort();room.destroy();for(const x of pins.values())x.handle.destroy();for(const x of minions.values())x.handle.destroy();pins.clear();minions.clear();root.remove();}};
}
