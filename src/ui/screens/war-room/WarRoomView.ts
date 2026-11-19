import { mountMinionComponent } from '../../components/MinionComponent/MinionComponent';
import type { MinionComponentHandle } from '../../components/MinionComponent/MinionComponent.types';
import { mountRoomOverviewCard } from '../../components/RoomOverviewCard/RoomOverviewCard';
import { mountUpgradeCard } from '../../components/UpgradeCard/UpgradeCard';
import type { UpgradeCardHandle } from '../../components/UpgradeCard/UpgradeCard.types';
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
    <section class="dt-warroom__upper" aria-label="War Room summary and upgrades">
      <div class="dt-warroom__room"></div>
      <div class="dt-warroom__upgrade-shell">
        <button class="dt-warroom__arrow dt-warroom__arrow--left" type="button" aria-label="Previous upgrades">‹</button>
        <div class="dt-warroom__upgrade-viewport" tabindex="0" aria-label="Scrollable War Room upgrades"><div class="dt-warroom__upgrade-track"></div></div>
        <button class="dt-warroom__arrow dt-warroom__arrow--right" type="button" aria-label="Next upgrades">›</button>
      </div>
    </section>
    <section class="dt-warroom__map-area" aria-label="World map with missions">
      <div class="dt-warroom__map-viewport" tabindex="0" aria-label="Scrollable world map — select a mission pin">
        <div class="dt-warroom__map-stage">
          <img class="dt-warroom__map-art" alt="" draggable="false" />
          <div class="dt-warroom__mission-pins"></div>
        </div>
      </div>
    </section>
    <section class="dt-warroom__planning" aria-label="Selected mission and raid planning">
      <div class="dt-warroom__mission-empty" hidden>Select a mission on the world map to see its details.</div>
      <div class="dt-warroom__mission-info">
        <div class="dt-warroom__location">
          <img class="dt-warroom__location-art" alt="" />
          <button class="dt-warroom__location-info" type="button" title="Mission information" aria-label="Mission information">i</button>
          <span class="dt-warroom__weather" title="Weather" aria-label="Weather"></span>
          <div class="dt-warroom__location-bottom"><div class="dt-warroom__location-name"></div><div class="dt-warroom__location-difficulty"></div></div>
        </div>
        <div class="dt-warroom__reward-block"><div class="dt-warroom__section-kicker">Rewards · estimated chances</div><div class="dt-warroom__rewards"></div></div>
        <div class="dt-warroom__squad-block"><div class="dt-warroom__section-kicker">Squad size</div><div class="dt-warroom__squad-size"></div><div class="dt-warroom__squad-selected"></div></div>
        <div class="dt-warroom__raid-block">
          <div class="dt-warroom__section-kicker dt-warroom__raid-heading">Raid summary</div>
          <div class="dt-warroom__raid-duration"></div><div class="dt-warroom__raid-fatigue"></div><div class="dt-warroom__raid-success"></div>
          <div class="dt-warroom__raid-active" hidden><div class="dt-warroom__raid-active-label"></div><div class="dt-warroom__raid-active-track"><span></span></div><div class="dt-warroom__raid-active-remaining"></div></div>
        </div>
        <button class="dt-warroom__raid-button" type="button" aria-label="Launch selected raid"><span class="dt-warroom__raid-icon" aria-hidden="true">⚔️</span><strong>Raid!</strong></button>
      </div>
      <div class="dt-warroom__tray">
        <button class="dt-warroom__tray-toggle" type="button" aria-expanded="true"><span class="dt-warroom__tray-title">Assign Minions</span><span class="dt-warroom__tray-count"></span><span class="dt-warroom__tray-chevron">⌄</span></button>
        <div class="dt-warroom__tray-viewport" aria-label="Minions available for raid assignment" tabindex="0"><div class="dt-warroom__minion-track" role="listbox" aria-label="Select minions" aria-multiselectable="true"></div></div>
      </div>
    </section>
  </div>`;
  const get = <T extends Element>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`WarRoomView missing ${selector}`);
    return element;
  };
  const upgradeViewport = get<HTMLElement>('.dt-warroom__upgrade-viewport');
  const upgradeTrack = get<HTMLElement>('.dt-warroom__upgrade-track');
  const prevUpgrade = get<HTMLButtonElement>('.dt-warroom__arrow--left');
  const nextUpgrade = get<HTMLButtonElement>('.dt-warroom__arrow--right');
  const pinHost = get<HTMLElement>('.dt-warroom__mission-pins');
  const mapViewport = get<HTMLElement>('.dt-warroom__map-viewport');
  const empty = get<HTMLElement>('.dt-warroom__mission-empty');
  const missionInfo = get<HTMLElement>('.dt-warroom__mission-info');
  const locationImg = get<HTMLImageElement>('.dt-warroom__location-art');
  const locationName = get<HTMLElement>('.dt-warroom__location-name');
  const locationDifficulty = get<HTMLElement>('.dt-warroom__location-difficulty');
  const weather = get<HTMLElement>('.dt-warroom__weather');
  const locationInfo = get<HTMLButtonElement>('.dt-warroom__location-info');
  const rewardHost = get<HTMLElement>('.dt-warroom__rewards');
  const squadSize = get<HTMLElement>('.dt-warroom__squad-size');
  const squadSelected = get<HTMLElement>('.dt-warroom__squad-selected');
  const duration = get<HTMLElement>('.dt-warroom__raid-duration');
  const fatigue = get<HTMLElement>('.dt-warroom__raid-fatigue');
  const successEstimate = get<HTMLElement>('.dt-warroom__raid-success');
  const activeProgress = get<HTMLElement>('.dt-warroom__raid-active');
  const activeLabel = get<HTMLElement>('.dt-warroom__raid-active-label');
  const activeBar = get<HTMLElement>('.dt-warroom__raid-active-track span');
  const activeRemaining = get<HTMLElement>('.dt-warroom__raid-active-remaining');
  const raidButton = get<HTMLButtonElement>('.dt-warroom__raid-button');
  const raidHeading = get<HTMLElement>('.dt-warroom__raid-heading');
  const minionTray = get<HTMLElement>('.dt-warroom__tray');
  const minionToggle = get<HTMLButtonElement>('.dt-warroom__tray-toggle');
  const minionCount = get<HTMLElement>('.dt-warroom__tray-count');
  const minionTrack = get<HTMLElement>('.dt-warroom__minion-track');

  const room = mountRoomOverviewCard(get<HTMLElement>('.dt-warroom__room'), initial.room, {variant:'embedded'});
  const upgrades = new Map<string, Mounted<UpgradeCardHandle>>();
  const pins = new Map<string, Mounted<MissionPinHandle>>();
  const minions = new Map<string, Mounted<MinionComponentHandle>>();

  const scrollUpgrades = (direction: number) => upgradeViewport.scrollBy({left:direction * 380,behavior:'smooth'});
  prevUpgrade.addEventListener('click', () => scrollUpgrades(-1), {signal:abort.signal});
  nextUpgrade.addEventListener('click', () => scrollUpgrades(1), {signal:abort.signal});
  const refreshArrows = () => {
    prevUpgrade.disabled = upgradeViewport.scrollLeft <= 2;
    nextUpgrade.disabled = upgradeViewport.scrollLeft + upgradeViewport.clientWidth >= upgradeViewport.scrollWidth - 2;
  };
  upgradeViewport.addEventListener('scroll', refreshArrows, {signal:abort.signal, passive:true});
  window.addEventListener('resize', refreshArrows, {signal:abort.signal});

  locationInfo.addEventListener('click', () => {
    if (current.selectedMissionId) onAction({type:'missionInfoRequested',missionId:current.selectedMissionId});
  }, {signal:abort.signal});
  raidButton.addEventListener('click', () => {
    if (current.selectedMission?.canRaid && current.selectedMissionId) onAction({type:'raidRequested',missionId:current.selectedMissionId});
  }, {signal:abort.signal});
  minionToggle.addEventListener('click', () => onAction({type:'minionTrayToggled',expanded:!current.minionsExpanded}), {signal:abort.signal});

  // Presentation-only map dragging. No zoom chrome or instructional message.
  let dragging: {id:number;x:number;y:number;left:number;top:number}|null = null;
  mapViewport.addEventListener('pointerdown', (event:PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('.dt-mission-pin')) return;
    dragging = {id:event.pointerId,x:event.clientX,y:event.clientY,left:mapViewport.scrollLeft,top:mapViewport.scrollTop};
    mapViewport.setPointerCapture(event.pointerId);
    mapViewport.classList.add('dt-warroom__map-viewport--dragging');
  }, {signal:abort.signal});
  mapViewport.addEventListener('pointermove', (event:PointerEvent) => {
    if (!dragging || event.pointerId !== dragging.id) return;
    mapViewport.scrollLeft = dragging.left + (dragging.x-event.clientX);
    mapViewport.scrollTop = dragging.top + (dragging.y-event.clientY);
  }, {signal:abort.signal});
  const finishDrag = () => {dragging=null;mapViewport.classList.remove('dt-warroom__map-viewport--dragging');};
  mapViewport.addEventListener('pointerup', finishDrag, {signal:abort.signal});
  mapViewport.addEventListener('pointercancel', finishDrag, {signal:abort.signal});
  mapViewport.addEventListener('lostpointercapture', finishDrag, {signal:abort.signal});

  let mapPositionInitialized = false;
  function setModel(model: Readonly<WarRoomViewModel>): void {
    if (disposed) return;
    current = model;
    const mapArt = root.querySelector<HTMLImageElement>('.dt-warroom__map-art')!;
    if (mapArt.getAttribute('src') !== model.mapImageSrc) mapArt.src = model.mapImageSrc;
    mapArt.alt = model.mapImageAlt;
    room.setModel(model.room);
    const activeUpgrades = new Set(model.upgrades.map(u => u.id));
    for (const [id, entry] of upgrades) if (!activeUpgrades.has(id)) {entry.handle.destroy();entry.host.remove();upgrades.delete(id);}
    const upgradeHosts:HTMLElement[] = [];
    for (const u of model.upgrades) {
      let entry=upgrades.get(u.id);
      if (!entry) {
        const slot=document.createElement('div');slot.className='dt-warroom__upgrade-slot';
        entry={host:slot,handle:mountUpgradeCard(slot,u,id=>onAction({type:'upgradeRequested',upgradeId:id}))};upgrades.set(u.id,entry);
      } else entry.handle.setModel(u);
      upgradeHosts.push(entry.host);
    }
    if (upgradeTrack.childElementCount!==upgradeHosts.length || upgradeHosts.some((node,i)=>upgradeTrack.children[i]!==node)) upgradeTrack.replaceChildren(...upgradeHosts);
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
    empty.hidden=!!mission;
    missionInfo.hidden=!mission;
    minionTray.hidden=!mission;
    if (mission) {
      locationImg.src=mission.locationImageSrc;locationImg.alt=mission.locationImageAlt;
      locationName.textContent=mission.name;
      locationDifficulty.textContent=`Difficulty  ${mission.difficultyIcons}`;
      weather.textContent=mission.weatherIcon;weather.title=`Weather: ${mission.weatherDescription}`;
      weather.setAttribute('aria-label',`Weather: ${mission.weatherDescription}`);
      locationInfo.title=mission.description;
      rewardHost.replaceChildren(...mission.rewards.map(reward=>{
        const node=document.createElement('div');node.className='dt-warroom__reward';node.title=reward.label;
        const art=document.createElement('span');art.className='dt-warroom__reward-icon';if(reward.icon.kind==='texture'){
          const image=document.createElement('img');image.src=reward.icon.src;image.alt=reward.icon.alt;
          const fallback=reward.icon.fallbackEmoji??'📦';
          image.addEventListener('error',()=>{art.textContent=fallback;},{once:true});
          art.append(image);
        }else art.textContent=reward.icon.value;
        const chance=document.createElement('span');chance.textContent=reward.chanceLabel;
        node.append(art,chance);return node;
      }));
      squadSize.textContent=mission.squadSizeLabel;
      squadSelected.textContent=mission.squadSelectionLabel;
      duration.textContent=`⌛ ${mission.estimatedDuration}`;
      fatigue.textContent=`⚡ ${mission.estimatedFatigue}`;
      successEstimate.textContent=mission.successEstimateLabel?`🎯 ${mission.successEstimateLabel}`:'';
      successEstimate.hidden=!mission.successEstimateLabel;
      const ongoing=mission.state==='inProgress';
      const readyToClaim=mission.state==='completed'&&mission.canRaid;
      raidHeading.textContent=ongoing?'Raid in Progress':readyToClaim?'Squad Returned':mission.state==='completed'?'Mission Completed':'Raid summary';
      activeProgress.hidden=!ongoing;
      duration.hidden=ongoing;fatigue.hidden=ongoing;
      activeLabel.textContent=mission.statusLabel;
      activeBar.style.width=`${Math.max(0,Math.min(100,(mission.activeProgress??0)*100))}%`;
      activeRemaining.textContent=mission.activeRemainingTime??'';
      raidButton.disabled=!mission.canRaid;
      raidButton.title=mission.canRaid?(readyToClaim?'Open raid report and claim rewards':'Launch raid'):mission.raidDisabledReason??mission.statusLabel;
      raidButton.classList.toggle('dt-warroom__raid-button--running',ongoing);
      raidButton.querySelector<HTMLElement>('strong')!.textContent=ongoing?'Active':mission.state==='locked'?'Locked':readyToClaim?'Claim Rewards':mission.state==='completed'?'Claimed':'Raid!';
      minionToggle.disabled=!mission.canEditSquad;
      minionToggle.title=mission.canEditSquad?'Show or hide minions':'Squad cannot be changed during this raid';
      minionToggle.querySelector('.dt-warroom__tray-title')!.textContent=mission.minionTrayLabel;
      minionCount.textContent=mission.squadSelectionLabel;
    }
    minionTray.classList.toggle('dt-warroom__tray--collapsed',!model.minionsExpanded);
    minionToggle.setAttribute('aria-expanded',String(model.minionsExpanded));
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
    refreshArrows();
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
  return {setModel,destroy(){if(disposed)return;disposed=true;abort.abort();room.destroy();for(const x of upgrades.values())x.handle.destroy();for(const x of pins.values())x.handle.destroy();for(const x of minions.values())x.handle.destroy();upgrades.clear();pins.clear();minions.clear();root.remove();}};
}
