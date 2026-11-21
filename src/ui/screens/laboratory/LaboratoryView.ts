import { mountRoomSummary } from '../../components/RoomSummary/RoomSummary';
import type { LaboratoryActionHandler, LaboratoryViewHandle, LaboratoryViewModel } from './LaboratoryViewModel';
import './LaboratoryView.css';

/** Upgrade presentation and a non-interactive placeholder for future element combination. */
export function mountLaboratoryView(host: HTMLElement, initial: Readonly<LaboratoryViewModel>, onAction: LaboratoryActionHandler): LaboratoryViewHandle {
  const root = document.createElement('main');
  root.className = 'dt-laboratory';
  root.innerHTML = `<section class="lab-window" aria-label="Laboratory window">
    <div class="dt-room-summary-host"></div>
    <section class="lab-alchemy" aria-labelledby="lab-alchemy-title">
      <h2 id="lab-alchemy-title">ALCHEMY</h2>
      <div class="lab-alchemy__recipe" role="img" aria-label="Alchemy: first element plus second element equals a result. Coming soon.">
        <div class="lab-alchemy__slot"><span aria-hidden="true">◇</span><span>Element 1</span></div>
        <span class="lab-alchemy__operator" aria-hidden="true">+</span>
        <div class="lab-alchemy__slot"><span aria-hidden="true">◇</span><span>Element 2</span></div>
        <span class="lab-alchemy__operator" aria-hidden="true">=</span>
        <div class="lab-alchemy__slot lab-alchemy__slot--result"><span aria-hidden="true">✧</span><span>Result</span></div>
      </div>
      <p>Combine elements · Coming soon</p>
    </section>
  </section>`;
  host.replaceChildren(root);
  const summary = mountRoomSummary(root.querySelector<HTMLElement>('.dt-room-summary-host')!, initial.room, initial.upgrades,
    upgradeId => onAction({ type: 'upgradeRequested', upgradeId }));
  let destroyed = false;
  return {
    setModel(model) { if (!destroyed) summary.setModel(model.room, model.upgrades); },
    destroy() { if (destroyed) return; destroyed = true; summary.destroy(); root.remove(); },
  };
}
