/** Display-only shell snapshot. No gameplay or navigation state lives here. */
export interface AppShellViewModel {
  readonly coins: number;
  readonly upkeepHint: string;
  readonly crystals: number;
  readonly title: string;
  /** Whether a room/screen window is open; the back button + caption only show while true. */
  readonly windowOpen: boolean;
}

export type AppShellAction = Readonly<{ type: 'back' }>;
export type AppShellActionHandler = (action: AppShellAction) => void;

/** Mount points the controller fills with its own widgets (TimeWidget, PayrollButton, DebugPanel, screen view). */
export interface AppShellSlots {
  readonly leftColumn: HTMLElement;
  readonly content: HTMLElement;
  /** Full-stage overlay for popups; scales and letterboxes together with the rest of the shell. */
  readonly overlay: HTMLElement;
}

export interface AppShellHandle {
  readonly slots: AppShellSlots;
  setModel(model: Readonly<AppShellViewModel>): void;
  destroy(): void;
}
