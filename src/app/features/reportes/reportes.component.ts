import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { forkJoin } from 'rxjs';

interface MonthStat {
  month: string;
  income: number;
  expense: number;
}

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="view">
      <!-- Tabs -->
      <div style="display:flex;gap:8px;align-items:center">
        <div class="seg-ctrl">
          <button
            class="seg-ctrl__btn"
            [class.seg-ctrl__btn--active]="tab() === 'overview'"
            (click)="tab.set('overview')"
          >
            {{ i18n.t('reportes.tab_general') }}
          </button>
          <button class="seg-ctrl__btn" [class.seg-ctrl__btn--active]="tab() === 'cat'" (click)="tab.set('cat')">
            {{ i18n.t('reportes.tab_categorias') }}
          </button>
          <button class="seg-ctrl__btn" [class.seg-ctrl__btn--active]="tab() === 'mom'" (click)="tab.set('mom')">
            {{ i18n.t('reportes.tab_mes_a_mes') }}
          </button>
        </div>
        <div style="margin-left:auto">
          <button class="btn btn--ghost" style="font-size:11px">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            >
              <path d="M8 1v10M4 7l4 4 4-4M2 13h12" />
            </svg>
            {{ i18n.t('reportes.exportar_csv') }}
          </button>
        </div>
      </div>

      <!-- Overview tab -->
      @if (tab() === 'overview') {
        @if (loading()) {
          <div class="empty-state">
            <p>{{ i18n.t('reportes.cargando') }}</p>
          </div>
        } @else {
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="eyebrow">{{ i18n.t('reportes.ingresos_12m') }}</div>
              <div class="num-md pos-text" style="margin-top:8px;font-size:24px">
                {{ income12() | number: '1.0-0' }}
              </div>
            </div>
            <div class="kpi-card">
              <div class="eyebrow">{{ i18n.t('reportes.gastos_12m') }}</div>
              <div class="num-md" style="margin-top:8px;font-size:24px;color:var(--negative)">
                {{ expense12() | number: '1.0-0' }}
              </div>
            </div>
            <div class="kpi-card">
              <div class="eyebrow">{{ i18n.t('reportes.ahorro_neto') }}</div>
              <div
                class="num-md"
                style="margin-top:8px;font-size:24px"
                [style.color]="income12() - expense12() >= 0 ? 'var(--positive)' : 'var(--negative)'"
              >
                {{ income12() - expense12() | number: '1.0-0' }}
              </div>
            </div>
            <div class="kpi-card">
              <div class="eyebrow">{{ i18n.t('reportes.tasa_ahorro') }}</div>
              <div class="num-md" style="margin-top:8px;font-size:24px">
                {{ income12() > 0 ? (((income12() - expense12()) / income12()) * 100 | number: '1.1-1') : '0' }}%
              </div>
            </div>
          </div>

          <!-- Cashflow table -->
          <div class="card" style="padding:0;overflow:hidden">
            <div class="card__h">
              <span class="card__title">{{ i18n.t('reportes.cashflow_title') }}</span>
            </div>
            <table class="table">
              <thead>
                <tr>
                  <th>{{ i18n.t('reportes.table_mes') }}</th>
                  <th class="num">{{ i18n.t('reportes.table_ingresos') }}</th>
                  <th class="num">{{ i18n.t('reportes.table_gastos') }}</th>
                  <th class="num">{{ i18n.t('reportes.table_neto') }}</th>
                  <th>{{ i18n.t('reportes.table_barra') }}</th>
                </tr>
              </thead>
              <tbody>
                @for (s of monthStats(); track s.month) {
                  @let neto = s.income - s.expense;
                  <tr>
                    <td class="mono" style="font-size:12px">{{ s.month }}</td>
                    <td class="num pos-text mono">+ {{ s.income | number: '1.0-0' }}</td>
                    <td class="num mono" style="color:var(--negative)">− {{ s.expense | number: '1.0-0' }}</td>
                    <td class="num mono" [style.color]="neto >= 0 ? 'var(--positive)' : 'var(--negative)'">
                      {{ neto >= 0 ? '+' : '−' }}{{ (neto < 0 ? -neto : neto) | number: '1.0-0' }}
                    </td>
                    <td style="padding-right:var(--pad-x)">
                      <div class="progress" style="max-width:120px">
                        <div
                          class="progress__fill"
                          [style.width]="maxExpense() > 0 ? (s.expense / maxExpense()) * 100 + '%' : '0'"
                          [style.background]="neto >= 0 ? 'var(--positive)' : 'var(--negative)'"
                        ></div>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }

      <!-- Categories tab -->
      @if (tab() === 'cat') {
        <div class="empty-state">
          <div class="serif">{{ i18n.t('reportes.proximamente') }}</div>
          <p>{{ i18n.t('reportes.proximamente_desc') }}</p>
        </div>
      }

      <!-- Month over month -->
      @if (tab() === 'mom') {
        @if (!loading() && monthStats().length > 0) {
          <div class="card" style="padding:0;overflow:hidden">
            <div class="card__h">
              <span class="card__title">{{ i18n.t('reportes.comparativo_title') }}</span>
            </div>
            <table class="table">
              <thead>
                <tr>
                  <th>{{ i18n.t('reportes.table_mes') }}</th>
                  <th class="num">{{ i18n.t('reportes.table_ingresos') }}</th>
                  <th class="num">{{ i18n.t('reportes.table_vs_anterior') }}</th>
                  <th class="num">{{ i18n.t('reportes.table_gastos') }}</th>
                  <th class="num">{{ i18n.t('reportes.table_vs_anterior') }}</th>
                </tr>
              </thead>
              <tbody>
                @for (s of monthStats(); track s.month; let i = $index) {
                  @let prev = i > 0 ? monthStats()[i - 1] : null;
                  @let incomeDelta = prev ? ((s.income - prev.income) / (prev.income || 1)) * 100 : 0;
                  @let expenseDelta = prev ? ((s.expense - prev.expense) / (prev.expense || 1)) * 100 : 0;
                  <tr>
                    <td class="mono" style="font-size:12px">{{ s.month }}</td>
                    <td class="num mono pos-text">{{ s.income | number: '1.0-0' }}</td>
                    <td
                      class="num mono"
                      style="font-size:11px"
                      [style.color]="incomeDelta >= 0 ? 'var(--positive)' : 'var(--negative)'"
                    >
                      {{ prev ? (incomeDelta >= 0 ? '+' : '') + (incomeDelta | number: '1.1-1') + '%' : '—' }}
                    </td>
                    <td class="num mono" style="color:var(--negative)">{{ s.expense | number: '1.0-0' }}</td>
                    <td
                      class="num mono"
                      style="font-size:11px"
                      [style.color]="expenseDelta <= 0 ? 'var(--positive)' : 'var(--negative)'"
                    >
                      {{ prev ? (expenseDelta >= 0 ? '+' : '') + (expenseDelta | number: '1.1-1') + '%' : '—' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (!loading()) {
          <div class="empty-state">
            <p>{{ i18n.t('reportes.sin_datos') }}</p>
          </div>
        } @else {
          <div class="empty-state">
            <p>{{ i18n.t('common.loading') }}</p>
          </div>
        }
      }
    </div>
  `,
})
export class ReportesComponent implements OnInit {
  tab = signal<'overview' | 'cat' | 'mom'>('overview');
  loading = signal(true);
  monthStats = signal<MonthStat[]>([]);
  income12 = signal(0);
  expense12 = signal(0);
  maxExpense = signal(0);

  private api = inject(ApiService);
  public i18n = inject(I18nService);

  ngOnInit() {
    const now = new Date();
    const requests = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    forkJoin(requests.map((ym) => this.api.getMovementSummary(ym))).subscribe((sums) => {
      const stats = sums.map((s, i) => ({ month: requests[i], income: s.totalIncome, expense: s.totalExpense }));
      this.monthStats.set(stats);
      this.income12.set(stats.reduce((a, s) => a + s.income, 0));
      this.expense12.set(stats.reduce((a, s) => a + s.expense, 0));
      this.maxExpense.set(Math.max(...stats.map((s) => s.expense), 1));
      this.loading.set(false);
    });
  }
}
