import { mountRoomSummary } from '../../components/RoomSummary/RoomSummary';
import { mountBedSlot } from '../../components/BedSlot/BedSlot';
import type { BedSlotHandle } from '../../components/BedSlot/BedSlot.types';
import type { InfirmaryActionHandler, InfirmaryViewHandle, InfirmaryViewModel } from './InfirmaryViewModel';
import './InfirmaryView.css';
import '../../components/RoomSlot.css';

interface Mounted<T> { host: HTMLElement; handle: T }
/** Screen-only composition. No treatment calculations, assignment, upgrades, persistence or timers. */
export function mountInfirmaryView(host: HTMLElement, initial: Readonly<InfirmaryViewModel>, onAction: InfirmaryActionHandler): InfirmaryViewHandle {
  const abort = new AbortController();
  const root = document.createElement('main');
  root.className = 'dt-infirmary';
  root.innerHTML = `
  <div class="dt-infirmary__mountains" aria-hidden="true"></div>
  <div class="dt-infirmary__shell">
    <section class="dt-infirmary__window" aria-label="Infirmary window">
      <div class="dt-room-summary-host"></div>
      <section class="dt-infirmary__beds-section" aria-label="Beds">
        <div class="dt-infirmary__beds-topline"><span class="dt-infirmary__beds-title"></span><span class="dt-infirmary__beds-count"></span></div>
        <div class="dt-infirmary__beds-viewport" tabindex="0" aria-label="Scrollable bed slots">
          <div class="dt-infirmary__beds-grid"></div>
          <div class="dt-infirmary__no-beds" role="status" hidden><span>🛏️</span><strong>No beds available</strong><p></p></div>
        </div>
      </section>
    </section>
  </div>`;
  function required<T extends Element>(selector: string): T {
    const el = root.querySelector<T>(selector);
    if (!el) throw new Error(`InfirmaryView missing ${selector}`);
    return el;
  }
  const room = mountRoomSummary(root.querySelector<HTMLElement>('.dt-room-summary-host')!, initial.room, initial.upgrades, upgradeId => onAction({ type: 'upgradeRequested', upgradeId }));
  const bedsViewport = required<HTMLElement>('.dt-infirmary__beds-viewport');
  const bedGrid = required<HTMLElement>('.dt-infirmary__beds-grid');
  const noBeds = required<HTMLElement>('.dt-infirmary__no-beds');
  const beds = new Map<string, Mounted<BedSlotHandle>>();
  let disposed = false;
  function setModel(model: Readonly<InfirmaryViewModel>): void {
    if (disposed) return;
    room.setModel(model.room, model.upgrades);
    required<HTMLElement>('.dt-infirmary__beds-title').textContent = model.bedsCaption;
    required<HTMLElement>('.dt-infirmary__beds-count').textContent = model.countCaption;
    required<HTMLElement>('.dt-infirmary__no-beds p').textContent = model.emptyMessage;
    root.classList.toggle('dt-infirmary--busy', !!model.busy);


    const activeBeds = new Set(model.beds.map(value => value.id));
    for (const [id, mounted] of beds) if (!activeBeds.has(id)) { mounted.handle.destroy(); beds.delete(id); }
    const orderedBeds: HTMLElement[] = [];
    for (const data of model.beds) {
      let item = beds.get(data.id);
      if (!item) {
        const slot = document.createElement('div'); slot.className='dt-infirmary__bed-slot';
        item = { host: slot, handle: mountBedSlot(slot, data) };
        beds.set(data.id, item);
      } else item.handle.setModel(data);
      orderedBeds.push(item.host);
    }
    const priorScroll = bedsViewport.scrollTop;
    if (bedGrid.childElementCount !== orderedBeds.length || orderedBeds.some((el, i) => bedGrid.children[i] !== el)) bedGrid.replaceChildren(...orderedBeds);
    bedsViewport.scrollTop = priorScroll;
    bedGrid.hidden = model.beds.length === 0;
    noBeds.hidden = model.beds.length !== 0;
  }
  host.replaceChildren(root);
  setModel(initial);
  return { setModel, destroy() {
    if (disposed) return;
    disposed = true;
    abort.abort(); room.destroy();

    for (const item of beds.values()) item.handle.destroy();
     beds.clear(); root.remove();
  } };
}
