import type {
  ItemComponentAction,
  ItemComponentActionHandler,
  ItemComponentHandle,
  ItemComponentViewModel,
} from './ItemComponent.types';
import './ItemComponent.css';

let nextInstanceId = 0;

/**
 * A reusable, engine-agnostic item presentation. Tags are deliberately not
 * rendered: the parent gallery owns filtering; the host owns game state.
 */
export function mountItemComponent(
  host: HTMLElement,
  initialModel: Readonly<ItemComponentViewModel>,
  onAction: ItemComponentActionHandler,
): ItemComponentHandle {
  const instanceId = ++nextInstanceId;
  const infoTooltipId = `dt-item-info-${instanceId}`;
  const stackTooltipId = `dt-item-stack-${instanceId}`;
  const abort = new AbortController();
  let model = initialModel;
  let failedSrc: string | undefined;
  let disposed = false;

  // Fixed, trusted DOM skeleton. All ViewModel values use textContent/attributes.
  const root = document.createElement('article');
  root.className = 'dt-item';
  root.innerHTML = `
    <div class="dt-item__tile">
      <button class="dt-item__info dt-item__corner" type="button" aria-label="Item information" aria-describedby="${infoTooltipId}">
        i<span id="${infoTooltipId}" class="dt-item__tooltip dt-item__tooltip--left" role="tooltip"></span>
      </button>
      <span class="dt-item__stack dt-item__corner" tabindex="0" aria-describedby="${stackTooltipId}">
        <span class="dt-item__stack-label"></span>
        <span id="${stackTooltipId}" class="dt-item__tooltip dt-item__tooltip--right" role="tooltip"></span>
      </span>
      <div class="dt-item__art" aria-hidden="true">
        <span class="dt-item__emoji"></span>
        <img class="dt-item__texture" alt="" hidden />
      </div>
      <div class="dt-item__name"></div>
    </div>
    <div class="dt-item__sale-area">
      <button class="dt-item__sell" type="button">
        <span class="dt-item__sell-label"></span>
        <span class="dt-item__progress" aria-hidden="true" hidden>
          <span class="dt-item__progress-fill"></span>
          <span class="dt-item__remaining"></span>
        </span>
      </button>
      <button class="dt-item__instant-sell" type="button" hidden></button>
    </div>
  `;

  function required<T extends Element>(selector: string): T {
    const node = root.querySelector<T>(selector);
    if (!node) throw new Error(`ItemComponent template is missing ${selector}`);
    return node;
  }

  const info = required<HTMLButtonElement>('.dt-item__info');
  const infoTooltip = required<HTMLElement>('.dt-item__tooltip--left');
  const stack = required<HTMLElement>('.dt-item__stack');
  const stackLabel = required<HTMLElement>('.dt-item__stack-label');
  const stackTooltip = required<HTMLElement>('.dt-item__tooltip--right');
  const emoji = required<HTMLElement>('.dt-item__emoji');
  const texture = required<HTMLImageElement>('.dt-item__texture');
  const name = required<HTMLElement>('.dt-item__name');
  const sell = required<HTMLButtonElement>('.dt-item__sell');
  const sellLabel = required<HTMLElement>('.dt-item__sell-label');
  const instantSell = required<HTMLButtonElement>('.dt-item__instant-sell');
  const progressBar = required<HTMLElement>('.dt-item__progress');
  const progressFill = required<HTMLElement>('.dt-item__progress-fill');
  const remaining = required<HTMLElement>('.dt-item__remaining');

  const dispatch = (type: ItemComponentAction['type']): void => {
    if (!disposed) onAction({ type, itemId: model.id });
  };

  sell.addEventListener('click', () => {
    if (model.sale.status === 'selling') dispatch('cancelSaleRequested');
    else if (model.sale.canSell) dispatch('sellRequested');
  }, { signal: abort.signal });
  instantSell.addEventListener('click', () => {
    if (model.sale.canInstantSell) dispatch('instantSellRequested');
  }, { signal: abort.signal });

  // Presentation-only tooltip positioning near the edge of the viewport.
  function fitTooltip(tooltip: HTMLElement): void {
    tooltip.style.left = '';
    tooltip.style.right = '';
    const rect = tooltip.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      tooltip.style.left = 'auto';
      tooltip.style.right = '0';
    }
    if (tooltip.getBoundingClientRect().left < 8) {
      tooltip.style.right = 'auto';
      tooltip.style.left = '0';
    }
  }
  for (const [anchor, tooltip] of [
    [info, infoTooltip], [stack, stackTooltip],
  ] as const) {
    anchor.addEventListener('mouseenter', () => fitTooltip(tooltip), { signal: abort.signal });
    anchor.addEventListener('focus', () => fitTooltip(tooltip), { signal: abort.signal });
  }

  texture.addEventListener('error', () => {
    failedSrc = texture.getAttribute('src') ?? undefined;
    texture.hidden = true;
    emoji.hidden = false;
    emoji.textContent = model.icon.kind === 'texture' ? (model.icon.fallbackEmoji ?? '📦') : model.icon.value;
  }, { signal: abort.signal });

  function setModel(updated: Readonly<ItemComponentViewModel>): void {
    if (disposed) return;
    model = updated;
    root.dataset.itemId = model.id;
    root.dataset.status = model.sale.status;
    root.classList.toggle('dt-item--selling', model.sale.status === 'selling');
    root.classList.toggle('dt-item--disabled', model.sale.status === 'ready' && !model.sale.canSell);

    name.textContent = model.title;
    info.setAttribute('aria-label', `About ${model.title}`);
    infoTooltip.textContent = model.description;
    stackLabel.textContent = model.stack.label;
    stackTooltip.textContent = model.stack.tooltip;
    stack.setAttribute('aria-label', model.stack.tooltip);

    if (model.icon.kind === 'emoji') {
      texture.hidden = true;
      emoji.hidden = false;
      emoji.textContent = model.icon.value;
    } else {
      const failed = failedSrc === model.icon.src;
      emoji.hidden = !failed;
      texture.hidden = failed;
      emoji.textContent = model.icon.fallbackEmoji ?? '📦';
      texture.alt = model.icon.alt;
      // Avoid re-fetching the texture once per timer tick.
      if (texture.getAttribute('src') !== model.icon.src) {
        failedSrc = undefined;
        texture.src = model.icon.src;
      }
    }

    const sale = model.sale;
    sellLabel.textContent = sale.sellLabel;
    progressBar.hidden = sale.status !== 'selling';
    instantSell.hidden = !sale.instantSellLabel;
    instantSell.textContent = sale.instantSellLabel ?? '';
    instantSell.disabled = !sale.canInstantSell;
    instantSell.title = instantSell.disabled ? (sale.instantSellDisabledReason ?? 'Unavailable') : '';

    if (sale.status === 'selling') {
      sell.disabled = false;
      sell.title = 'Click to cancel sale';
      sell.setAttribute('aria-label', `${sale.sellLabel}. ${sale.remainingLabel} remaining. Cancel sale`);
      remaining.textContent = sale.remainingLabel;
      const progress = Math.min(1, Math.max(0, sale.progress));
      progressFill.style.width = `${progress * 100}%`;
    } else {
      sell.removeAttribute('aria-label');
      sell.disabled = !sale.canSell;
      sell.title = sell.disabled ? (sale.disabledReason ?? 'Unavailable') : '';
      progressFill.style.width = '0%';
    }
  }

  host.replaceChildren(root);
  setModel(initialModel);

  return {
    setModel,
    destroy(): void {
      if (disposed) return;
      disposed = true;
      abort.abort();
      root.remove();
    },
  };
}
