import { GameEngine } from '../engine/GameEngine';
import { clearSavedGame, loadGame, saveGame, serializeGame } from '../systems/save';
import { asset } from './screens/assets';
import { mountAppShell } from './shell/AppShell';
import type { AppShellHandle } from './shell/AppShell.types';
import { mountTimeWidget } from './shell/TimeWidget';
import type { TimeWidgetHandle } from './shell/TimeWidget.types';
import { mountRoomNav } from './shell/RoomNav';
import type { RoomNavHandle } from './shell/RoomNav.types';
import { mountPayrollButton } from './shell/PayrollButton';
import type { PayrollButtonHandle } from './shell/PayrollButton.types';
import { mountDebugPanel } from './shell/DebugPanel';
import type { DebugPanelHandle } from './shell/DebugPanel.types';
import { mountStorehouseView } from './screens/storehouse/StorehouseView';
import type { StorehouseViewHandle } from './screens/storehouse/StorehouseViewModel';
import { buildStorehouseViewModel, createStorehouseUiState, handleStorehouseAction } from './screens/storehouse/StorehouseAdapter';
import { mountWarRoomView } from './screens/war-room/WarRoomView';
import type { WarRoomViewHandle } from './screens/war-room/WarRoomViewModel';
import { buildWarRoomViewModel, createWarRoomUiState, handleWarRoomAction } from './screens/war-room/WarRoomAdapter';
import { mountQuartersView } from './screens/quarters/QuartersView';
import type { QuartersViewHandle } from './screens/quarters/QuartersViewModel';
import { buildQuartersViewModel, handleQuartersAction } from './screens/quarters/QuartersAdapter';
import { mountInfirmaryView } from './screens/infirmary/InfirmaryView';
import type { InfirmaryViewHandle } from './screens/infirmary/InfirmaryViewModel';
import { buildInfirmaryViewModel, handleInfirmaryAction } from './screens/infirmary/InfirmaryAdapter';
import { mountDungeonView } from './screens/dungeon/DungeonView';
import type { DungeonViewHandle } from './screens/dungeon/DungeonViewModel';
import { buildDungeonViewModel, handleDungeonAction } from './screens/dungeon/DungeonAdapter';
import { mountTrainingHallView } from './screens/training-hall/TrainingHallView';
import type { TrainingHallViewHandle } from './screens/training-hall/TrainingHallViewModel';
import { buildTrainingHallViewModel, createTrainingHallUiState, handleTrainingHallAction } from './screens/training-hall/TrainingHallAdapter';
import { mountLaboratoryView } from './screens/laboratory/LaboratoryView';
import type { LaboratoryViewHandle } from './screens/laboratory/LaboratoryViewModel';
import { buildLaboratoryViewModel, handleLaboratoryAction } from './screens/laboratory/LaboratoryAdapter';
import { mountPayrollView } from './screens/payroll/PayrollView';
import type { PayrollView } from './screens/payroll/PayrollView';
import { buildPayrollViewModel, handlePayrollAction } from './screens/payroll/PayrollAdapter';
import { mountRaidReportView } from './screens/raid-report/RaidReportView';
import type { RaidReportViewHandle } from './screens/raid-report/RaidReportViewModel';
import { buildRaidReportViewModel, handleRaidReportAction } from './screens/raid-report/RaidReportAdapter';
import { mountNewWeekView } from './screens/new-week/NewWeekView';
import type { NewWeekView } from './screens/new-week/NewWeekView';
import { buildNewWeekViewModel, handleNewWeekAction } from './screens/new-week/NewWeekAdapter';
import { mountGameOverView } from './screens/game-over/GameOverView';
import type { GameOverView } from './screens/game-over/GameOverView';
import { buildGameOverViewModel, handleGameOverAction } from './screens/game-over/GameOverAdapter';
import { mountVictoryView } from './screens/victory/VictoryView';
import type { VictoryView } from './screens/victory/VictoryView';
import { buildVictoryViewModel, handleVictoryAction, hasWonGame } from './screens/victory/VictoryAdapter';

