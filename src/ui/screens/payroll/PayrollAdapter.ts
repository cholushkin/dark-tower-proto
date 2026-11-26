import { CONFIG } from '../../../data/config';
import type { GameEngine } from '../../../engine/GameEngine';
import type { GameState } from '../../../model/GameState';
import type { PayrollAction, PayrollViewModel } from './PayrollViewModel';

const goldFormat = new Intl.NumberFormat('en-US');

function salaryByRank(state: GameState) {
  const counts = new Map<number, number>();
  for (const minion of state.minions) {
    counts.set(minion.rank, (counts.get(minion.rank) ?? 0) + 1);
  }
  return CONFIG.ranks.flatMap(rank => {
    const count = counts.get(rank.rank);
    return count === undefined ? [] : [{ label: rank.name, count, salary: count * rank.salaryGoldPerWeek }];
  });
}

export function buildUpkeepHint(state: GameState): string {
  const total = `Upkeep ${goldFormat.format(state.weeklySalary())}`;
  const groups = salaryByRank(state).map(({ label, salary }) =>
    `${goldFormat.format(salary)} ${label.toLowerCase()}s`);
  return groups.length ? `${total} (${groups.join(', ')})` : total;
}

export function buildPayrollViewModel(engine: GameEngine): PayrollViewModel {
  const state = engine.state;
  const total = state.weeklySalary();
  const canPayAll = state.gold >= total;

  return {
    currentGoldText: goldFormat.format(state.gold),
    upkeepText: goldFormat.format(total),
    groups: salaryByRank(state).map(({ label, count, salary }) => ({
      label,
      countLabel: `× ${count}`,
      salaryText: goldFormat.format(salary),
    })),
    canPayAll,
    disabledReason: canPayAll ? undefined : 'Not enough gold to pay everyone.',
  };
}

export interface PayrollNav {
  close(): void;
}

export function handlePayrollAction(engine: GameEngine, action: PayrollAction, nav: PayrollNav): void {
  switch (action.type) {
    case 'closeRequested':
      nav.close();
      return;
    case 'payAllRequested':
      if (engine.payPayroll()) nav.close();
      return;
  }
}
