import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { UpdateService } from '../../../services/update/update.service';

@Component({
  selector: 'app-update-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
        min-height: 38px;
        padding: 6px var(--page-gutter);
        border-bottom: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line));
        background: color-mix(in srgb, var(--accent) 12%, var(--bg-1));
        color: var(--accent);
        font-size: var(--fs-xs);
        animation: slide-down var(--duration-normal) var(--ease-out);
      }
      .update-banner.downloading {
        background: var(--bg-2);
        color: var(--fg-0);
      }
      .update-banner.ready {
        border-bottom-color: color-mix(in srgb, var(--positive) 32%, var(--line));
        background: var(--positive-soft);
        color: var(--positive);
      }
      .update-banner.error {
        border-bottom-color: color-mix(in srgb, var(--negative) 32%, var(--line));
        background: var(--negative-soft);
        color: var(--negative);
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
        min-height: 28px;
        padding: 3px 12px;
        border: 1px solid currentColor;
        border-radius: var(--radius-button);
        background: color-mix(in srgb, currentColor 8%, transparent);
        color: inherit;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: background 0.15s;
      }
      button:hover {
        background: color-mix(in srgb, currentColor 14%, transparent);
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
      @media (prefers-reduced-motion: reduce) {
        .update-banner {
          animation: none;
        }
      }
    `,
  ],
})
export class UpdateBannerComponent {
  readonly update = inject(UpdateService);
}
