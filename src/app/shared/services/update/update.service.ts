import { Injectable } from '@angular/core';
import { signal, computed } from '@angular/core';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

export interface UpdateInfo {
  status: UpdateStatus;
  version?: string;
  percent?: number;
  message?: string;
}

declare global {
  interface Window {
    // Solo lo que `electron/preload.js` expone de verdad. Declarar de más aquí
    // no da acceso a nada: da un tipo que compila y un `undefined` en ejecución.
    // `cspNonce` y `encryptionKey` estaban declaradas y nunca se expusieron.
    electronAPI?: {
      platform: string;
      log?: (level: 'log' | 'warn' | 'error', message: string, data?: unknown) => void;
      onUpdateStatus: (cb: (data: UpdateInfo) => void) => void;
      checkForUpdates: () => Promise<{ available: boolean; error?: string }>;
      downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
      installUpdate: () => void;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly _status = signal<UpdateStatus>('idle');
  private readonly _version = signal<string | null>(null);
  private readonly _percent = signal(0);
  private readonly _error = signal<string | null>(null);

  readonly status = this._status.asReadonly();
  readonly version = this._version.asReadonly();
  readonly percent = this._percent.asReadonly();
  readonly error = this._error.asReadonly();

  readonly canInstall = computed(() => this._status() === 'downloaded');
  readonly canDownload = computed(() => this._status() === 'available');
  readonly isBusy = computed(() => this._status() === 'checking' || this._status() === 'downloading');

  private get api(): Window['electronAPI'] | null {
    return window.electronAPI ?? null;
  }

  init(): void {
    if (!this.api?.onUpdateStatus) return;
    this.api.onUpdateStatus((data: UpdateInfo) => {
      this._status.set(data.status);
      if (data.version) this._version.set(data.version);
      if (data.percent != null) this._percent.set(data.percent);
      if (data.message) this._error.set(data.message);
    });
  }

  async check(): Promise<void> {
    if (!this.api?.checkForUpdates) return;
    this._status.set('checking');
    this._error.set(null);
    const result = await this.api.checkForUpdates();
    if (result.error) {
      this._status.set('error');
      this._error.set(result.error);
    }
  }

  async download(): Promise<void> {
    if (!this.api?.downloadUpdate) return;
    this._status.set('downloading');
    const result = await this.api.downloadUpdate();
    if (!result.success) {
      this._status.set('error');
      this._error.set(result.error ?? 'Download failed');
    }
  }

  install(): void {
    if (!this.api?.installUpdate) return;
    this.api.installUpdate();
  }
}
