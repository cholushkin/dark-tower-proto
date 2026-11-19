import type {
  MinionComponentActionHandler,
  MinionComponentHandle,
  MinionComponentViewModel,
} from './MinionComponent.types';
import './MinionComponent.css';

let nextInstanceId = 0;

/** Reusable square, framework-free, game-state-free minion presentation. */
export function mountMinionComponent(
  host: HTMLElement,
  initialModel: Readonly<MinionComponentViewModel>,
  onAction: MinionComponentActionHandler = () => {},
): MinionComponentHandle {
  const token = ++nextInstanceId;
  const abort = new AbortController();
  let model = initialModel;
  let disposed = false;
  let pinnedInfo = false;

  const root = document.createElement('article');
  root.className = 'dt-minion';
  root.innerHTML = `
    <button class="dt-minion__info" type="button" aria-label="Minion information" aria-describedby="dt-minion-info-${token}" aria-expanded="false">
      i<span class="dt-minion__tooltip dt-minion__info-tooltip" id="dt-minion-info-${token}" role="tooltip"></span>
    </button>
    <div class="dt-minion__name"></div>
    <div class="dt-minion__rank" tabindex="0">
      <span class="dt-minion__rank-label"></span>
      <span class="dt-minion__tooltip dt-minion__rank-tooltip" role="tooltip"></span>
    </div>
    <div class="dt-minion__portrait" aria-hidden="true">
      <img class="dt-minion__portrait-texture" alt="" hidden />
    </div>
    <div class="dt-minion__statuses" aria-label="Minion statuses">
    <div class="dt-minion__conditions" aria-label="Conditions"></div>
    <div class="dt-minion__status" tabindex="0" role="status">
      <span class="dt-minion__status-icon" aria-hidden="true"></span>
      <svg class="dt-minion__status-ring" viewBox="0 0 36 36" aria-hidden="true"><circle class="dt-minion__ring-track" cx="18" cy="18" r="16"/><circle class="dt-minion__ring-fill" cx="18" cy="18" r="16" pathLength="1" transform="rotate(-90 18 18)"/></svg>
      <span class="dt-minion__tooltip dt-minion__status-tooltip" role="tooltip"></span>
    </div>
    </div>
  `;

  function required<T extends Element>(selector: string): T {
    const node = root.querySelector<T>(selector);
    if (!node) throw new Error(`MinionComponent markup missing ${selector}`);
    return node;
  }

  const info = required<HTMLButtonElement>('.dt-minion__info');
  const infoTooltip = required<HTMLElement>('.dt-minion__info-tooltip');
  const name = required<HTMLElement>('.dt-minion__name');
  const rank = required<HTMLElement>('.dt-minion__rank');
  const rankLabel = required<HTMLElement>('.dt-minion__rank-label');
  const rankTooltip = required<HTMLElement>('.dt-minion__rank-tooltip');
  const portraitTexture = required<HTMLImageElement>('.dt-minion__portrait-texture');
  const conditions = required<HTMLElement>('.dt-minion__conditions');
  const status = required<HTMLElement>('.dt-minion__status');
  const statusIcon = required<HTMLElement>('.dt-minion__status-icon');
  const statusRing = required<SVGElement>('.dt-minion__status-ring');
  const statusRingFill = required<SVGCircleElement>('.dt-minion__ring-fill');
  const statusTooltip = required<HTMLElement>('.dt-minion__status-tooltip');

  // Native popovers live in the browser top layer, outside card stacking and clipping.
  const anchorSelector = '.dt-minion__info,.dt-minion__rank,.dt-minion__condition,.dt-minion__status';
  let hovered: HTMLElement | null = null;
  let activeTooltip: HTMLElement | null = null;
  let activeAnchor: HTMLElement | null = null;

  function fitTooltip(): void {
    if (!activeTooltip || !activeAnchor) return;
    const anchor = activeAnchor.getBoundingClientRect();
    const bounds = activeTooltip.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(anchor.left, window.innerWidth - bounds.width - margin));
    const above = anchor.top - bounds.height - margin;
    const top = above >= margin ? above : Math.min(anchor.bottom + margin, window.innerHeight - bounds.height - margin);
    activeTooltip.style.left = `${left}px`;
    activeTooltip.style.top = `${Math.max(margin, top)}px`;
  }

  function refreshTooltip(): void {
    if (disposed) return;
    if (hovered && !root.contains(hovered)) hovered = null;
    const focused = root.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).closest<HTMLElement>(anchorSelector) : null;
    const anchor = hovered ?? focused ?? (pinnedInfo ? info : null);
    const tooltip = anchor?.querySelector<HTMLElement>('.dt-minion__tooltip') ?? null;
    if (activeTooltip !== tooltip) {
      if (activeTooltip?.matches(':popover-open')) activeTooltip.hidePopover();
      activeTooltip = tooltip;
      activeAnchor = anchor;
      if (tooltip) {
        tooltip.setAttribute('popover', 'manual');
        if (!tooltip.id) tooltip.id = `dt-minion-tooltip-${token}-${anchor === rank ? 'rank' : anchor === status ? 'status' : anchor?.dataset.conditionId}`;
        anchor!.setAttribute('aria-describedby', tooltip.id);
        tooltip.showPopover();
      }
    }
    fitTooltip();
  }

  root.addEventListener('pointerover', event => {
    hovered = (event.target as HTMLElement).closest<HTMLElement>(anchorSelector);
    refreshTooltip();
  }, { signal: abort.signal });
  root.addEventListener('pointerout', event => {
    const target = event.relatedTarget;
    hovered = target instanceof HTMLElement && root.contains(target) ? target.closest<HTMLElement>(anchorSelector) : null;
    refreshTooltip();
  }, { signal: abort.signal });
  root.addEventListener('focusin', refreshTooltip, { signal: abort.signal });
  root.addEventListener('focusout', () => queueMicrotask(refreshTooltip), { signal: abort.signal });
  window.addEventListener('resize', fitTooltip, { signal: abort.signal });
  document.addEventListener('scroll', fitTooltip, { capture: true, passive: true, signal: abort.signal });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    pinnedInfo = false;
    hovered = null;
    info.setAttribute('aria-expanded', 'false');
    if (activeTooltip?.matches(':popover-open')) activeTooltip.hidePopover();
    activeTooltip = null;
    activeAnchor = null;
  }, { signal: abort.signal });

  info.addEventListener('click', () => {
    pinnedInfo = !pinnedInfo;
    info.setAttribute('aria-expanded', String(pinnedInfo));
    refreshTooltip();
    if (!disposed) onAction({ type: 'infoRequested', minionId: model.id });
  }, { signal: abort.signal });


  const conditionNodes = new Map<string, HTMLElement>();
  function renderConditions(): void {
    const renderList: HTMLElement[] = [];
    const activeKeys = new Set<string>();
    for (const condition of model.conditions) {
      activeKeys.add(condition.id);
      let node = conditionNodes.get(condition.id);
      if (!node) {
        node = document.createElement('div');
        node.className = 'dt-minion__condition';
        node.dataset.conditionId = condition.id;
        node.tabIndex = 0;
        node.innerHTML = `
          <span class="dt-minion__condition-icon" aria-hidden="true"></span>
          <span class="dt-minion__tooltip dt-minion__condition-tooltip" role="tooltip"></span>
        `;
        conditionNodes.set(condition.id, node);
      }
      node.dataset.tone = condition.tone;
      node.querySelector<HTMLElement>('.dt-minion__condition-icon')!.textContent = condition.icon;
      node.querySelector<HTMLElement>('.dt-minion__condition-tooltip')!.textContent = condition.tooltip ?? condition.label;
      node.setAttribute('aria-label', condition.tooltip ?? condition.label);
      renderList.push(node);
    }
    for (const id of conditionNodes.keys()) if (!activeKeys.has(id)) conditionNodes.delete(id);
    if (conditions.childElementCount !== renderList.length || renderList.some((node, index) => conditions.children[index] !== node)) conditions.replaceChildren(...renderList);
    conditions.classList.toggle('dt-minion__conditions--empty', renderList.length === 0);
  }

  function setModel(next: Readonly<MinionComponentViewModel>): void {
    if (disposed) return;
    model = next;
    root.dataset.minionId = model.id;
    root.setAttribute('aria-label', `${model.name}, ${model.rank.label}, ${model.status.label}`);
    name.textContent = model.name;
    name.title = model.name;
    rankLabel.textContent = model.rank.label.match(/R\d+/)?.[0] ?? model.rank.label;
    rankTooltip.textContent = model.rank.tooltip ?? `Rank: ${model.rank.label}`;
    rank.setAttribute('aria-label', model.rank.tooltip ?? `Rank: ${model.rank.label}`);
    info.setAttribute('aria-label', `Information about ${model.name}`);
    infoTooltip.textContent = model.description;

    portraitTexture.hidden = false;
    portraitTexture.alt = model.portrait.alt;
    if (portraitTexture.getAttribute('src') !== model.portrait.src) portraitTexture.src = model.portrait.src;

    renderConditions();
    statusIcon.textContent = model.status.icon;
    statusRing.style.display = model.status.progress === undefined ? 'none' : 'block';
    statusRingFill.style.strokeDashoffset = String(1 - Math.max(0, Math.min(1, model.status.progress ?? 0)));
    statusTooltip.textContent = model.status.tooltip ?? model.status.label;
    status.setAttribute('aria-label', model.status.tooltip ?? model.status.label);
    if (activeTooltip && !activeTooltip.isConnected) { activeTooltip = null; activeAnchor = null; }
    if (activeTooltip) fitTooltip();
  }

  host.replaceChildren(root);
  setModel(initialModel);
  return {
    setModel,
    destroy(): void {
      if (disposed) return;
      disposed = true;
      if (activeTooltip?.matches(':popover-open')) activeTooltip.hidePopover();
      abort.abort();
      conditionNodes.clear();
      root.remove();
    },
  };
}
