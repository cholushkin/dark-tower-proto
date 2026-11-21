import { mountRoomOverviewCard } from '../RoomOverviewCard/RoomOverviewCard';
import type { RoomOverviewViewModel } from '../RoomOverviewCard/RoomOverviewCard.types';
import { mountUpgradeCard } from '../UpgradeCard/UpgradeCard';
import type { UpgradeCardHandle, UpgradeCardViewModel } from '../UpgradeCard/UpgradeCard.types';
import './RoomSummary.css';

/** Shared presentation of room artwork, parameters and whole-card upgrade pages. */
export function mountRoomSummary(host: HTMLElement, initial: Readonly<RoomOverviewViewModel>, initialUpgrades: readonly UpgradeCardViewModel[], onUpgrade: (id: string) => void) {
  const root = document.createElement('section');
  root.className = 'dt-room-summary';
  root.innerHTML = `<div class="dt-room-summary__overview"></div>
    <section class="dt-room-summary__upgrades" aria-label="Available upgrades">
      <button type="button" class="dt-room-summary__arrow" aria-label="Previous upgrades">‹</button>
      <div class="dt-room-summary__cards"></div>
      <button type="button" class="dt-room-summary__arrow" aria-label="Next upgrades">›</button>
    </section>`;
  host.replaceChildren(root);
  const overview = mountRoomOverviewCard(root.querySelector<HTMLElement>('.dt-room-summary__overview')!, initial, { variant: 'embedded' });
  const track = root.querySelector<HTMLElement>('.dt-room-summary__cards')!;
  const [prev, next] = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
  const cards = new Map<string, { host: HTMLElement; handle: UpgradeCardHandle }>();
  let models = initialUpgrades;
  let start = 0;
  let capacity = 1;
  let destroyed = false;

  function renderPage() {
    if (destroyed) return;
    capacity = Math.max(1, Math.floor((track.clientWidth + 12) / 199));
    start = Math.min(start, Math.max(0, models.length - capacity));
    models.forEach((model, index) => { cards.get(model.id)!.host.hidden = index < start || index >= start + capacity; });
    prev.hidden = next.hidden = models.length <= capacity;
    prev.disabled = start === 0;
    next.disabled = start + capacity >= models.length;
  }
  prev.onclick = () => { start = Math.max(0, start - capacity); renderPage(); };
  next.onclick = () => { start += capacity; renderPage(); };
  const resize = new ResizeObserver(renderPage);
  resize.observe(track);

  function setModel(room: Readonly<RoomOverviewViewModel>, upgrades: readonly UpgradeCardViewModel[]) {
    if (destroyed) return;
    root.setAttribute('aria-label', `${room.title} information and upgrades`);
    overview.setModel(room);
    models = upgrades;
    const ids = new Set(upgrades.map(model => model.id));
    for (const [id, card] of cards) if (!ids.has(id)) { card.handle.destroy(); card.host.remove(); cards.delete(id); }
    const ordered = upgrades.map(model => {
      let card = cards.get(model.id);
      if (!card) {
        const slot = document.createElement('div');
        slot.className = 'dt-room-summary__slot';
        card = { host: slot, handle: mountUpgradeCard(slot, model, onUpgrade) };
        cards.set(model.id, card);
      } else card.handle.setModel(model);
      return card.host;
    });
    if (ordered.length !== track.childElementCount || ordered.some((node, i) => track.children[i] !== node)) track.replaceChildren(...ordered);
    renderPage();
  }
  setModel(initial, initialUpgrades);
  return { setModel, destroy() {
    destroyed = true;
    resize.disconnect();
    overview.destroy();
    for (const card of cards.values()) card.handle.destroy();
    cards.clear();
    root.remove();
  } };
}
