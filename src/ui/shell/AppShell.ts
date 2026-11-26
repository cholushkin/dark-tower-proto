import type { AppShellActionHandler, AppShellHandle, AppShellViewModel } from './AppShell.types';
import './AppShell.css';

/**
 * Dark Tower full-HD UI shell — VIEW ONLY.
 * Ported from ViewModelsProto/ui-views/fullhd-shell (screen-shell-view.js), converted to TS.
 * Ownership here is only: currency display, title/back chrome, and the two mount slots the
 * controller fills (`leftColumn` for widgets, `content` for the active screen). No game time,
 * navigation state, or widget composition belongs to this module.
 */

const WIDTH = 1920;
const HEIGHT = 1080;

const coinIcon = `
  <svg viewBox="0 0 56 56" aria-hidden="true" class="shell-currency-icon">
    <ellipse cx="27" cy="40" rx="21" ry="9" fill="#a65b08"/>
    <path d="M6 31v9c0 5 9 9 21 9s21-4 21-9v-9" fill="#d9890e"/>
    <ellipse cx="27" cy="31" rx="21" ry="9" fill="#ffb726"/>
    <ellipse cx="27" cy="31" rx="14" ry="5.3" fill="#e9910a"/>
    <path d="M8 22v8c0 5 8 9 19 9s19-4 19-9v-8" fill="#dd900e"/>
    <ellipse cx="27" cy="22" rx="19" ry="8.6" fill="#ffc83d"/>
    <ellipse cx="27" cy="22" rx="13" ry="5.5" fill="#ef9d0a"/>
  </svg>`;

const crystalIcon = `
  <svg viewBox="0 0 56 56" aria-hidden="true" class="shell-currency-icon">
    <path d="M15 9L37 7 49 22 43 43 25 52 8 37 7 21Z" fill="#007fbd"/>
    <path d="M15 9L37 7 29 23 7 21Z" fill="#50d9ff"/>
    <path d="M37 7L49 22 29 23Z" fill="#20b5f2"/>
    <path d="M7 21L29 23 25 52 8 37Z" fill="#1fb9f7"/>
    <path d="M29 23L49 22 43 43 25 52Z" fill="#0a92d1"/>
  </svg>`;

const backIcon = `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M23 8L6 24l17 16v-9h17V17H23Z" fill="currentColor"/></svg>`;

export function mountAppShell(host: HTMLElement, initial: Readonly<AppShellViewModel>, onAction: AppShellActionHandler = () => {}): AppShellHandle {
  const abort = new AbortController();
  host.innerHTML = `
    <div class="shell-viewport">
      <section class="shell-stage" aria-label="Dark Tower interface">
        <div class="shell-topbar" aria-label="Status bar">
          <div class="shell-money" aria-label="Currencies">
            <div class="shell-currency shell-currency--coins" role="group" aria-label="Coins" tabindex="0" aria-describedby="shell-upkeep-hint">
              ${coinIcon}<span data-shell="coins">0</span>
              <span id="shell-upkeep-hint" class="shell-upkeep-hint" role="tooltip"></span>
            </div>
            <div class="shell-money-divider" aria-hidden="true"></div>
            <div class="shell-currency" aria-label="Crystals">
              ${crystalIcon}<span data-shell="crystals">0</span>
            </div>
          </div>
        </div>
        <div class="shell-left-stack" aria-label="Game widgets"></div>
        <div class="shell-window-header" hidden>
          <button class="shell-back" type="button" aria-label="Back" data-shell-action="back">${backIcon}</button>
          <h1 id="shell-window-title" class="shell-caption" data-shell="title"></h1>
        </div>
        <div class="shell-window" role="region" aria-labelledby="shell-window-title">
          <div class="shell-content"></div>
        </div>
        <div class="shell-overlay" hidden></div>
      </section>
    </div>`;

  const stage = host.querySelector<HTMLElement>('.shell-stage')!;
  const viewport = host.querySelector<HTMLElement>('.shell-viewport')!;
  const leftColumn = host.querySelector<HTMLElement>('.shell-left-stack')!;
  const content = host.querySelector<HTMLElement>('.shell-content')!;
  const overlay = host.querySelector<HTMLElement>('.shell-overlay')!;
  const windowHeader = host.querySelector<HTMLElement>('.shell-window-header')!;
  const back = host.querySelector<HTMLButtonElement>('[data-shell-action="back"]')!;
  const coinsEl = host.querySelector<HTMLElement>('[data-shell="coins"]')!;
  const upkeepHint = host.querySelector<HTMLElement>('#shell-upkeep-hint')!;
  const crystalsEl = host.querySelector<HTMLElement>('[data-shell="crystals"]')!;
  const titleEl = host.querySelector<HTMLElement>('[data-shell="title"]')!;

  back.addEventListener('click', () => onAction({ type: 'back' }), { signal: abort.signal });

  function fit(): void {
    const rect = viewport.getBoundingClientRect();
    const scale = Math.min(rect.width / WIDTH, rect.height / HEIGHT);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
  window.addEventListener('resize', fit, { signal: abort.signal });
  fit();

  function setModel(model: Readonly<AppShellViewModel>): void {
    coinsEl.textContent = new Intl.NumberFormat('en-US').format(model.coins);
    if (upkeepHint.textContent !== model.upkeepHint) upkeepHint.textContent = model.upkeepHint;
    crystalsEl.textContent = new Intl.NumberFormat('en-US').format(model.crystals);
    titleEl.textContent = model.title;
    windowHeader.hidden = !model.windowOpen;
  }
  setModel(initial);

  return {
    slots: { leftColumn, content, overlay },
    setModel,
    destroy(): void {
      abort.abort();
      host.replaceChildren();
    },
  };
}
