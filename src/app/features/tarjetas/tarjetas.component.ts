import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ApiService, AccountResponse, AccountBalance } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';

interface CardWithBalance extends AccountResponse {
  balance: AccountBalance;
}

@Component({
  selector: 'app-tarjetas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="view">
      @if (loading()) {
        <div class="empty-state">
          <p>{{ i18n.t('tarjetas.cargando') }}</p>
        </div>
      } @else if (cards().length === 0) {
        <div class="empty-state">
          <div class="serif">{{ i18n.t('tarjetas.sin_tarjetas') }}</div>
          <p>{{ i18n.t('tarjetas.sin_tarjetas_desc') }}</p>
        </div>
      } @else {
        <!-- KPI strip -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="eyebrow">{{ i18n.t('tarjetas.title') }}</div>
            <div class="num-md" style="margin-top:8px">{{ cards().length }}</div>
          </div>
          <div class="kpi-card">
            <div class="eyebrow">{{ i18n.t('tarjetas.total_utilizado') }}</div>
            <div class="num-md" style="margin-top:8px;color:var(--negative)">{{ totalUsed() | number: '1.0-0' }}</div>
          </div>
          <div class="kpi-card">
            <div class="eyebrow">{{ i18n.t('tarjetas.limite_total') }}</div>
            <div class="num-md" style="margin-top:8px">{{ totalLimit() | number: '1.0-0' }}</div>
          </div>
          <div class="kpi-card">
            <div class="eyebrow">{{ i18n.t('tarjetas.utilizacion_global') }}</div>
            <div
              class="num-md"
              style="margin-top:8px"
              [style.color]="
                globalUsePct() > 70 ? 'var(--negative)' : globalUsePct() > 40 ? 'var(--warning)' : 'var(--positive)'
              "
            >
              {{ globalUsePct() | number: '1.0-0' }}%
            </div>
          </div>
        </div>

        <!-- Card grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:var(--gutter)">
          @for (card of cards(); track card.id) {
            <div (click)="selectedId.set(card.id === selectedId() ? null : card.id)" style="cursor:pointer">
              <!-- CC visual -->
              <div
                class="cc"
                [class.cc--alt]="card.currency !== 'ARS'"
                style="margin-bottom:12px;transition:box-shadow .2s"
                [style.box-shadow]="
                  selectedId() === card.id ? '0 0 0 2px var(--accent), var(--shadow-2)' : 'var(--shadow-2)'
                "
              >
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <div style="font-size:10px;letter-spacing:.1em;opacity:.7">
                    {{ card.bank?.toUpperCase() ?? i18n.t('tarjetas.fallback_banco') }}
                  </div>
                  <div style="font-size:12px;font-weight:600;letter-spacing:.05em">{{ card.name.toUpperCase() }}</div>
                </div>
                <div class="cc__number">•••• •••• •••• {{ card.lastFour ?? '????' }}</div>
                <div style="display:flex;justify-content:space-between;align-items:flex-end">
                  <div>
                    <div style="font-size:8px;opacity:.6;letter-spacing:.08em;margin-bottom:2px">
                      {{ i18n.t('tarjetas.disponible') }}
                    </div>
                    <div class="mono" style="font-size:16px;font-weight:600">
                      {{ card.currency }} {{ available(card) | number: '1.0-0' }}
                    </div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-size:8px;opacity:.6;letter-spacing:.08em;margin-bottom:2px">
                      {{ i18n.t('tarjetas.vence') }}
                    </div>
                    <div class="mono" style="font-size:13px">
                      {{ card.paymentDay ? i18n.t('tarjetas.dia') + ' ' + card.paymentDay : '—' }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Usage bar -->
              <div class="card" style="padding:14px">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px">
                  <span style="color:var(--fg-2)">{{ i18n.t('tarjetas.utilizado_ciclo') }}</span>
                  <span class="mono" [style.color]="usePct(card) > 70 ? 'var(--negative)' : 'var(--fg-0)'">
                    {{ usePct(card) }}%
                  </span>
                </div>
                <div class="progress">
                  <div
                    class="progress__fill"
                    [style.width]="usePct(card) + '%'"
                    [style.background]="
                      usePct(card) > 70 ? 'var(--negative)' : usePct(card) > 40 ? 'var(--warning)' : 'var(--positive)'
                    "
                  ></div>
                </div>
                <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--fg-2)">
                  <span class="mono"
                    >{{ card.currency }} {{ card.balance.usedInCycle | number: '1.0-0' }}
                    {{ i18n.t('tarjetas.usado') }}</span
                  >
                  <span class="mono"
                    >{{ i18n.t('tarjetas.label_limite') }} {{ card.currency }}
                    {{ card.creditLimit! | number: '1.0-0' }}</span
                  >
                </div>
                @if (card.billingDay) {
                  <div style="margin-top:10px">
                    <div
                      style="display:flex;justify-content:space-between;font-size:11px;color:var(--fg-2);margin-bottom:6px"
                    >
                      <span>{{ i18n.t('tarjetas.ciclo_facturacion') }}</span>
                      <span class="mono">{{ cyclePct(card) }}%</span>
                    </div>
                    <div class="cycle">
                      <div class="cycle__fill" [style.width]="cyclePct(card) + '%'"></div>
                      <div class="cycle__node" [style.left]="cyclePct(card) + '%'"></div>
                    </div>
                    <div
                      style="display:flex;justify-content:space-between;font-size:10px;color:var(--fg-3);margin-top:4px"
                    >
                      <span>{{ i18n.t('tarjetas.cierre_dia') }} {{ card.billingDay }}</span>
                      @if (card.paymentDay) {
                        <span>{{ i18n.t('tarjetas.vence_dia') }} {{ card.paymentDay }}</span>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class TarjetasComponent implements OnInit {
  cards = signal<CardWithBalance[]>([]);
  loading = signal(true);
  selectedId = signal<string | null>(null);
  today = new Date();

  private api = inject(ApiService);
  public i18n = inject(I18nService);

  ngOnInit() {
    this.api.getAccounts().subscribe({
      next: (accounts) => {
        const creditCards = accounts.filter((a) => a.type === 'Credit' && a.isActive);
        if (creditCards.length === 0) {
          this.loading.set(false);
          return;
        }

        forkJoin(creditCards.map((c) => this.api.getAccountBalance(c.id))).subscribe({
          next: (balances) => {
            const combined = creditCards.map((c, i) => ({ ...c, balance: balances[i] }));
            this.cards.set(combined);
            this.loading.set(false);
          },
          error: () => {
            // fallback: show cards without live balance
            this.cards.set(creditCards.map((c) => ({ ...c, balance: { balance: 0, usedInCycle: 0 } })));
            this.loading.set(false);
          },
        });
      },
      error: () => this.loading.set(false),
    });
  }

  available(card: CardWithBalance): number {
    return Math.max(0, (card.creditLimit ?? 0) - card.balance.usedInCycle);
  }

  usePct(card: CardWithBalance): number {
    if (!card.creditLimit) return 0;
    return Math.min(100, Math.round((card.balance.usedInCycle / card.creditLimit) * 100));
  }

  cyclePct(card: CardWithBalance): number {
    const day = this.today.getDate();
    const close = card.billingDay ?? 1;
    const dayInCycle = day > close ? day - close : 30 - close + day;
    return Math.min(100, Math.max(0, Math.round((dayInCycle / 30) * 100)));
  }

  totalUsed() {
    return this.cards().reduce((s, c) => s + c.balance.usedInCycle, 0);
  }
  totalLimit() {
    return this.cards().reduce((s, c) => s + (c.creditLimit ?? 0), 0);
  }
  globalUsePct() {
    const limit = this.totalLimit();
    return limit > 0 ? Math.min(100, Math.round((this.totalUsed() / limit) * 100)) : 0;
  }
}
