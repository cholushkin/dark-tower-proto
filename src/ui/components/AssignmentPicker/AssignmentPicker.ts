import type { AssignmentPickerHandle,AssignmentPickerViewModel } from './AssignmentPicker.types';
import './AssignmentPicker.css';
/** Generic, declarative picker. Host owns candidate list & state changes. */
export function mountAssignmentPicker(host:HTMLElement, initial:Readonly<AssignmentPickerViewModel>, onChoose:(id:string)=>void, onCancel:()=>void): AssignmentPickerHandle {
 const abort=new AbortController();
 const root=document.createElement('div');root.className='dt-assign';
 root.innerHTML=`<div class="dt-assign__backdrop"></div><section class="dt-assign__dialog" role="dialog" aria-modal="true" aria-label="Assign minion"><div class="dt-assign__top"><div><h2 class="dt-assign__title"></h2><p class="dt-assign__subtitle"></p></div><button type="button" class="dt-assign__close" aria-label="Close">×</button></div><div class="dt-assign__list"></div><p class="dt-assign__empty" hidden></p></section>`;
 const get=<T extends HTMLElement=HTMLElement>(selector:string):T=>{const el=root.querySelector<T>(selector);if(!el)throw new Error(`Picker missing ${selector}`);return el;};
 const list=get('.dt-assign__list');
 get('.dt-assign__backdrop').addEventListener('click',onCancel,{signal:abort.signal});
 get('.dt-assign__close').addEventListener('click',onCancel,{signal:abort.signal});
 document.addEventListener('keydown',(e:KeyboardEvent)=>{if(e.key==='Escape')onCancel();},{signal:abort.signal});
 let destroyed=false;
 function setModel(model:Readonly<AssignmentPickerViewModel>) {
   if(destroyed)return;
   get('.dt-assign__title').textContent=model.title;
   get('.dt-assign__subtitle').textContent=model.subtitle;
   const nodes=model.candidates.map(person=>{
     const row=document.createElement('button');row.type='button';row.className='dt-assign__candidate';row.disabled=!person.selectable;
     row.title=person.selectable?'Select this minion':person.disabledReason??'Unavailable';
     const face=document.createElement('span');face.className='dt-assign__portrait';
     const img=document.createElement('img');img.src=person.portrait.src;img.alt=person.portrait.alt;face.append(img);
     const info=document.createElement('span');info.className='dt-assign__info';
     const name=document.createElement('strong');name.textContent=person.name;
     const detail=document.createElement('small');detail.textContent=person.detail;
     info.append(name,detail);
     const cost=document.createElement('span');cost.className='dt-assign__cost';cost.textContent=`${person.durationLabel} · ${person.costLabel}`;
     row.append(face,info,cost);
     row.addEventListener('click',()=>{if(person.selectable)onChoose(person.id);},{signal:abort.signal});
     return row;
   });
   list.replaceChildren(...nodes);
   const empty=get('.dt-assign__empty');empty.hidden=nodes.length>0;empty.textContent=model.emptyLabel??'No candidates available';
 }
 host.replaceChildren(root);setModel(initial);
 return {setModel,destroy(){if(destroyed)return;destroyed=true;abort.abort();root.remove();}};
}
