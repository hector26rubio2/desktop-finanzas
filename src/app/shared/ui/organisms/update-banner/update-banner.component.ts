import { Component, inject } from '@angular/core';
import { UpdateService } from '../../../services/update/update.service';

@Component({
  selector: 'app-update-banner',
  standalone: true,
  template: `
    @if (update.status() === 'available') {
      <div class="update-banner" role="alert">
        <span class="update-text">Nueva versión disponible</span>
        <button class="btn-download" (click)="update.download()" [disabled]="update.isBusy()">Descargar</button>
      </div>
    }

    @if (update.status() === 'downloading') {
      <div class="update-banner downloading" role="status" aria-live="polite">
        <div class="progress-bar">
          <div class="progress-fill" [style.width.%]="update.percent()"></div>
        </div>
        <span class="update-text">Descargando {{ update.percent() }}%</span>
      </div>
    }

    @if (update.canInstall()) {
      <div class="update-banner ready" role="alert">
        <span class="update-text">v{{ update.version() }} lista para instalar</span>
        <button class="btn-install" (click)="update.install()">Reiniciar e instalar</button>
      </div>
    }

    @if (update.status() === 'error') {
      <div class="update-banner error" role="alert">
        <span class="update-text">Error al actualizar: {{ update.error() }}</span>
        <button class="btn-retry" (click)="update.check()">Reintentar</button>
      </div>
    }
  `,
  styles: [
    `
      .update-banner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 8px 16px;
        background: var(--accent);
        color: var(--fg-0);
        font-size: 13px;
        animation: slide-down 0.3s ease-out;
      }
      .update-banner.downloading {
        background: var(--bg-2);
      }
      .update-banner.ready {
        background: var(--positive);
      }
      .update-banner.error {
        background: var(--negative);
      }
      .progress-bar {
        width: 120px;
        height: 4px;
        background: var(--line);
        border-radius: 2px;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        background: var(--accent);
        border-radius: 2px;
        transition: width 0.3s ease;
      }
      .update-text {
        font-weight: 500;
      }
      button {
        padding: 4px 14px;
        border: 1px solid var(--fg-0);
        border-radius: 4px;
        background: transparent;
        color: var(--fg-0);
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: background 0.15s;
      }
      button:hover {
        background: rgba(255, 255, 255, 0.15);
      }
      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      @keyframes slide-down {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `,
  ],
})
export class UpdateBannerComponent {
  readonly update = inject(UpdateService);
}
