import type { BedSlotHandle, BedSlotViewModel } from './BedSlot.types';
import './BedSlot.css';

/** A visual bed slot, not an interactive assignment control. */
export function mountBedSlot(host: HTMLElement, initial: Readonly<BedSlotViewModel>): BedSlotHandle {
  const root = document.createElement('article');
  root.className = 'dt-bed';
  root.innerHTML = `
    <div class="dt-bed__art" aria-hidden="true">
      <img class="dt-bed__bed-image" alt="">
      <div class="dt-bed__portrait-wrap"><img class="dt-bed__portrait" alt=""></div>
      <span class="dt-bed__sleep-dots">z<span>z</span><span>z</span></span>
    </div>
    <div class="dt-bed__badges"></div>
    <div class="dt-bed__detail"><strong class="dt-bed__name"></strong><div class="dt-bed__timer"><span aria-hidden="true">◷</span><span class="dt-bed__timer-value"></span></div><div class="dt-bed__progress"><div class="dt-bed__progress-fill"></div></div></div>
    <span class="dt-bed__empty-word">Empty bed</span>
  `;
  const get = <T extends HTMLElement = HTMLElement>(selector: string): T => {
    const el = root.querySelector<T>(selector);
    if (!el) throw new Error(`BedSlot missing ${selector}`);
    return el;
  };
  const portraitWrap = get('.dt-bed__portrait-wrap');
  const portraitImage = get<HTMLImageElement>('.dt-bed__portrait');
  const badges = get('.dt-bed__badges');
  const name = get('.dt-bed__name');
  const timer = get('.dt-bed__timer');
  const timerValue = get('.dt-bed__timer-value');
  const progress = get('.dt-bed__progress-fill');
  let destroyed = false;

  function setModel(model: Readonly<BedSlotViewModel>): void {
    if (destroyed) return;
    const occupant = model.occupant;
    root.classList.toggle('dt-bed--empty', !occupant);
    root.classList.toggle('dt-bed--treatment', model.presentation === 'treatment');
    get<HTMLImageElement>('.dt-bed__bed-image').src = model.bedImageSrc;
    root.setAttribute('aria-label', occupant ? `${model.label}: ${occupant.name}, ${model.presentation === 'treatment' ? 'treatment' : 'rest'} remaining ${occupant.remainingLabel}` : `${model.label}: empty`);
    if (!occupant) {
      badges.replaceChildren();
      portraitWrap.hidden = true;
      get('.dt-bed__detail').hidden = true;
      return;
    }
    portraitWrap.hidden = false;
    get('.dt-bed__detail').hidden = false;
    name.textContent = occupant.name;
    timerValue.textContent = occupant.remainingLabel;
    timer.title = occupant.remainingTooltip ?? `${model.presentation === 'treatment' ? 'Treatment' : 'Rest'} remaining: ${occupant.remainingLabel}`;
    progress.style.width = `${Math.max(0, Math.min(1, occupant.restProgress)) * 100}%`;
    portraitImage.hidden = false;
    portraitImage.src = occupant.portrait.src;
    portraitImage.alt = occupant.portrait.alt;
    const newBadges = occupant.conditionBadges.map(badge => {
      const chip = document.createElement('span');
      chip.className = `dt-bed__badge dt-bed__badge--${badge.tone}`;
      chip.textContent = badge.icon;
      chip.title = badge.label;
      chip.setAttribute('aria-label', badge.label);
      return chip;
    });
    badges.replaceChildren(...newBadges);
  }
  host.replaceChildren(root);
  setModel(initial);
  return { setModel, destroy() { if (destroyed) return; destroyed = true; portraitImage.onerror = null; root.remove(); } };
}
