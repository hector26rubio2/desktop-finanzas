import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { ThemeService, Theme } from '../../shared/services/theme.service';
import { PlatformService } from '../../shared/services/platform.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import type { Locale, TranslationKey } from '../../shared/i18n/locale.types';

type Section = 'perfil' | 'apariencia' | 'monedas' | 'atajos' | 'acerca';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div style="display:grid;grid-template-columns:180px 1fr;gap:0;height:100%">
      <!-- Sections sidebar -->
      <nav style="border-right:1px solid var(--line);padding:8px 0">
        @for (s of sections; track s.id) {
          <button
            class="nav-item"
            [class.nav-item--active]="activeSection() === s.id"
            (click)="activeSection.set(s.id)"
          >
            {{ i18n.t(s.labelKey) }}
          </button>
        }
        <div style="height:1px;background:var(--line);margin:8px 0"></div>
        <button class="nav-item" style="color:var(--negative)" (click)="logout()">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          >
            <path d="M6 8h8M11 5l3 3-3 3M10 3H3v10h7" />
          </svg>
          {{ i18n.t('common.sign_out') }}
        </button>
      </nav>

      <!-- Section content -->
      <div style="padding:var(--pad-x);overflow-y:auto">
        @if (activeSection() === 'perfil') {
          <div style="max-width:480px">
            <h3 class="serif" style="font-size:22px;font-weight:400;margin-bottom:20px">
              {{ i18n.t('config.perfil') }}
            </h3>
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
              <div
                style="width:64px;height:64px;border-radius:50%;background:var(--accent-soft);border:2px solid var(--accent);display:grid;place-items:center;font-family:'Geist Mono',monospace;font-size:22px;color:var(--accent)"
              >
                {{ userInitials() }}
              </div>
              <div>
                <div style="font-size:18px;font-weight:500;color:var(--fg-0)">{{ userName() }}</div>
                <div class="mono subtle" style="font-size:12px">{{ userEmail() }}</div>
                <span class="tag tag--accent" style="margin-top:6px">{{ userRole() }}</span>
              </div>
            </div>
            <div style="height:1px;background:var(--line);margin-bottom:20px"></div>
            <div style="display:flex;flex-direction:column;gap:14px">
              <label>
                {{ i18n.t('auth.name') }}
                <input [value]="userName()" readonly style="opacity:.6" />
              </label>
              <label>
                {{ i18n.t('auth.email') }}
                <input [value]="userEmail()" readonly style="opacity:.6" />
              </label>
              <label>
                {{ i18n.t('auth.base_currency') }}
                <input [value]="baseCurrency()" readonly style="opacity:.6" />
              </label>
            </div>
            <div style="margin-top:20px">
              <button class="btn btn--danger" (click)="logout()">{{ i18n.t('common.sign_out') }}</button>
            </div>
          </div>
        }

        @if (activeSection() === 'apariencia') {
          <div style="max-width:560px">
            <h3 class="serif" style="font-size:22px;font-weight:400;margin-bottom:20px">
              {{ i18n.t('config.apariencia') }}
            </h3>

            <!-- Language -->
            <div style="margin-bottom:24px">
              <div class="eyebrow" style="margin-bottom:10px">{{ i18n.t('config.idioma') }}</div>
              <div class="seg-ctrl" style="width:fit-content">
                @for (loc of locales; track loc.id) {
                  <button
                    class="seg-ctrl__btn"
                    [class.seg-ctrl__btn--active]="i18n.currentLocale() === loc.id"
                    (click)="i18n.setLocale(loc.id)"
                  >
                    {{ i18n.t(loc.key) }}
                  </button>
                }
              </div>
            </div>

            <!-- Preset themes -->
            <div style="margin-bottom:24px">
              <div class="eyebrow" style="margin-bottom:10px">{{ i18n.t('config.tema') }}</div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
                @for (t of themeOptions; track t.id) {
                  <button
                    (click)="theme.setTheme(t.id)"
                    style="padding:12px;border-radius:var(--radius-card);border:2px solid;text-align:left;cursor:pointer;background:var(--bg-1);transition:border-color .15s"
                    [style.border-color]="theme.theme() === t.id ? 'var(--accent)' : 'var(--line)'"
                  >
                    <div style="display:flex;gap:5px;margin-bottom:8px">
                      <div style="width:22px;height:22px;border-radius:5px" [style.background]="t.bg"></div>
                      <div style="width:22px;height:22px;border-radius:5px" [style.background]="t.accent"></div>
                    </div>
                    <div style="font-size:12px;font-weight:500;color:var(--fg-0)">{{ t.name }}</div>
                  </button>
                }
              </div>
            </div>

            <!-- Custom saved themes -->
            @if (theme.customThemes().length > 0) {
              <div style="margin-bottom:24px">
                <div class="eyebrow" style="margin-bottom:10px">{{ i18n.t('config.temas_guardados') }}</div>
                <div style="display:flex;flex-direction:column;gap:8px">
                  @for (ct of theme.customThemes(); track ct.name) {
                    <div
                      style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius-card);border:2px solid;background:var(--bg-1);cursor:pointer;transition:border-color .15s"
                      [style.border-color]="
                        theme.theme() === 'custom' && activeCustomName() === ct.name ? 'var(--accent)' : 'var(--line)'
                      "
                      (click)="theme.activateCustomTheme(ct.name)"
                    >
                      <div
                        style="width:22px;height:22px;border-radius:5px;flex-shrink:0"
                        [style.background]="ct.bg"
                      ></div>
                      <div
                        style="width:22px;height:22px;border-radius:5px;flex-shrink:0"
                        [style.background]="ct.accent"
                      ></div>
                      <span style="flex:1;font-size:13px;color:var(--fg-0)">{{ ct.name }}</span>
                      <span class="tag" style="font-size:10px">{{
                        ct.isDark ? i18n.t('config.tag_oscuro') : i18n.t('config.tag_claro')
                      }}</span>
                      <button
                        class="btn btn--ghost btn--icon"
                        style="color:var(--negative)"
                        (click)="$event.stopPropagation(); theme.deleteCustomTheme(ct.name)"
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                        >
                          <path d="M1 1l14 14M15 1L1 15" />
                        </svg>
                      </button>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Custom theme creator -->
            <div
              style="margin-bottom:24px;padding:16px;background:var(--bg-2);border-radius:var(--radius-card);border:1px solid var(--line)"
            >
              <div class="eyebrow" style="margin-bottom:12px">{{ i18n.t('config.crear_tema') }}</div>
              <div style="display:flex;flex-direction:column;gap:10px">
                <label style="margin:0">
                  <span style="font-size:12px;color:var(--fg-2)">{{ i18n.t('config.nombre_tema') }}</span>
                  <input
                    [(ngModel)]="newThemeName"
                    placeholder="{{ i18n.t('config.nombre_tema_placeholder') }}"
                    style="margin-top:4px"
                  />
                </label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                  <label style="margin:0">
                    <span style="font-size:12px;color:var(--fg-2)">{{ i18n.t('config.accento') }}</span>
                    <div style="display:flex;gap:8px;margin-top:4px;align-items:center">
                      <input
                        type="color"
                        [(ngModel)]="newThemeAccent"
                        style="width:38px;height:32px;padding:2px;flex-shrink:0"
                      />
                      <span class="mono" style="font-size:11px;color:var(--fg-2)">{{ newThemeAccent }}</span>
                    </div>
                  </label>
                  <label style="margin:0">
                    <span style="font-size:12px;color:var(--fg-2)">{{ i18n.t('config.fondo_base') }}</span>
                    <div style="display:flex;gap:8px;margin-top:4px;align-items:center">
                      <input
                        type="color"
                        [(ngModel)]="newThemeBg"
                        style="width:38px;height:32px;padding:2px;flex-shrink:0"
                      />
                      <span class="mono" style="font-size:11px;color:var(--fg-2)">{{ newThemeBg }}</span>
                    </div>
                  </label>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <div class="seg-ctrl" style="width:auto">
                    <button
                      class="seg-ctrl__btn"
                      [class.seg-ctrl__btn--active]="!newThemeIsDark"
                      (click)="newThemeIsDark = false"
                    >
                      {{ i18n.t('config.tema_claro_btn') }}
                    </button>
                    <button
                      class="seg-ctrl__btn"
                      [class.seg-ctrl__btn--active]="newThemeIsDark"
                      (click)="newThemeIsDark = true"
                    >
                      {{ i18n.t('config.tema_oscuro_btn') }}
                    </button>
                  </div>
                  <button
                    class="btn btn--primary"
                    style="font-size:11px"
                    [disabled]="!newThemeName.trim()"
                    (click)="saveCustomTheme()"
                  >
                    {{ i18n.t('config.guardar_aplicar') }}
                  </button>
                </div>
              </div>
            </div>

            <div style="margin-bottom:24px">
              <div class="eyebrow" style="margin-bottom:10px">{{ i18n.t('config.densidad') }}</div>
              <div class="seg-ctrl">
                <button
                  class="seg-ctrl__btn"
                  [class.seg-ctrl__btn--active]="theme.density() === 'dense'"
                  (click)="theme.setDensity('dense')"
                >
                  {{ i18n.t('config.densidad_compacto') }}
                </button>
                <button
                  class="seg-ctrl__btn"
                  [class.seg-ctrl__btn--active]="theme.density() === 'comfy'"
                  (click)="theme.setDensity('comfy')"
                >
                  {{ i18n.t('config.densidad_normal') }}
                </button>
                <button
                  class="seg-ctrl__btn"
                  [class.seg-ctrl__btn--active]="theme.density() === 'airy'"
                  (click)="theme.setDensity('airy')"
                >
                  {{ i18n.t('config.densidad_espacioso') }}
                </button>
              </div>
            </div>

            <div style="margin-bottom:24px">
              <div class="eyebrow" style="margin-bottom:10px">{{ i18n.t('config.esquinas') }}</div>
              <div class="seg-ctrl">
                <button
                  class="seg-ctrl__btn"
                  [class.seg-ctrl__btn--active]="theme.shape() === 'rounded'"
                  (click)="theme.setShape('rounded')"
                >
                  {{ i18n.t('config.esquinas_redondeadas') }}
                </button>
                <button
                  class="seg-ctrl__btn"
                  [class.seg-ctrl__btn--active]="theme.shape() === 'sharp'"
                  (click)="theme.setShape('sharp')"
                >
                  {{ i18n.t('config.esquinas_anguladas') }}
                </button>
              </div>
            </div>

            <div
              style="padding:16px;background:var(--bg-2);border-radius:var(--radius-card);border:1px solid var(--line)"
            >
              <div class="eyebrow" style="margin-bottom:8px">{{ i18n.t('config.preview') }}</div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <div class="card" style="padding:10px 14px;display:flex;gap:10px;align-items:center">
                  <span style="width:8px;height:8px;border-radius:50%;background:var(--accent)"></span>
                  <span style="font-size:13px">{{ i18n.t('config.preview_banco') }}</span>
                  <span class="mono" style="font-size:13px;color:var(--positive)">+ $ 1.850.000</span>
                </div>
                <span class="tag tag--pos">{{ i18n.t('config.preview_ingreso') }}</span>
                <span class="tag tag--neg">{{ i18n.t('config.preview_gasto') }}</span>
                <span class="tag tag--accent">{{ i18n.t('config.preview_cuota') }}</span>
                <button class="btn btn--primary" style="font-size:11px">{{ i18n.t('config.preview_nuevo') }}</button>
                <button class="btn btn--ghost" style="font-size:11px">{{ i18n.t('config.preview_filtros') }}</button>
              </div>
            </div>
          </div>
        }

        @if (activeSection() === 'monedas') {
          <div style="max-width:480px">
            <h3 class="serif" style="font-size:22px;font-weight:400;margin-bottom:20px">
              {{ i18n.t('config.monedas') }}
            </h3>
            <div style="display:flex;flex-direction:column;gap:10px">
              @for (curr of currencies; track curr.code) {
                <div class="card" style="padding:14px;display:flex;align-items:center;gap:12px">
                  <span class="mono" style="font-size:14px;font-weight:500;width:40px">{{ curr.code }}</span>
                  <div style="flex:1">
                    <div>{{ curr.name }}</div>
                    <div class="mono subtle" style="font-size:11px">{{ curr.symbol }}</div>
                  </div>
                  @if (curr.code === baseCurrency()) {
                    <span class="tag tag--accent">{{ i18n.t('config.tag_principal') }}</span>
                  }
                </div>
              }
            </div>
          </div>
        }

        @if (activeSection() === 'atajos') {
          <div style="max-width:520px">
            <h3 class="serif" style="font-size:22px;font-weight:400;margin-bottom:20px">
              {{ i18n.t('config.atajos') }}
            </h3>
            <div class="card" style="padding:0;overflow:hidden">
              <table class="table">
                <thead>
                  <tr>
                    <th>{{ i18n.t('config.accion') }}</th>
                    <th>{{ i18n.t('config.atajo') }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of shortcuts; track s.action) {
                    <tr>
                      <td>{{ s.action }}</td>
                      <td>
                        <span class="kbd" style="font-size:11px">{{ s.keys }}</span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        @if (activeSection() === 'acerca') {
          <div style="max-width:400px">
            <div style="text-align:center;padding:40px 0">
              <div
                style="font-family:'Instrument Serif',serif;font-style:italic;font-size:48px;color:var(--accent);margin-bottom:8px"
              >
                finanzas
              </div>
              <div class="mono subtle" style="font-size:12px;margin-bottom:24px">
                {{ i18n.t('config.app_version') }}
              </div>
              <p style="font-size:13px;color:var(--fg-2);line-height:1.7;margin-bottom:16px">
                {{ i18n.t('config.app_descripcion') }}
              </p>
              <div style="display:flex;flex-direction:column;gap:8px;font-size:12px;color:var(--fg-3)">
                <div>{{ i18n.t('config.tech_angular') }}</div>
                <div>{{ i18n.t('config.tech_dotnet') }}</div>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
    `,
  ],
})
export class ConfiguracionComponent {
  locales = [
    { id: 'es-AR' as Locale, key: 'config.es' as const },
    { id: 'en-US' as Locale, key: 'config.en' as const },
    { id: 'pt-BR' as Locale, key: 'config.pt' as const },
  ];

  activeSection = signal<Section>('apariencia');

  sections: { id: Section; labelKey: TranslationKey }[] = [
    { id: 'perfil', labelKey: 'config.perfil' },
    { id: 'apariencia', labelKey: 'config.apariencia' },
    { id: 'monedas', labelKey: 'config.monedas' },
    { id: 'atajos', labelKey: 'config.atajos' },
    { id: 'acerca', labelKey: 'config.acerca' },
  ];

  themeOptions: { id: Theme; name: string; bg: string; accent: string }[] = [
    { id: 'obsidian', name: 'Obsidiana', bg: 'oklch(13% 0.006 70)', accent: 'oklch(80% 0.12 78)' },
    { id: 'midnight', name: 'Medianoche', bg: 'oklch(13% 0.035 255)', accent: 'oklch(74% 0.16 245)' },
    { id: 'emerald', name: 'Esmeralda', bg: 'oklch(15% 0.020 175)', accent: 'oklch(74% 0.15 162)' },
    { id: 'claro', name: 'Claro', bg: 'oklch(98% 0.004 80)', accent: 'oklch(48% 0.18 245)' },
  ];

  newThemeName = '';
  newThemeAccent = '#3b82f6';
  newThemeBg = '#f8f8f6';
  newThemeIsDark = false;

  activeCustomName() {
    return localStorage.getItem('active-custom-theme') ?? '';
  }

  saveCustomTheme() {
    if (!this.newThemeName.trim()) return;
    this.theme.saveCustomTheme({
      name: this.newThemeName.trim(),
      isDark: this.newThemeIsDark,
      accent: this.newThemeAccent,
      bg: this.newThemeBg,
    });
    this.newThemeName = '';
  }

  currencies = [
    { code: 'ARS', name: 'Peso argentino', symbol: '$' },
    { code: 'USD', name: 'Dólar estadounidense', symbol: 'US$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'COP', name: 'Peso colombiano', symbol: 'COP' },
  ];

  get shortcuts() {
    const m = this.os.mod;
    return [
      { action: 'Paleta de comandos', keys: `${m} K` },
      { action: 'Nuevo movimiento', keys: `${m} N` },
      { action: 'Cambiar tema', keys: `${m} ;` },
      { action: 'Buscar', keys: `${m} F` },
      { action: 'Ir a Dashboard', keys: 'g d' },
      { action: 'Ir a Movimientos', keys: 'g m' },
      { action: 'Ir a Cuentas', keys: 'g a' },
      { action: 'Ir a Tarjetas', keys: 'g t' },
      { action: 'Ir a Reportes', keys: 'g r' },
      { action: 'Ir a Configuración', keys: 'g s' },
    ];
  }

  userName = () => this.auth.currentUser()?.name ?? this.i18n.t('auth.name');
  userEmail = () => this.auth.currentUser()?.email ?? '';
  userRole = () => this.auth.currentUser()?.role ?? 'User';
  baseCurrency = () => this.auth.currentUser()?.baseCurrency ?? 'ARS';
  userInitials = () => {
    const n = this.auth.currentUser()?.name ?? 'U';
    return n
      .split(' ')
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase())
      .join('');
  };

  public auth = inject(AuthService);
  public theme = inject(ThemeService);
  public os = inject(PlatformService);
  private router = inject(Router);
  public i18n = inject(I18nService);

  logout() {
    this.auth.logout();
  }
}
