/** Shared visual popup shell; no domain-specific behavior or state. */
export interface PopupFrameOptions {
  title: string;
  modifier: 'week' | 'payroll' | 'game-over' | 'victory' | 'battle';
  caption?: 'banner' | 'plain';
  onClose?: () => void;
}
export interface PopupFrameElements { root: HTMLElement; body: HTMLElement; footer: HTMLElement; close: HTMLButtonElement | null; }
export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', content?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (content !== undefined) e.textContent = content;
  return e;
}
export function createPopupFrame({title,modifier,caption='banner',onClose}: PopupFrameOptions): PopupFrameElements {
  const root=element('section',`dt-popup dt-popup--${modifier}`);
  root.setAttribute('role','dialog'); root.setAttribute('aria-modal','true');root.setAttribute('aria-label',title);
  const plain = caption === 'plain';
  const banner=element('header',plain ? 'dt-popup-caption' : 'dt-popup__banner');
  const decoration=plain ? element('span','dt-popup-caption__dot') : element('span','dt-popup__diamond','◆');
  decoration.setAttribute('aria-hidden','true');
  banner.append(decoration,element('h1',plain ? '' : 'dt-popup__title',title),decoration.cloneNode(true));
  root.append(banner);
  let close: HTMLButtonElement | null = null;
  if (onClose) {
    close = element('button', plain ? 'dt-popup-caption__close' : 'dt-popup__x', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', onClose);
    (plain ? banner : root).append(close);
  }
  const body=element('div','dt-popup__body');root.append(body);
  const footer=element('footer','dt-popup__footer');root.append(footer);
  return {root,body,footer,close};
}
export function actionButton(label:string, kind:'gold'|'outline', action:()=>void, disabled=false, icon=''):HTMLButtonElement {
  const button=element('button',`dt-action dt-action--${kind}`);button.type='button';button.disabled=disabled;
  if(icon){const ic=element('span','dt-action__icon',icon);ic.setAttribute('aria-hidden','true');button.append(ic);}
  button.append(element('span','',label));button.addEventListener('click',action);return button;
}
export interface StatRowViewModel { id:string; icon:string; label:string; value:string; tone?:'normal'|'positive'|'negative'; }
export function statRow(stat:StatRowViewModel):HTMLElement {
  const row=element('div','dt-stat'); row.dataset.statId=stat.id;
  row.append(element('span','dt-stat__icon',stat.icon),element('span','dt-stat__label',stat.label));
  const value=element('strong',`dt-stat__value${stat.tone?' dt-stat__value--'+stat.tone:''}`,stat.value);
  row.append(value);return row;
}
export function artPanel(src:string, alt:string, modifier:string):HTMLElement {
  const container=element('div',`dt-art dt-art--${modifier}`);
  const image=element('img');image.src=src;image.alt=alt;image.loading='eager';
  container.append(image);return container;
}
