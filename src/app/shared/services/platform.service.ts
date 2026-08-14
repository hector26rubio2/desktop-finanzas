import { Injectable, signal } from '@angular/core';

export const LOCAL_CAPABILITIES: Readonly<Record<string, boolean>> = {
  'core-finance': true,
  'offline-read': true,
  'offline-write': true,
  portfolio: true,
  'recurring-transactions': true,
  imports: true,
  exports: true,
};

@Injectable({ providedIn: 'root' })
export class PlatformService {
  readonly capabilities = signal<Record<string, boolean>>({ ...LOCAL_CAPABILITIES });
  readonly platform: string = window.electronAPI?.platform ?? navigator.platform ?? 'win32';

  readonly isMac = this.platform === 'darwin';
  readonly isWin = this.platform === 'win32';
  readonly isLinux = this.platform === 'linux';

  /** Modifier symbol for keyboard shortcuts */
  readonly mod = this.isMac ? '⌘' : 'Ctrl';

  /** Format a shortcut for display: e.g. kbd('K') → '⌘K' or 'Ctrl+K' */
  kbd(key: string): string {
    return this.isMac ? `⌘${key}` : `Ctrl+${key}`;
  }
  enabled(key: string) {
    return this.capabilities()[key] === true;
  }
  async refreshCapabilities() {
    /* Local desktop capabilities are built in. */
  }
}
