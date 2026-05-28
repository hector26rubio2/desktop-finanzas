import { Injectable } from '@angular/core';

type Level = 'log' | 'warn' | 'error';

interface ElectronLogAPI {
  log?: (level: Level, message: string, data?: unknown) => void;
}

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private get api(): ElectronLogAPI | null {
    return (window as unknown as { electronAPI?: ElectronLogAPI }).electronAPI ?? null;
  }

  private write(level: Level, message: string, data?: unknown): void {
    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleFn(`[${level}] ${message}`, data ?? '');
    try {
      this.api?.log?.(level, message, data);
    } catch (_) {}
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
