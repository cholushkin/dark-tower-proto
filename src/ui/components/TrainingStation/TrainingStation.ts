import type { TrainingStationAction, TrainingStationHandle, TrainingStationViewModel } from './TrainingStation.types';
import './TrainingStation.css';

/** Square station view. No timers, rank changes, roster access, or assignment rules. */
export function mountTrainingStation(host: HTMLElement, initial: Readonly<TrainingStationViewModel>, onAction: (action: TrainingStationAction) => void): TrainingStationHandle {
  const root = document.createElement('article');
  root.className = 'dt-station';
  root.innerHTML = `
    <img class="dt-station__art" alt="" />
    <div class="dt-station__art-tint" aria-hidden="true"></div>
    <div class="dt-station__portrait-wrap" hidden><img class="dt-station__portrait" alt="" /></div>
    <div class="dt-station__top-left"><span class="dt-station__info" title="Minion training details">i</span></div>
    <div class="dt-station__top-right"><div class="dt-station__badges"></div></div>
    <div class="dt-station__rank-ladder" hidden aria-label="Rank progression"><div class="dt-station__rank-next"></div><span class="dt-station__rank-arrow" aria-hidden="true">⬆</span><div class="dt-station__rank-current"></div></div>
    <div class="dt-station__bottom" hidden><strong class="dt-station__name"></strong>
      <div class="dt-station__progress" title="Training progress"><div class="dt-station__progress-fill"></div><span class="dt-station__timer"><span aria-hidden="true">⌛</span> <span class="dt-station__time"></span></span></div>
    </div>
    <div class="dt-station__empty-hint" aria-hidden="true">＋ <span>Assign minion</span></div>
    <button class="dt-station__hit" type="button" aria-label="Select training station"></button>
  `;
  const get = <T extends HTMLElement=HTMLElement>(s: string): T => { const el=root.querySelector<T>(s); if(!el) throw new Error(`TrainingStation missing ${s}`); return el; };
  const portraitWrap=get('.dt-station__portrait-wrap');
  const portrait=get<HTMLImageElement>('.dt-station__portrait');
  const button=get<HTMLButtonElement>('.dt-station__hit');
  const art=get<HTMLImageElement>('.dt-station__art');
  let current=initial;
  let destroyed=false;
  const abort=new AbortController();
  button.addEventListener('click',()=>{ if(!destroyed && !current.occupant && current.canAssign) onAction({type:'stationSelected',stationId:current.id}); },{signal:abort.signal});
  function setModel(model:Readonly<TrainingStationViewModel>):void {
    if(destroyed)return;
    current=model;
    const occupied=!!model.occupant;
    root.classList.toggle('dt-station--occupied',occupied);
    root.classList.toggle('dt-station--empty',!occupied);
    root.classList.toggle('dt-station--disabled',!occupied&&!model.canAssign);
    if(art.getAttribute('src')!==model.artworkSrc)art.src=model.artworkSrc;
    art.alt=model.artworkAlt;
    button.disabled=occupied||!model.canAssign;
    button.title=occupied?'Training in progress':model.canAssign?'Choose a minion to train':model.disabledReason??'Station unavailable';
    button.setAttribute('aria-label',occupied?`${model.label}: occupied by ${model.occupant?.name}`:`${model.label}: ${model.canAssign?'assign minion':model.disabledReason??'unavailable'}`);
    get('.dt-station__bottom').hidden=!occupied;
    portraitWrap.hidden=!occupied;
    if(!model.occupant){get('.dt-station__top-right').hidden=true;get('.dt-station__top-left').hidden=true;get('.dt-station__rank-ladder').hidden=true; portrait.onerror=null; return;}
    get('.dt-station__top-right').hidden=false;
    get('.dt-station__top-left').hidden=false;
    get('.dt-station__rank-ladder').hidden=false;
    const minion=model.occupant;
    get('.dt-station__name').textContent=minion.name;
    get('.dt-station__rank-current').textContent=`${minion.rankLabel} (Rank ${minion.rank})`;
    get('.dt-station__rank-next').textContent=`${minion.nextRankLabel} (Rank ${minion.nextRank})`;
    get('.dt-station__rank-ladder').title=`Level up: ${minion.rankLabel} (Rank ${minion.rank}) → ${minion.nextRankLabel} (Rank ${minion.nextRank})`;
    get('.dt-station__time').textContent=minion.timeRemainingLabel;
    get('.dt-station__timer').title=minion.timeRemainingTooltip??`Training remaining: ${minion.timeRemainingLabel}`;
    get<HTMLElement>('.dt-station__progress-fill').style.width=`${Math.max(0,Math.min(1,minion.progress))*100}%`;
    get('.dt-station__info').title=`${minion.name} · ${minion.rankLabel} (Rank ${minion.rank}) → ${minion.nextRankLabel} (Rank ${minion.nextRank}) · ${minion.timeRemainingLabel} remaining`;
    portrait.hidden=false;portrait.src=minion.portrait.src;portrait.alt=minion.portrait.alt;
    const badges=(minion.conditionBadges??[]).map(b=>{const el=document.createElement('span');el.className='dt-station__badge';el.textContent=b.icon;el.title=b.label;el.setAttribute('aria-label',b.label);return el;});
    get('.dt-station__badges').replaceChildren(...badges);
  }
  host.replaceChildren(root);
  setModel(initial);
  return {setModel,destroy(){if(destroyed)return;destroyed=true;abort.abort();portrait.onerror=null;root.remove();}};
}
