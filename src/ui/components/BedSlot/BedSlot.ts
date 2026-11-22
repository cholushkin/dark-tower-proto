import type { BedSlotHandle, BedSlotViewModel } from './BedSlot.types';
import { mountMinionComponent } from '../MinionComponent/MinionComponent';
import type { MinionComponentHandle } from '../MinionComponent/MinionComponent.types';
import './BedSlot.css';
export function mountBedSlot(host: HTMLElement, initial: Readonly<BedSlotViewModel>): BedSlotHandle {
 const root=document.createElement('article');root.className='dt-bed';
 root.innerHTML=`<div class="dt-bed__tile"><img class="dt-bed__image" alt=""><div class="dt-bed__minion"></div></div>
 <div class="dt-bed__activity"><strong></strong><div class="dt-bed__progress" role="progressbar" aria-valuemin="0" aria-valuemax="100"><div class="dt-bed__fill"></div><span class="dt-bed__remaining"></span></div></div>`;
 const get=(s:string)=>root.querySelector<HTMLElement>(s)!;
 let card:MinionComponentHandle|undefined;let destroyed=false;
 function setModel(model:Readonly<BedSlotViewModel>) {
  if(destroyed)return;
  const occupant=model.occupant;
  root.classList.toggle('dt-bed--empty',!occupant);
  root.classList.toggle('dt-bed--treatment',model.presentation==='treatment');
  (get('.dt-bed__image') as HTMLImageElement).src=model.bedImageSrc;
  get('.dt-bed__activity').hidden=!occupant;
  root.setAttribute('aria-label',model.label);
  if(!occupant){card?.destroy();card=undefined;return;}
  if(card)card.setModel(occupant.card);else card=mountMinionComponent(get('.dt-bed__minion'),occupant.card);
  const label=model.presentation==='treatment'?'Healing':'Resting';
  get('.dt-bed__activity strong').textContent=label;
  get('.dt-bed__remaining').textContent=occupant.remainingLabel;
  const progress=Math.max(0,Math.min(1,occupant.restProgress))*100;
  get('.dt-bed__fill').style.width=`${progress}%`;
  get('.dt-bed__progress').setAttribute('aria-label',`${label}: ${occupant.remainingLabel} remaining`);
  get('.dt-bed__progress').setAttribute('aria-valuenow',String(Math.round(progress)));
 }
 host.replaceChildren(root);setModel(initial);
 return {setModel,destroy(){if(destroyed)return;destroyed=true;card?.destroy();root.remove();}};
}
