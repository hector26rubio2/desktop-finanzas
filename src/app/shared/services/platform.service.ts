import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PlatformService {
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
}
