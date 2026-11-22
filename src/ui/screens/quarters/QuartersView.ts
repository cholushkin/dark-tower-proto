import { mountRoomSummary } from '../../components/RoomSummary/RoomSummary';
import { mountBedSlot } from '../../components/BedSlot/BedSlot';
import type { BedSlotHandle } from '../../components/BedSlot/BedSlot.types';
import { mountMinionComponent } from '../../components/MinionComponent/MinionComponent';
import type { MinionComponentHandle } from '../../components/MinionComponent/MinionComponent.types';
import type { QuartersActionHandler, QuartersViewHandle, QuartersViewModel } from './QuartersViewModel';
import './QuartersView.css';
import '../../components/RoomSlot.css';

interface Mounted<T> { host: HTMLElement; handle: T }
/** Screen-only composition. No rest calculations, assignment, upgrades, persistence or timers. */
export function mountQuartersView(host: HTMLElement, initial: Readonly<QuartersViewModel>, onAction: QuartersActionHandler): QuartersViewHandle {
  const abort = new AbortController();
  const root = document.createElement('main');
  root.className = 'dt-quarters';
  root.innerHTML = `
  <div class="dt-quarters__mountains" aria-hidden="true"></div>
  <div class="dt-quarters__shell">
    <section class="dt-quarters__window" aria-label="Quarters window">
      <div class="dt-room-summary-host"></div>
      <section class="dt-quarters__beds-section" aria-label="Beds">
        <div class="dt-quarters__beds-topline"><span class="dt-quarters__beds-title"></span><span class="dt-quarters__beds-count"></span></div>
        <div class="dt-quarters__beds-viewport" tabindex="0" aria-label="Scrollable bed slots">
          <div class="dt-quarters__beds-grid"></div>
          <div class="dt-quarters__no-beds" role="status" hidden><span>🛏️</span><strong>No beds available</strong><p></p></div>
        </div>
      </section>
      <section class="dt-quarters__minions-section" aria-label="Minion roster">
        <div class="dt-quarters__minions-topline"><span>Minion Roster</span><span class="dt-quarters__minions-count"></span></div>
        <div class="dt-quarters__minions-viewport" tabindex="0" aria-label="Scrollable minion roster">
          <div class="dt-quarters__minions-track"></div>
        </div>
      </section>
    </section>
  </div>`;
  function required<T extends Element>(selector: string): T {
    const el = root.querySelector<T>(selector);
    if (!el) throw new Error(`QuartersView missing ${selector}`);
    return el;
  }
  const room = mountRoomSummary(root.querySelector<HTMLElement>('.dt-room-summary-host')!, initial.room, initial.upgrades, upgradeId => onAction({ type: 'upgradeRequested', upgradeId }));
  const bedsViewport = required<HTMLElement>('.dt-quarters__beds-viewport');
  const bedGrid = required<HTMLElement>('.dt-quarters__beds-grid');
  const noBeds = required<HTMLElement>('.dt-quarters__no-beds');
  const minionsTrack = required<HTMLElement>('.dt-quarters__minions-track');
  const minionsCount = required<HTMLElement>('.dt-quarters__minions-count');
  const beds = new Map<string, Mounted<BedSlotHandle>>();
  const minions = new Map<string, Mounted<MinionComponentHandle>>();
  let disposed = false;
  function setModel(model: Readonly<QuartersViewModel>): void {
    if (disposed) return;
    room.setModel(model.room, model.upgrades);
    required<HTMLElement>('.dt-quarters__beds-title').textContent = model.bedsCaption;
    required<HTMLElement>('.dt-quarters__beds-count').textContent = model.countCaption;
    required<HTMLElement>('.dt-quarters__no-beds p').textContent = model.emptyMessage;
    root.classList.toggle('dt-quarters--busy', !!model.busy);


    const activeBeds = new Set(model.beds.map(value => value.id));
    for (const [id, mounted] of beds) if (!activeBeds.has(id)) { mounted.handle.destroy(); beds.delete(id); }
    const orderedBeds: HTMLElement[] = [];
    for (const data of model.beds) {
      let item = beds.get(data.id);
      if (!item) {
        const slot = document.createElement('div'); slot.className='dt-quarters__bed-slot';
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

    minionsCount.textContent = model.minionsCaption;
    const activeMinions = new Set(model.minions.map(value => value.id));
    for (const [id, mounted] of minions) if (!activeMinions.has(id)) { mounted.handle.destroy(); minions.delete(id); }
    const orderedMinions: HTMLElement[] = [];
    for (const data of model.minions) {
      let item = minions.get(data.id);
      if (!item) {
        const slot = document.createElement('div'); slot.className = 'dt-quarters__minion-slot';
        item = { host: slot, handle: mountMinionComponent(slot, data, () => {}) };
        minions.set(data.id, item);
      } else item.handle.setModel(data);
      orderedMinions.push(item.host);
    }
    if (minionsTrack.childElementCount !== orderedMinions.length || orderedMinions.some((el, i) => minionsTrack.children[i] !== el)) minionsTrack.replaceChildren(...orderedMinions);
  }
  host.replaceChildren(root);
  setModel(initial);
  return { setModel, destroy() {
    if (disposed) return;
    disposed = true;
    abort.abort(); room.destroy();

    for (const item of beds.values()) item.handle.destroy();
    for (const item of minions.values()) item.handle.destroy();
     beds.clear(); minions.clear(); root.remove();
  } };
}
