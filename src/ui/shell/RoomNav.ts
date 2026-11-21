import type { RoomNavActionHandler, RoomNavHandle, RoomNavViewModel } from './RoomNav.types';
import './RoomNav.css';

/**
 * Left-column room launcher — VIEW ONLY. Every room is reachable directly from here; picking one
 * is the controller's job to turn into a navigate-and-replace-the-open-window action.
 */
export function mountRoomNav(host: HTMLElement, initial: Readonly<RoomNavViewModel>, onAction: RoomNavActionHandler = () => {}): RoomNavHandle {
  const abort = new AbortController();
  const root = document.createElement('nav');
  root.className = 'dt-room-nav';
  root.setAttribute('aria-label', 'Rooms');
  host.append(root);

  // Buttons are created once per room id and only updated in place afterwards — recreating them on
  // every refresh tick would drop :hover/:focus state and read as a visual "blink" while the mouse
  // sits over an item.
  const buttons = new Map<string, HTMLButtonElement>();

  function setModel(model: Readonly<RoomNavViewModel>): void {
    const ids = new Set(model.rooms.map(r => r.id));
    for (const [id, button] of buttons) if (!ids.has(id)) { button.remove(); buttons.delete(id); }

    const ordered: HTMLButtonElement[] = [];
    for (const room of model.rooms) {
      let button = buttons.get(room.id);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'dt-room-nav__item';
        button.innerHTML = `<img class="dt-room-nav__icon" alt="" aria-hidden="true" width="32" height="32"><span class="dt-room-nav__label"></span>`;
        button.addEventListener('click', () => onAction({ type: 'navigate', id: room.id }), { signal: abort.signal });
        buttons.set(room.id, button);
      }
      button.classList.toggle('is-active', room.active);
      button.setAttribute('aria-pressed', String(room.active));
      const icon = button.querySelector<HTMLImageElement>('.dt-room-nav__icon')!;
      if (icon.getAttribute('src') !== room.icon) icon.setAttribute('src', room.icon);
      button.querySelector('.dt-room-nav__label')!.textContent = room.label;
      ordered.push(button);
    }
    if (root.childElementCount !== ordered.length || ordered.some((node, i) => root.children[i] !== node)) {
      root.replaceChildren(...ordered);
    }
  }
  setModel(initial);

  return {
    setModel,
    destroy(): void {
      abort.abort();
      root.remove();
    },
  };
}
