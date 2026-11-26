export interface PayrollGroupViewModel {
  label: string;
  countLabel: string;
  salaryText: string;
}

export interface PayrollViewModel {
  currentGoldText: string;
  upkeepText: string;
  groups: readonly PayrollGroupViewModel[];
  canPayAll: boolean;
  disabledReason?: string;
}

export type PayrollAction = { type: 'payAllRequested' } | { type: 'closeRequested' };
