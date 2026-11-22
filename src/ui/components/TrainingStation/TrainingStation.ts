import type { TrainingStationAction, TrainingStationHandle, TrainingStationViewModel } from './TrainingStation.types';
import './TrainingStation.css';

/** Read-only station; assignment is performed through the minion roster. */
export function mountTrainingStation(host: HTMLElement, initial: Readonly<TrainingStationViewModel>, _onAction: (action: TrainingStationAction) => void): TrainingStationHandle {
  const root = document.createElement('article');
  root.className = 'dt-station';
  root.innerHTML = `
    <div class="dt-station__tile">
      <img class="dt-station__art" alt="" />
      <div class="dt-station__portrait-wrap" hidden><img class="dt-station__portrait" alt="" /></div>
    </div>
    <div class="dt-station__activity" hidden>
      <strong class="dt-station__process-label"></strong>
      <div class="dt-station__progress" role="progressbar" aria-valuemin="0" aria-valuemax="100">
        <div class="dt-station__progress-fill"></div>
        <span class="dt-station__time"></span>
      </div>
    </div>
  `;
  const get = <T extends HTMLElement = HTMLElement>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`TrainingStation missing ${selector}`);
    return element;
  };
  const art = get<HTMLImageElement>('.dt-station__art');
  const portrait = get<HTMLImageElement>('.dt-station__portrait');
  const portraitWrap = get('.dt-station__portrait-wrap');
  const activity = get('.dt-station__activity');
  const progress = get('.dt-station__progress');
  let destroyed = false;

  function setModel(model: Readonly<TrainingStationViewModel>): void {
    if (destroyed) return;
    const minion = model.occupant;
    root.classList.toggle('dt-station--occupied', !!minion);
    root.classList.toggle('dt-station--empty', !minion);
    root.setAttribute('aria-label', `${model.label}: ${minion ? 'training in progress' : 'empty'}`);
    if (art.getAttribute('src') !== model.artworkSrc) art.src = model.artworkSrc;
    art.alt = model.artworkAlt;
    portraitWrap.hidden = !minion;
    activity.hidden = !minion;
    if (!minion) return;

    const label = `${minion.rankLabel} → ${minion.nextRankLabel}`;
    get('.dt-station__process-label').textContent = label;
    get('.dt-station__time').textContent = minion.timeRemainingLabel;
    const percentage = Math.max(0, Math.min(1, minion.progress)) * 100;
    get('.dt-station__progress-fill').style.width = `${percentage}%`;
    progress.setAttribute('aria-label', `${label}: ${minion.timeRemainingLabel} remaining`);
    progress.setAttribute('aria-valuenow', String(Math.round(percentage)));
    progress.setAttribute('aria-valuetext', `${minion.timeRemainingLabel} remaining`);
    if (portrait.getAttribute('src') !== minion.portrait.src) portrait.src = minion.portrait.src;
    portrait.alt = minion.portrait.alt;
  }
  host.replaceChildren(root);
  setModel(initial);
  return { setModel, destroy() { if (destroyed) return; destroyed = true; root.remove(); } };
}
