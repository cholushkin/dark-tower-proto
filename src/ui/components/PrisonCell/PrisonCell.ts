import type { PrisonCellHandle, PrisonCellViewModel } from './PrisonCell.types';
import './PrisonCell.css';

/** Presentational cell: no assignment, capture, outcome roll, timekeeping or game mutations. */
export function mountPrisonCell(host: HTMLElement, initial: Readonly<PrisonCellViewModel>): PrisonCellHandle {
  const root = document.createElement('article');
  root.className = 'dt-cell';
  root.innerHTML = `
    <div class="dt-cell__scene" aria-hidden="true">
      <img class="dt-cell__art" alt="">
      <img class="dt-cell__scene-image" alt="" hidden>
      <span class="dt-cell__portrait-emoji" hidden></span>
    </div>
    <div class="dt-cell__occupied-detail" hidden>
      <strong class="dt-cell__process-label"></strong>
      <div class="dt-cell__progress" role="progressbar" aria-valuemin="0" aria-valuemax="100">
        <div class="dt-cell__progress-fill"></div>
        <span class="dt-cell__remaining"></span>
      </div>
    </div>`;
  const get = <T extends HTMLElement = HTMLElement>(selector: string): T => {
    const el = root.querySelector<T>(selector);
    if (!el) throw new Error(`PrisonCell missing ${selector}`);
    return el;
  };
  const cellArt = get<HTMLImageElement>('.dt-cell__art');
  const sceneImage = get<HTMLImageElement>('.dt-cell__scene-image');
  const emoji = get('.dt-cell__portrait-emoji');
  const progress = get<HTMLElement>('.dt-cell__progress');
  const progressFill = get<HTMLElement>('.dt-cell__progress-fill');
  let destroyed = false;

  function setModel(model: Readonly<PrisonCellViewModel>): void {
    if (destroyed) return;
    const { prisoner } = model;
    if (cellArt.getAttribute('src') !== model.emptyArtSrc) cellArt.src = model.emptyArtSrc;
    root.classList.toggle('dt-cell--empty', !prisoner);
    root.setAttribute('aria-label', prisoner ? `${model.label}: ${prisoner.name}, ${prisoner.processLabel}, ${prisoner.remainingLabel} left` : `${model.label}: Empty Cell`);
    if (!prisoner) {
      sceneImage.onerror = null;
      sceneImage.hidden = true;
      sceneImage.removeAttribute('src');
      emoji.hidden = true;
      get('.dt-cell__occupied-detail').hidden = true;
      return;
    }
    get('.dt-cell__occupied-detail').hidden = false;
    get('.dt-cell__process-label').textContent = prisoner.processLabel;
    get('.dt-cell__remaining').textContent = prisoner.remainingLabel;
    get('.dt-cell__remaining').title = prisoner.remainingTooltip ?? `${prisoner.processLabel}: ${prisoner.remainingLabel} remaining`;
    const percentage = Math.max(0, Math.min(1, prisoner.progress)) * 100;
    progressFill.style.width = `${percentage}%`;
    progress.setAttribute('aria-label', `${prisoner.processLabel} progress for ${prisoner.name}`);
    progress.setAttribute('aria-valuenow', `${Math.round(percentage)}`);
    progress.setAttribute('aria-valuetext', `${prisoner.remainingLabel} remaining`);
    if (prisoner.portrait.kind === 'texture') {
      sceneImage.hidden = false;
      emoji.hidden = true;
      if (sceneImage.getAttribute('src') !== prisoner.portrait.src) sceneImage.src = prisoner.portrait.src;
      sceneImage.alt = prisoner.portrait.alt;
      sceneImage.onerror = () => {
        if (destroyed) return;
        sceneImage.hidden = true;
        emoji.hidden = false;
        emoji.textContent = prisoner.portrait.kind === 'texture' ? (prisoner.portrait.fallbackEmoji ?? '👹') : '👹';
      };
    } else {
      sceneImage.onerror = null;
      sceneImage.hidden = true;
      emoji.hidden = false;
      emoji.textContent = prisoner.portrait.value;
      sceneImage.removeAttribute('src');
    }
  }
  host.replaceChildren(root);
  setModel(initial);
  return { setModel, destroy() { if (destroyed) return; destroyed = true; sceneImage.onerror = null; root.remove(); } };
}
