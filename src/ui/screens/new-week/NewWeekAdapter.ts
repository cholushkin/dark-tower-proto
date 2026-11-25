import type { GameEngine } from '../../../engine/GameEngine';
import { asset } from '../assets';
import { fmtHours } from '../shared';
import type { NewWeekAction, NewWeekViewModel } from './NewWeekViewModel';

const illustration = asset('week-spider.webp');

export function buildNewWeekViewModel(engine: GameEngine): NewWeekViewModel | null {
  const state = engine.state;
  const announcement = state.paydayAnnouncement;
  if (!announcement) return null;
  const dueIn = state.paydayDueAtHour !== null ? Math.max(0, state.paydayDueAtHour - state.hours) : 0;
  return {
    weekLabel: `Week ${state.week + 1}`,
    weekName: `${announcement.emoji} ${announcement.title}`,
    message: announcement.flavor,
    recoveryMessage: 'Village defenders have recovered and rewards have been replenished. Completed missions stay checked. Raids in progress and unclaimed reports are still reserved.',
    paydayTitle: 'Payday has arrived',
    paydayMessage: `Pay your minions' salaries within ${fmtHours(dueIn)} or face bankruptcy.`,
    illustrationSrc: illustration,
    canOpenPayroll: true,
    continueLabel: 'Continue',
  };
}

export interface NewWeekNav {
  /** Dismisses the announcement for this week (UI-only — the engine has no field to clear this,
   * so the host tracks "already seen" locally rather than mutating engine state from the UI). */
  dismiss(): void;
  openPayroll(): void;
}

export function handleNewWeekAction(engine: GameEngine, action: NewWeekAction, nav: NewWeekNav): void {
  switch (action.type) {
    case 'continueRequested':
      engine.setPaused(false);
      nav.dismiss();
      return;
    case 'openPayrollRequested':
      nav.dismiss();
      nav.openPayroll();
      return;
  }
}
