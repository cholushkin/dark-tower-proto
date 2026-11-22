import { mountRoomSummary } from '../../components/RoomSummary/RoomSummary';
import { mountPrisonCell } from '../../components/PrisonCell/PrisonCell';
import type { PrisonCellHandle } from '../../components/PrisonCell/PrisonCell.types';
import type { DungeonActionHandler, DungeonViewHandle, DungeonViewModel } from './DungeonViewModel';
import './DungeonView.css';
import '../../components/RoomSlot.css';

interface Mounted<T> { host: HTMLElement; handle: T }
/** Screen-only composition. Never resolves prisoners, starts timers, buys upgrades or mutates gold. */
export function mountDungeonView(host: HTMLElement, initial: Readonly<DungeonViewModel>, onAction: DungeonActionHandler): DungeonViewHandle {
  const abort = new AbortController();
  const root = document.createElement('main');
  root.className = 'dt-dungeon';
  root.innerHTML = `
    <div class="dt-dungeon__mountains" aria-hidden="true"></div>
    <div class="dt-dungeon__shell">
      <section class="dt-dungeon__window" aria-label="Dungeon window">
                <div class="dt-room-summary-host"></div>
        <section class="dt-dungeon__cells-section" aria-label="Prison cells">
          <div class="dt-dungeon__cells-topline"><span class="dt-dungeon__cells-title"></span><span class="dt-dungeon__cells-count"></span></div>
          <div class="dt-dungeon__cells-viewport" tabindex="0" aria-label="Scrollable prison cell slots">
            <div class="dt-dungeon__cells-grid"></div>
            <div class="dt-dungeon__no-cells" role="status" hidden><span>⛓️</span><strong>No prison cells</strong><p></p></div>
          </div>
        </section>
      </section>
    </div>`;
  const required = <T extends Element>(selector: string): T => {
    const el = root.querySelector<T>(selector);
    if (!el) throw new Error(`DungeonView missing ${selector}`);
    return el;
  };
  const room = mountRoomSummary(root.querySelector<HTMLElement>('.dt-room-summary-host')!, initial.room, initial.upgrades, upgradeId => onAction({ type: 'upgradeRequested', upgradeId }));
  const cellsViewport = required<HTMLElement>('.dt-dungeon__cells-viewport');
  const cellGrid = required<HTMLElement>('.dt-dungeon__cells-grid');
  const noCells = required<HTMLElement>('.dt-dungeon__no-cells');
  const cells = new Map<string, Mounted<PrisonCellHandle>>();
  let destroyed = false;
  function setModel(model: Readonly<DungeonViewModel>): void {
    if (destroyed) return;
    room.setModel(model.room, model.upgrades);
    required<HTMLElement>('.dt-dungeon__cells-title').textContent = model.cellsCaption;
    required<HTMLElement>('.dt-dungeon__cells-count').textContent = model.countCaption;
    required<HTMLElement>('.dt-dungeon__no-cells p').textContent = model.emptyMessage;
    root.classList.toggle('dt-dungeon--busy', Boolean(model.busy));


    const cellIds = new Set(model.cells.map(x => x.id));
    for (const [id, mounted] of cells) if (!cellIds.has(id)) { mounted.handle.destroy(); cells.delete(id); }
    const orderedCells: HTMLElement[] = [];
    for (const data of model.cells) {
      let item = cells.get(data.id);
      if (!item) {
        const slot = document.createElement('div'); slot.className = 'dt-dungeon__cell-slot';
        item = { host: slot, handle: mountPrisonCell(slot, data) };
        cells.set(data.id, item);
      } else item.handle.setModel(data);
      orderedCells.push(item.host);
    }
    const priorScroll = cellsViewport.scrollTop;
    if (cellGrid.childElementCount !== orderedCells.length || orderedCells.some((el, i) => cellGrid.children[i] !== el)) cellGrid.replaceChildren(...orderedCells);
    cellsViewport.scrollTop = priorScroll;
    cellGrid.hidden = model.cells.length === 0;
    noCells.hidden = model.cells.length !== 0;
  }
  host.replaceChildren(root);
  setModel(initial);
  return { setModel, destroy() {
    if (destroyed) return;
    destroyed = true;
    abort.abort(); room.destroy();

    for (const item of cells.values()) item.handle.destroy();
     cells.clear(); root.remove();
  } };
}
