import type { MissionPinHandle, MissionPinViewModel } from './MissionPin.types';
import './MissionPin.css';
/** Interactive map locator; never computes game rules or raid outcomes. */
export function mountMissionPin(host: HTMLElement, initial: Readonly<MissionPinViewModel>, onSelect: (id: string) => void): MissionPinHandle {
  const controller = new AbortController();
  let model = initial;
  let disposed = false;
  let tooltipSignature = '';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dt-mission-pin';
  button.innerHTML = `<span class="dt-mission-pin__marker" aria-hidden="true">
    <svg class="dt-mission-pin__flag" viewBox="0 0 40 44"><path d="M10 39V5"/><path d="M11 6C20 0 24 13 34 6V24C24 31 20 18 11 24Z"/></svg>
    <span class="dt-mission-pin__activity" hidden><svg viewBox="0 0 44 44"><circle class="dt-mission-pin__track" cx="22" cy="22" r="19"/><circle class="dt-mission-pin__progress" cx="22" cy="22" r="19" pathLength="1" transform="rotate(-90 22 22)"/></svg><span class="dt-mission-pin__activity-symbol"></span></span>
    </span><span class="dt-mission-pin__completion" aria-hidden="true" hidden>✓</span><span class="dt-mission-pin__defenders" aria-hidden="true" hidden></span><span class="dt-mission-pin__tooltip" role="tooltip"></span>`;
  const flag = button.querySelector<SVGElement>('.dt-mission-pin__flag')!;
  const activity = button.querySelector<HTMLElement>('.dt-mission-pin__activity')!;
  const symbol = button.querySelector<HTMLElement>('.dt-mission-pin__activity-symbol')!;
  const progress = button.querySelector<SVGCircleElement>('.dt-mission-pin__progress')!;
  const tooltip = button.querySelector<HTMLElement>('.dt-mission-pin__tooltip')!;
  const defenders = button.querySelector<HTMLElement>('.dt-mission-pin__defenders')!;
  const completion = button.querySelector<HTMLElement>('.dt-mission-pin__completion')!;
  tooltip.id = `mission-tooltip-${initial.id}`;
  button.setAttribute('aria-describedby', tooltip.id);
  button.addEventListener('click', () => { if (!disposed) onSelect(model.id); }, { signal: controller.signal });
  const positionTooltip = () => {
    const viewport = button.closest('.dt-warroom__map-viewport');
    if (!viewport || !button.matches(':hover, :focus-visible')) return;
    tooltip.style.left = '50%';
    tooltip.style.top = 'auto';
    tooltip.style.bottom = 'calc(100% + 8px)';
    const area = viewport.getBoundingClientRect();
    const bounds = tooltip.getBoundingClientRect();
    const shift = Math.max(area.left + 8 - bounds.left, Math.min(0, area.right - 8 - bounds.right));
    tooltip.style.left = `calc(50% + ${shift}px)`;
    if (bounds.top < area.top + 8) {
      tooltip.style.top = 'calc(100% + 8px)';
      tooltip.style.bottom = 'auto';
    }
  };
  button.addEventListener('pointerenter', positionTooltip, { signal: controller.signal });
  button.addEventListener('focus', () => requestAnimationFrame(() => { if (!disposed) positionTooltip(); }), { signal: controller.signal });
  host.replaceChildren(button);
  const setModel = (next: Readonly<MissionPinViewModel>) => {
    if (disposed) return;
    model = next;
    button.hidden = next.state === 'locked';
    button.dataset.state = next.state;
    button.dataset.missionId = next.id;
    button.classList.toggle('dt-mission-pin--selected', !!next.selected);
    const returning = next.state === 'reportReady';
    if (returning) {
      button.setAttribute('aria-haspopup', 'dialog');
      button.removeAttribute('aria-pressed');
    } else {
      button.removeAttribute('aria-haspopup');
      button.setAttribute('aria-pressed', String(!!next.selected));
    }
    button.style.left = `${next.x}%`;
    button.style.top = `${next.y}%`;
    const running = next.state === 'inProgress';
    flag.style.display = running || returning ? 'none' : '';
    activity.hidden = !running && !returning;
    const icon = returning ? '↩︎' : '⚔️';
    if (symbol.textContent !== icon) symbol.textContent = icon;
    defenders.hidden = next.defendersLabel === undefined;
    defenders.textContent = next.defendersLabel === undefined ? '' : `🛡 ${next.defendersLabel}`;
    completion.hidden = !next.completed;
    const fraction = Math.max(0, Math.min(1, next.progress ?? (returning ? 1 : 0)));
    progress.style.strokeDashoffset = String(1 - fraction);
    const desc = `${next.statusLabel}${next.progress === undefined ? '' : `, ${Math.round(fraction * 100)}%`}`;
    button.setAttribute('aria-label', `${next.name}, tier ${next.tier}, ${desc}${next.defendersLabel === undefined ? '' : `, ${next.defendersLabel} active defenders`}${next.completed ? ', permanently completed' : ''}`);
    const signature = JSON.stringify([next.name, desc, next.parameters, next.rewards]);
    if (signature !== tooltipSignature) {
      tooltipSignature = signature;
      const title = document.createElement('strong');
      title.textContent = next.name;
      const status = document.createElement('span');
      status.className = 'dt-mission-pin__status';
      status.textContent = desc;
      const details = document.createElement('span');
      details.className = 'dt-mission-pin__details';
      for (const parameter of next.parameters) {
        const row = document.createElement('span');
        row.setAttribute('aria-label', parameter.description);
        row.textContent = `${parameter.icon} ${parameter.value}`;
        details.append(row);
      }
      const rewards = document.createElement('span');
      rewards.className = 'dt-mission-pin__loot';
      for (const reward of next.rewards) {
        const row = document.createElement('span');
        row.setAttribute('aria-label', reward.label);
        if (reward.icon.kind === 'texture') {
          const image = document.createElement('img');
          image.src = reward.icon.src;
          image.alt = reward.icon.alt;
          const fallback = reward.icon.fallbackEmoji ?? '📦';
          image.addEventListener('error', () => image.replaceWith(document.createTextNode(fallback)), { once: true });
          row.append(image);
        } else row.append(document.createTextNode(reward.icon.value));
        row.append(document.createTextNode(` ${reward.chanceLabel || '?'}`));
        rewards.append(row);
      }
      tooltip.replaceChildren(title, status, details, rewards);
    }
    positionTooltip();
  };
  setModel(initial);
  return { setModel, destroy() { disposed = true; controller.abort(); button.remove(); } };
}
