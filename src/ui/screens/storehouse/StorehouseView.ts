import { mountRoomSummary } from '../../components/RoomSummary/RoomSummary';
import { mountItemComponent } from '../../components/ItemComponent/ItemComponent';
import type { ItemComponentHandle } from '../../components/ItemComponent/ItemComponent.types';
import { mountTagFilterBar } from '../../components/TagFilterBar/TagFilterBar';
import type { StorehouseActionHandler, StorehouseViewHandle, StorehouseViewModel } from './StorehouseViewModel';
import './StorehouseView.css';

interface MountedCard<T> { host: HTMLElement; handle: T; }

/**
 * Engine-agnostic Storehouse UI. It composes the unmodified shared ItemComponent.
 * Game/upgrade/reward/eligibility decisions belong to the calling adapter.
 * Only DOM, selection appearance, carousel scrolling and mount lifecycle live here.
 */
export function mountStorehouseView(
  host: HTMLElement,
  initial: Readonly<StorehouseViewModel>,
  onAction: StorehouseActionHandler,
): StorehouseViewHandle {
  const abort = new AbortController();
  const root = document.createElement('main');
  root.className = 'dt-storehouse';
  root.innerHTML = `
    <div class="dt-storehouse__mountains" aria-hidden="true"></div>
    <div class="dt-storehouse__shell">
      <section class="dt-storehouse__window" aria-label="Storehouse window">
      <div class="dt-room-summary-host"></div>
      <section class="dt-storehouse__inventory" aria-label="Stored items">
        <div class="dt-storehouse__filters"></div>
        <div class="dt-storehouse__inventory-frame">
          <div class="dt-storehouse__inventory-topline"><span class="dt-storehouse__inventory-title">Stored items</span><span class="dt-storehouse__inventory-count"></span></div>
          <div class="dt-storehouse__inventory-viewport" tabindex="0" aria-label="Scrollable inventory item stacks">
            <div class="dt-storehouse__items"></div>
            <div class="dt-storehouse__empty" role="status" hidden><span aria-hidden="true">📦</span><strong>Nothing here yet</strong><p></p></div>
          </div>
        </div>
      </section>
      </section>
    </div>
  `;

  function required<T extends Element>(selector: string): T {
    const el = root.querySelector<T>(selector);
    if (!el) throw new Error(`StorehouseView missing ${selector}`);
    return el;
  }
  const inventoryViewport = required<HTMLElement>('.dt-storehouse__inventory-viewport');
  const inventoryGrid = required<HTMLElement>('.dt-storehouse__items');
  const inventoryCount = required<HTMLElement>('.dt-storehouse__inventory-count');
  const emptyEl = required<HTMLElement>('.dt-storehouse__empty');
  const emptyText = required<HTMLElement>('.dt-storehouse__empty p');
  const room = mountRoomSummary(root.querySelector<HTMLElement>('.dt-room-summary-host')!, initial.room, initial.upgrades, upgradeId => onAction({ type: 'upgradeRequested', upgradeId }));
  const filters = mountTagFilterBar(required<HTMLElement>('.dt-storehouse__filters'), initial.filters, tag => {
    onAction({ type: 'filterToggled', tag });
  });
  const itemCards = new Map<string, MountedCard<ItemComponentHandle>>();
  let disposed = false;

  function setModel(model: Readonly<StorehouseViewModel>): void {
    if (disposed) return;
    room.setModel(model.room, model.upgrades);
    filters.setModel(model.filters);
    inventoryCount.textContent = model.inventoryLabel;
    emptyText.textContent = model.emptyMessage;
    root.classList.toggle('dt-storehouse--busy', !!model.busy);
    const activeItems = new Set(model.items.map(item => item.id));
    for (const [id, card] of itemCards) {
      if (!activeItems.has(id)) { card.handle.destroy(); card.host.remove(); itemCards.delete(id); }
    }
    const orderedItemHosts: HTMLElement[] = [];
    for (const item of model.items) {
      let card = itemCards.get(item.id);
      if (!card) {
        const wrapper = document.createElement('div');
        wrapper.className = 'dt-storehouse__item-slot';
        card = { host: wrapper, handle: mountItemComponent(wrapper, item, onAction) };
        itemCards.set(item.id, card);
      } else card.handle.setModel(item);
      orderedItemHosts.push(card.host);
    }
    const priorScroll = inventoryViewport.scrollTop;
    if (inventoryGrid.childElementCount !== orderedItemHosts.length || orderedItemHosts.some((element, index) => inventoryGrid.children[index] !== element)) {
      inventoryGrid.replaceChildren(...orderedItemHosts);
    }
    inventoryViewport.scrollTop = priorScroll;
    emptyEl.hidden = model.items.length !== 0;
    inventoryGrid.hidden = model.items.length === 0;
  }
  host.replaceChildren(root);
  setModel(initial);
  return {
    setModel,
    destroy() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      room.destroy(); filters.destroy();
      for (const card of itemCards.values()) card.handle.destroy();

      itemCards.clear();
      root.remove();
    },
  };
}
