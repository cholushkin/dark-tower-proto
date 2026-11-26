import { actionButton, createPopupFrame, element, statRow } from '../../components/PopupFrame/PopupFrame';
import type { PayrollAction, PayrollViewModel } from './PayrollViewModel';
import '../../components/PopupFrame/PopupFrame.css';
import './PayrollView.css';

export interface PayrollView {
  setModel(model: Readonly<PayrollViewModel>): void;
  destroy(): void;
}

export function mountPayrollView(
  host: HTMLElement,
  model: Readonly<PayrollViewModel>,
  onAction: (action: PayrollAction) => void,
): PayrollView {
  function setModel(current: Readonly<PayrollViewModel>): void {
    const frame = createPopupFrame({
      title: 'Payroll',
      modifier: 'payroll',
      caption: 'plain',
      onClose: () => onAction({ type: 'closeRequested' }),
    });
    frame.body.append(
      statRow({ id: 'gold', icon: '🪙', label: 'Current Gold', value: current.currentGoldText }),
      statRow({ id: 'upkeep', icon: '⌛', label: 'Weekly Upkeep', value: current.upkeepText, tone: 'negative' }),
    );

    if (current.groups.length) {
      const groups = element('ul', 'dt-salary-groups');
      groups.setAttribute('aria-label', 'Upkeep by rank');
      for (const group of current.groups) {
        const row = element('li', 'dt-salary-row');
        row.append(
          element('span', '', group.label),
          element('span', 'dt-salary-row__count', group.countLabel),
          element('strong', 'dt-salary-row__value', group.salaryText),
        );
        groups.append(row);
      }
      frame.body.append(groups);
    }

    const pay = actionButton('Pay All', 'gold', () => onAction({ type: 'payAllRequested' }), !current.canPayAll, '🪙');
    if (current.disabledReason) pay.title = current.disabledReason;
    frame.footer.append(pay);
    host.replaceChildren(frame.root);
  }

  setModel(model);
  return { setModel, destroy: () => host.replaceChildren() };
}
