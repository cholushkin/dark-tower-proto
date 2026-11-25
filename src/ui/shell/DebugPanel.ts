import type { DebugPanelActionHandler, DebugPanelHandle, DebugPanelViewModel } from './DebugPanel.types';
import './DebugPanel.css';

/**
 * Dev-only overlay: start a new game, force-complete processes, and copy the raw game state, so a
 * playtester isn't stuck waiting on real-time timers (1 real minute = 1 in-game day). Pause and
 * speed live on the TimeWidget; this panel keeps the other playtesting controls.
 */
export function mountDebugPanel(host: HTMLElement, initial: Readonly<DebugPanelViewModel>, onAction: DebugPanelActionHandler = () => {}): DebugPanelHandle {
  const abort = new AbortController();
  host.innerHTML = `
    <section class="dt-debug" aria-label="Debug tools">
      <button class="dt-debug__toggle" type="button" aria-expanded="false">⚙ Debug</button>
      <div class="dt-debug__panel" hidden>
        <div class="dt-debug__actions">
          <button type="button" data-action="copyState">📋 Copy state</button>
          <button type="button" data-action="newGame" title="Clear saved progress and start a new game">New Game</button>
        </div>
        <label class="dt-debug__option"><input type="checkbox" data-role="map-coordinates" /> Render percent on the map</label>
        <div class="dt-debug__processes"></div>
      </div>
    </section>`;
  const toggle = host.querySelector<HTMLButtonElement>('.dt-debug__toggle')!;
  const panel = host.querySelector<HTMLElement>('.dt-debug__panel')!;
  const processesHost = host.querySelector<HTMLElement>('.dt-debug__processes')!;
  const mapCoordinates = host.querySelector<HTMLInputElement>('[data-role="map-coordinates"]')!;
  mapCoordinates.addEventListener('change', () => onAction({ type: 'setMapCoordinates', enabled: mapCoordinates.checked }), { signal: abort.signal });

  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  }, { signal: abort.signal });

  host.querySelector('[data-action="copyState"]')!.addEventListener('click', () => onAction({ type: 'copyState' }), { signal: abort.signal });
  host.querySelector('[data-action="newGame"]')!.addEventListener('click', () => onAction({ type: 'newGame' }), { signal: abort.signal });

  function setModel(model: Readonly<DebugPanelViewModel>): void {
    mapCoordinates.checked = model.showMapCoordinates;
    processesHost.replaceChildren(...model.processes.map(row => {
      const line = document.createElement('div');
      line.className = 'dt-debug__row';
      const label = document.createElement('span');
      label.className = 'dt-debug__label';
      label.textContent = row.label;
      const bar = document.createElement('div');
      bar.className = 'dt-debug__bar';
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      const progress = Math.min(1, Math.max(0, row.progress));
      bar.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
      const fill = document.createElement('span');
      fill.style.width = `${progress * 100}%`;
      bar.append(fill);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '⚡';
      button.title = 'Force complete';
      button.addEventListener('click', () => onAction({ type: 'forceComplete', processId: row.id }));
      line.append(label, bar, button);
      return line;
    }));
    if (model.processes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'dt-debug__empty';
      empty.textContent = 'No active processes.';
      processesHost.replaceChildren(empty);
    }
  }
  setModel(initial);

  return {
    setModel,
    destroy(): void {
      abort.abort();
      host.replaceChildren();
    },
  };
}
