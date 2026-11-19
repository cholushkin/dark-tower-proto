import type {ItemTileViewModel,ItemTileHandle} from './ItemTile.types';
import './ItemTile.css';
let serial=0;
/** Extracted from the original Storehouse ItemComponent's visual tile. Never owns gameplay actions. */
export function mountItemTile(host: HTMLElement, initialModel: Readonly<ItemTileViewModel>): ItemTileHandle {
  const uid=++serial;
  const abort=new AbortController();
  let model=initialModel;
  let failedSrc: string | undefined;
  const root=document.createElement('article');
  root.className='dt-item dt-item__tile';
  root.innerHTML=`
    <button type="button" class="dt-item__info dt-item__corner" aria-describedby="dt-item-help-${uid}" aria-label="Item information">i
      <span id="dt-item-help-${uid}" class="dt-item__tooltip dt-item__tooltip--left" role="tooltip"></span>
    </button>
    <span class="dt-item__stack dt-item__corner" tabindex="0" aria-describedby="dt-item-stack-${uid}">
      <span class="dt-item__stack-label"></span>
      <span id="dt-item-stack-${uid}" class="dt-item__tooltip dt-item__tooltip--right" role="tooltip"></span>
    </span>
    <div class="dt-item__art" aria-hidden="true"><span class="dt-item__emoji"></span><img class="dt-item__texture" alt="" hidden /></div>
    <div class="dt-item__name"></div>`;
  const info=root.querySelector<HTMLButtonElement>('.dt-item__info')!;
  const infoTip=root.querySelector<HTMLElement>('.dt-item__tooltip--left')!;
  const stack=root.querySelector<HTMLElement>('.dt-item__stack')!;
  const stackLabel=root.querySelector<HTMLElement>('.dt-item__stack-label')!;
  const stackTip=root.querySelector<HTMLElement>('.dt-item__tooltip--right')!;
  const emoji=root.querySelector<HTMLElement>('.dt-item__emoji')!;
  const texture=root.querySelector<HTMLImageElement>('.dt-item__texture')!;
  const name=root.querySelector<HTMLElement>('.dt-item__name')!;
  function fit(tooltip:HTMLElement):void {
    tooltip.style.left='';tooltip.style.right='';
    if(tooltip.getBoundingClientRect().right>window.innerWidth-8){tooltip.style.left='auto';tooltip.style.right='0';}
    if(tooltip.getBoundingClientRect().left<8){tooltip.style.right='auto';tooltip.style.left='0';}
  }
  for(const [a,tip] of [[info,infoTip],[stack,stackTip]] as const){
    a.addEventListener('mouseenter',()=>fit(tip),{signal:abort.signal});
    a.addEventListener('focus',()=>fit(tip),{signal:abort.signal});
  }
  info.addEventListener('click',event=>{ event.stopPropagation(); infoTip.classList.toggle('dt-item__tooltip--pinned');fit(infoTip); },{signal:abort.signal});
  texture.addEventListener('error',()=>{failedSrc=texture.getAttribute('src')??undefined;texture.hidden=true;emoji.hidden=false;emoji.textContent=model.icon.kind==='texture'?(model.icon.fallbackEmoji??'📦'):model.icon.value;},{signal:abort.signal});
  function setModel(next:Readonly<ItemTileViewModel>):void {
    model=next;root.dataset.itemId=next.id;name.textContent=next.title;infoTip.textContent=next.description;
    info.setAttribute('aria-label',`About ${next.title}`);
    stack.hidden=!next.stack;
    if(next.stack){stackLabel.textContent=next.stack.label;stackTip.textContent=next.stack.tooltip;stack.setAttribute('aria-label',next.stack.tooltip);}
    if(next.icon.kind==='emoji'){texture.hidden=true;emoji.hidden=false;emoji.textContent=next.icon.value;}
    else{
      const failed=failedSrc===next.icon.src;
      texture.hidden=failed;emoji.hidden=!failed;emoji.textContent=next.icon.fallbackEmoji??'📦';texture.alt=next.icon.alt;
      if(texture.getAttribute('src')!==next.icon.src){failedSrc=undefined;texture.src=next.icon.src;}
    }
  }
  host.replaceChildren(root);setModel(initialModel);
  return {setModel,destroy(){abort.abort();root.remove();}};
}