type ScreenId = 'storehouse' | 'quarters' | 'infirmary' | 'trainingHall' | 'laboratory' | 'dungeon' | 'warRoom';

const ROOM_ENTRIES: ReadonlyArray<{ id: ScreenId; icon: string; label: string }> = [
  { id: 'storehouse', icon: asset('rooms/storehouse-icon.webp'), label: 'Storehouse' },
  { id: 'quarters', icon: asset('rooms/quarters-icon.webp'), label: 'Quarters' },
  { id: 'infirmary', icon: asset('rooms/infirmary-icon.webp'), label: 'Infirmary' },
  { id: 'trainingHall', icon: asset('rooms/training-hall-icon.webp'), label: 'Training Hall' },
  { id: 'laboratory', icon: asset('rooms/laboratory-icon.webp'), label: 'Laboratory' },
  { id: 'dungeon', icon: asset('rooms/dungeon-icon.webp'), label: 'Dungeon' },
  { id: 'warRoom', icon: asset('rooms/war-room-icon.webp'), label: 'War Room' },
];
/** Rooms not yet wired still show in the nav (greyed/no-op) so the full room list is visible
 * from day one; this grows to include every ScreenId as Phase 2 screens land. */
const ENABLED_SCREENS = new Set<ScreenId>(['storehouse', 'quarters', 'infirmary', 'trainingHall', 'laboratory', 'dungeon', 'warRoom']);

/** UI refresh (rebuilding screen ViewModels + pushing setModel) is throttled independently of the
 * rAF time-integration loop — see the bug note in App's class doc. */
const REFRESH_INTERVAL_SECONDS = 0.15;

interface ScreenHandle<Model> { setModel(model: Readonly<Model>): void; destroy(): void }

/**
 * App controller: owns the engine + UI-only state, mounts the shell once, swaps the active
 * screen view on navigation, and converts every view action into an engine call via its adapter.
 *
 * Refresh cadence: `engine.tick` runs every animation frame for smooth time integration, but
 * `refresh()` (which rebuilds ViewModels and calls `setModel`) is throttled to ~150ms. Calling it
 * every frame previously meant any view that doesn't diff in place (TimeWidget's pause icon,
 * PayrollView's full rebuild) could have its click target destroyed mid-click. Popups additionally
 * do NOT get `setModel` pushed from the refresh loop at all — the engine is paused while a popup is
 * open, so nothing changes underneath it; popups only re-render in response to their own actions.
 */
export class App {
  private readonly engine = new GameEngine(loadGame() ?? undefined);
  private readonly shell: AppShellHandle;
  private readonly timeWidget: TimeWidgetHandle;
  private readonly roomNav: RoomNavHandle;
  private readonly payrollButton: PayrollButtonHandle;
  private readonly debugPanel: DebugPanelHandle;

  private screen: ScreenId | null = null;
  private screenView: ScreenHandle<unknown> | null = null;
  private payrollView: PayrollView | null = null;
  private raidReportView: RaidReportViewHandle | null = null;
  private newWeekView: NewWeekView | null = null;
  private gameOverView: GameOverView | null = null;
  private victoryView: VictoryView | null = null;
  private newWeekDismissedForWeek: number | null = null;
  private victoryDismissed = false;
  private lastSavedAt = 0;
  private suppressSaving = false;

  private readonly storehouseUi = createStorehouseUiState();
  private readonly warRoomUi = createWarRoomUiState();
  private readonly trainingHallUi = createTrainingHallUiState();

