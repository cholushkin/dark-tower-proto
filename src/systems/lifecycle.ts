import { CONFIG } from "../data/config";
import weeksData from "../data/weeks.json";
import type { GameState } from "../model/GameState";
import { markWaitingIfIdle } from "./recovery";

export function nightfall(state: GameState, now: number): void {
    for (const minion of state.minions) {
        if (!minion.tired && minion.activity.type === "treatment") {
            const process = state.processes.find(p => p.id === minion.activity.processId);
            if (process?.type === "treatment") process.restStartHour = now;
        }
        minion.tired = true;
        markWaitingIfIdle(state, minion, now);
    }
    state.log("Nightfall. All minions grow tired.");
}

export function checkDepartures(state: GameState, now: number): void {
    const departing = state.minions.filter(m =>
        m.waitingSince !== null && now - m.waitingSince > CONFIG.constants.bedEvictionHours);
    if (departing.length === 0) return;

    state.minions = state.minions.filter(m => !departing.includes(m));
    for (const minion of departing) {
        const notice = `A Rank ${minion.rank} minion left the tower after too long without a bed.`;
        state.departureNotices.push(notice);
        state.log(notice);
    }
}

export function triggerPaydayDue(state: GameState, now: number): void {
    state.paydayPending = true;
    state.paydayDueAtHour = now + CONFIG.constants.paydayWindowHours;
    const week = weeksData[Math.floor(state.rng() * weeksData.length)];
    state.paydayAnnouncement = week;
    state.paused = true;
    state.log(`Payday has arrived. The Dark Lord awaits payment. ${week.emoji} ${week.title} — ${week.flavor}`);
}

export function checkBankruptcy(state: GameState, now: number): void {
    if (state.gameOver) return;
    if (state.paydayPending && state.paydayDueAtHour !== null && now >= state.paydayDueAtHour) {
        state.gameOver = "bankruptcy";
        state.log("GAME OVER — Bankruptcy. The weekly payroll went unpaid.");
    }
}
