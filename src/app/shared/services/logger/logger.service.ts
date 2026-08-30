import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';

type Level = 'debug' | 'log' | 'warn' | 'error';

const LEVEL_RANK: Record<Level, number> = { debug: 0, log: 1, warn: 2, error: 3 };

interface ElectronLogAPI {
  log?: (level: Level, message: string, data?: unknown) => void;
}

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly threshold: Level = environment.production ? 'warn' : 'debug';

  private get api(): ElectronLogAPI | null {
    return (window as unknown as { electronAPI?: ElectronLogAPI }).electronAPI ?? null;
  }

  private write(level: Level, message: string, data?: unknown): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.threshold]) return;
    const consoleFn =
      level === 'error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : level === 'debug'
            ? console.debug
            : console.log;
    consoleFn(`[${level}] ${message}`, data ?? '');
    try {
      this.api?.log?.(level, message, data);
    } catch {}
  }

  debug(message: string, data?: unknown): void {
    this.write('debug', message, data);
  }

  log(message: string, data?: unknown): void {
    this.write('log', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.write('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.write('error', message, data);
  }
}