  constructor(root: HTMLElement) {
    this.shell = mountAppShell(root, { coins: 0, crystals: 0, title: '', windowOpen: false }, action => {
      if (action.type === 'back') this.navigate(null);
    });

    const timeHost = document.createElement('div');
    timeHost.style.width = '100%';
    this.shell.slots.leftColumn.append(timeHost);
    this.timeWidget = mountTimeWidget(timeHost, this.timeWidgetModel(), action => {
      switch (action.type) {
        case 'togglePause': this.engine.setPaused(!this.engine.state.paused); break;
        case 'setSpeed': this.engine.setSpeed(action.speed); break;
        case 'cycleSpeed': this.engine.setSpeed(this.nextSpeed()); break;
        case 'toggleExpanded': this.timeExpanded = !this.timeExpanded; break;
      }
      this.refresh();
    });

    const roomNavHost = document.createElement('div');
    roomNavHost.style.width = '100%';
    this.shell.slots.leftColumn.append(roomNavHost);
    this.roomNav = mountRoomNav(roomNavHost, this.roomNavModel(), action => {
      if (ENABLED_SCREENS.has(action.id as ScreenId)) this.navigate(action.id as ScreenId);
    });

    const payrollHost = document.createElement('div');
    this.shell.slots.leftColumn.append(payrollHost);
    this.payrollButton = mountPayrollButton(payrollHost, { visible: false }, () => this.openPayroll());

    const debugHost = document.createElement('div');
    debugHost.style.width = '100%';
    this.shell.slots.leftColumn.append(debugHost);
    this.debugPanel = mountDebugPanel(debugHost, { processes: [], showMapCoordinates: this.warRoomUi.showMapCoordinates }, action => {
      if (action.type === 'newGame') { this.startNewGame(); return; }
      if (action.type === 'forceComplete') this.engine.forceCompleteProcess(action.processId);
      else if (action.type === 'copyState') navigator.clipboard.writeText(this.gameStateToJson());
      else if (action.type === 'setMapCoordinates') this.warRoomUi.showMapCoordinates = action.enabled;
      this.refresh();
    });

    this.refresh();

    window.addEventListener('pagehide', () => this.persist());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.persist();
    });

    let lastTime = performance.now();
    let sinceRefresh = 0;
    const loop = (now: number) => {
      const deltaSeconds = (now - lastTime) / 1000;
      lastTime = now;
      this.engine.tick(deltaSeconds);
      sinceRefresh += deltaSeconds;
      if (sinceRefresh >= REFRESH_INTERVAL_SECONDS) {
        sinceRefresh = 0;
        this.refresh(false);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private timeExpanded = true;
  private speedIndex = 1;
  private readonly speeds = [0.5, 1, 2, 5, 10];
  private nextSpeed(): number {
    this.speedIndex = (this.speedIndex + 1) % this.speeds.length;
    return this.speeds[this.speedIndex];
  }

  private navigate(screen: ScreenId | null): void {
    this.screen = screen;
    this.screenView?.destroy();
    this.screenView = null;
    const host = this.shell.slots.content;
    host.replaceChildren();

    if (screen === 'storehouse') {
      const view: StorehouseViewHandle = mountStorehouseView(host, buildStorehouseViewModel(this.engine, this.storehouseUi), action => {
        handleStorehouseAction(this.engine, this.storehouseUi, action);
        this.refresh();
      });
      this.screenView = view as ScreenHandle<unknown>;
    } else if (screen === 'quarters') {
      const view: QuartersViewHandle = mountQuartersView(host, buildQuartersViewModel(this.engine), action => {
        handleQuartersAction(this.engine, action);
        this.refresh();
      });
      this.screenView = view as ScreenHandle<unknown>;
    } else if (screen === 'infirmary') {
      const view: InfirmaryViewHandle = mountInfirmaryView(host, buildInfirmaryViewModel(this.engine), action => {
        handleInfirmaryAction(this.engine, action);
        this.refresh();
      });
      this.screenView = view as ScreenHandle<unknown>;
    } else if (screen === 'laboratory') {
      const view: LaboratoryViewHandle = mountLaboratoryView(host, buildLaboratoryViewModel(this.engine), action => {
        handleLaboratoryAction(this.engine, action);
        this.refresh();
      });
      this.screenView = view as ScreenHandle<unknown>;
    } else if (screen === 'dungeon') {
      const view: DungeonViewHandle = mountDungeonView(host, buildDungeonViewModel(this.engine), action => {
        handleDungeonAction(this.engine, action);
        this.refresh();
      });
      this.screenView = view as ScreenHandle<unknown>;
    } else if (screen === 'trainingHall') {
      const view: TrainingHallViewHandle = mountTrainingHallView(host, buildTrainingHallViewModel(this.engine, this.trainingHallUi), action => {
        handleTrainingHallAction(this.engine, this.trainingHallUi, action);
        this.refresh();
      });
      this.screenView = view as ScreenHandle<unknown>;
    } else if (screen === 'warRoom') {
      const view: WarRoomViewHandle = mountWarRoomView(host, buildWarRoomViewModel(this.engine, this.warRoomUi), action => {
        handleWarRoomAction(this.engine, this.warRoomUi, action, { openRaidReport: missionId => this.openRaidReport(missionId) });
        this.refresh();
      });
      this.screenView = view as ScreenHandle<unknown>;
    }
    this.refresh();
  }

  /** All overlay popups share the shell's single overlay slot — only one is ever shown at a time. */
  private showOverlay(host: HTMLElement): void {
    this.shell.slots.overlay.replaceChildren(host);
    this.shell.slots.overlay.hidden = false;
  }
  private hideOverlay(): void {
    this.shell.slots.overlay.hidden = true;
    this.shell.slots.overlay.replaceChildren();
  }
  private hasOpenOverlay(): boolean {
    return !!(this.payrollView || this.raidReportView || this.newWeekView || this.gameOverView || this.victoryView);
  }

  private openPayroll(): void {
    if (this.payrollView) return;
    this.engine.setPaused(true);
    const host = document.createElement('div');
    this.showOverlay(host);
    this.payrollView = mountPayrollView(host, buildPayrollViewModel(this.engine), action => {
      handlePayrollAction(this.engine, action, { close: () => this.closePayroll() });
      this.payrollView?.setModel(buildPayrollViewModel(this.engine));
      this.refresh();
    });
  }

  private closePayroll(): void {
    if (!this.payrollView) return;
    this.payrollView.destroy();
    this.payrollView = null;
    this.hideOverlay();
    this.engine.setPaused(false);
  }

  private openRaidReport(missionId: string): void {
    if (this.raidReportView) return;
    const model = buildRaidReportViewModel(this.engine, missionId);
    if (!model) return;
    this.engine.setPaused(true);
    const host = document.createElement('div');
    this.showOverlay(host);
    this.raidReportView = mountRaidReportView(host, model, action => {
      handleRaidReportAction(this.engine, missionId, action, { close: () => this.closeRaidReport() });
      const next = buildRaidReportViewModel(this.engine, missionId);
      if (next) this.raidReportView?.setModel(next);
      this.refresh();
    });
  }

  private closeRaidReport(): void {
    if (!this.raidReportView) return;
    this.raidReportView.destroy();
    this.raidReportView = null;
    this.hideOverlay();
    this.engine.setPaused(false);
  }

  private openNewWeek(): void {
    if (this.newWeekView) return;
    const model = buildNewWeekViewModel(this.engine);
    if (!model) return;
    const host = document.createElement('div');
    this.showOverlay(host);
    this.newWeekView = mountNewWeekView(host, model, action => {
      handleNewWeekAction(this.engine, action, {
        dismiss: () => { this.newWeekDismissedForWeek = this.engine.state.week; this.closeNewWeek(); },
        openPayroll: () => { this.newWeekDismissedForWeek = this.engine.state.week; this.closeNewWeek(); this.openPayroll(); },
      });
      this.refresh();
    });
  }

  private closeNewWeek(): void {
    if (!this.newWeekView) return;
    this.newWeekView.destroy();
    this.newWeekView = null;
    this.hideOverlay();
  }

  private openGameOver(): void {
    if (this.gameOverView) return;
    const model = buildGameOverViewModel(this.engine);
    if (!model) return;
    const host = document.createElement('div');
    this.showOverlay(host);
    this.gameOverView = mountGameOverView(host, model, action => {
      if (action.type === 'retryRequested') {
        this.startNewGame();
        return;
      }
      handleGameOverAction(action);
    });
  }

  private openVictory(): void {
    if (this.victoryView) return;
    this.engine.setPaused(true);
    const host = document.createElement('div');
    this.showOverlay(host);
    this.victoryView = mountVictoryView(host, buildVictoryViewModel(this.engine), action => {
      handleVictoryAction(action, { dismiss: () => this.closeVictory() });
      this.refresh();
    });
  }

  private closeVictory(): void {
    if (!this.victoryView) return;
    this.victoryView.destroy();
    this.victoryView = null;
    this.victoryDismissed = true;
    this.hideOverlay();
    this.engine.setPaused(false);
  }

  /** Auto-opens the relevant end-of-turn popup (never stacks on top of another open overlay). */
  private checkEndgamePopups(): void {
    if (this.hasOpenOverlay()) return;
    const state = this.engine.state;
    if (state.gameOver === 'bankruptcy') { this.openGameOver(); return; }
    if (!this.victoryDismissed && hasWonGame(this.engine)) { this.openVictory(); return; }
    if (state.paydayAnnouncement && this.newWeekDismissedForWeek !== state.week) { this.openNewWeek(); return; }
  }

  private roomNavModel() {
    return { rooms: ROOM_ENTRIES.map(r => ({ ...r, active: r.id === this.screen })) };
  }

  private timeWidgetModel() {
    const state = this.engine.state;
    const dayOfWeek = (state.day % 7) + 1;
    return {
      day: dayOfWeek,
      week: state.week + 1,
      hour: Math.floor(state.hours % 24),
      minute: Math.floor((state.hours % 1) * 60),
      paused: state.paused,
      speed: state.speed,
      expanded: this.timeExpanded,
    };
  }

  private gameStateToJson(): string {
    return serializeGame(this.engine.state);
  }

  private startNewGame(): void {
    // Block periodic and pagehide saves from writing the old session back during reload.
    this.suppressSaving = true;
    clearSavedGame();
    window.location.reload();
  }

  private persist(): void {
    if (this.suppressSaving) return;
    saveGame(this.engine.state);
    this.lastSavedAt = performance.now();
  }

  private refresh(saveImmediately = true): void {
    const state = this.engine.state;
    this.shell.setModel({ coins: state.gold, crystals: state.crystals, title: this.screenTitle(), windowOpen: this.screen !== null });
    this.timeWidget.setModel(this.timeWidgetModel());
    this.roomNav.setModel(this.roomNavModel());
    this.payrollButton.setModel({ visible: state.paydayPending && !this.payrollView });
    this.debugPanel.setModel({
      showMapCoordinates: this.warRoomUi.showMapCoordinates,
      processes: state.processes.map(p => ({
        id: p.id,
        label: `${p.type} — ${Math.max(0, p.endHour - state.hours).toFixed(1)}h left`,
        progress: Math.min(1, Math.max(0, (state.hours - p.startHour) / (p.endHour - p.startHour))),
      })),
    });

    if (this.screen === 'storehouse') (this.screenView as StorehouseViewHandle | null)?.setModel(buildStorehouseViewModel(this.engine, this.storehouseUi));
    else if (this.screen === 'quarters') (this.screenView as QuartersViewHandle | null)?.setModel(buildQuartersViewModel(this.engine));
    else if (this.screen === 'infirmary') (this.screenView as InfirmaryViewHandle | null)?.setModel(buildInfirmaryViewModel(this.engine));
    else if (this.screen === 'laboratory') (this.screenView as LaboratoryViewHandle | null)?.setModel(buildLaboratoryViewModel(this.engine));
    else if (this.screen === 'dungeon') (this.screenView as DungeonViewHandle | null)?.setModel(buildDungeonViewModel(this.engine));
    else if (this.screen === 'trainingHall') (this.screenView as TrainingHallViewHandle | null)?.setModel(buildTrainingHallViewModel(this.engine, this.trainingHallUi));
    else if (this.screen === 'warRoom') (this.screenView as WarRoomViewHandle | null)?.setModel(buildWarRoomViewModel(this.engine, this.warRoomUi));

    this.checkEndgamePopups();
    if (saveImmediately || performance.now() - this.lastSavedAt >= 1000) this.persist();
  }

  private screenTitle(): string {
    const room = ROOM_ENTRIES.find(r => r.id === this.screen);
    return room ? room.label.toUpperCase() : '';
  }
}
