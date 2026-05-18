import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService, InstallmentResponse, AccountResponse } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';

@Component({
  selector: 'app-cuotas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="view">
      <div class="row-flex">
        <h3 class="serif" style="font-size:22px;font-weight:400;flex:1">{{ i18n.t('cuotas.title') }}</h3>
        <button class="btn btn--primary" (click)="showForm = !showForm">{{ i18n.t('cuotas.nueva_compra') }}</button>
      </div>

      @if (showForm) {
        <div class="card" style="padding:var(--pad-x)">
          <form [formGroup]="form" (ngSubmit)="save()">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <label style="grid-column:1/-1">
                {{ i18n.t('cuotas.descripcion') }}
                <input formControlName="description" [placeholder]="i18n.t('cuotas.descripcion_placeholder')" />
              </label>
              <label>
                {{ i18n.t('cuotas.monto_total') }}
                <input type="number" formControlName="totalAmount" min="1" />
              </label>
              <label>
                {{ i18n.t('cuotas.moneda') }}
                <select formControlName="currency">
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                  <option value="COP">COP</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
              <label>
                {{ i18n.t('cuotas.trm') }}
                <input type="number" formControlName="trmApplied" min="0.000001" step="0.01" />
              </label>
              <label>
                {{ i18n.t('cuotas.cantidad_cuotas') }}
                <input type="number" formControlName="installmentsCount" min="1" max="120" />
              </label>
              <label>
                {{ i18n.t('cuotas.cuotas_pagadas') }}
                <input type="number" formControlName="paidCount" min="0" />
              </label>
              <label>
                {{ i18n.t('cuotas.fecha_primera') }}
                <input type="date" formControlName="startDate" />
              </label>
              <label>
                {{ i18n.t('cuotas.tarjeta_cuenta') }}
                <select formControlName="accountId">
                  <option value="">{{ i18n.t('cuotas.ninguna') }}</option>
                  @for (a of accounts(); track a.id) {
                    <option [value]="a.id">{{ a.name }}</option>
                  }
                </select>
              </label>
            </div>
            <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
              <button type="button" class="btn btn--ghost" (click)="showForm = false">
                {{ i18n.t('common.cancel') }}
              </button>
              <button type="submit" class="btn btn--primary" [disabled]="form.invalid || saving()">
                {{ saving() ? '…' : i18n.t('common.save') }}
              </button>
            </div>
          </form>
        </div>
      }

      @if (loading()) {
        <div class="empty-state">
          <p>{{ i18n.t('cuotas.cargando') }}</p>
        </div>
      } @else if (installments().length === 0) {
        <div class="empty-state">
          <div class="serif">{{ i18n.t('cuotas.sin_compras') }}</div>
          <p>{{ i18n.t('cuotas.sin_compras_desc') }}</p>
        </div>
      } @else {
        <!-- KPI strip -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="eyebrow">{{ i18n.t('cuotas.compras_activas') }}</div>
            <div class="num-md" style="margin-top:8px">{{ activeCount() }}</div>
          </div>
          <div class="kpi-card">
            <div class="eyebrow">{{ i18n.t('cuotas.total_comprometido') }}</div>
            <div class="num-md" style="margin-top:8px;color:var(--negative)">
              {{ totalRemaining() | number: '1.0-0' }}
            </div>
          </div>
          <div class="kpi-card">
            <div class="eyebrow">{{ i18n.t('cuotas.cuotas_este_mes') }}</div>
            <div class="num-md" style="margin-top:8px">{{ monthlyTotal() | number: '1.0-0' }}</div>
          </div>
        </div>

        <!-- Installment cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:var(--gutter)">
          @for (inst of installments(); track inst.id) {
            <div class="card" style="padding:16px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
                <div>
                  <div style="font-weight:500;color:var(--fg-0)">{{ inst.description }}</div>
                  <div class="mono subtle" style="font-size:11px;margin-top:2px">
                    {{ inst.currency }} {{ inst.monthlyAmount | number: '1.0-0' }}/mes
                  </div>
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                  <span class="tag tag--accent" style="font-size:10px"
                    >{{ inst.paidCount }}/{{ inst.installmentsCount }}</span
                  >
                  <button class="btn btn--ghost btn--icon" style="color:var(--negative)" (click)="deleteInst(inst.id)">
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
              </div>

              <!-- Progress bar -->
              <div class="progress" style="margin-bottom:8px">
                <div class="progress__fill" [style.width]="pct(inst) + '%'"></div>
              </div>

              <!-- Dot calendar -->
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
                @for (i of range(inst.installmentsCount); track i) {
                  <div
                    style="width:10px;height:10px;border-radius:2px"
                    [style.background]="
                      i < inst.paidCount ? 'var(--positive)' : i === inst.paidCount ? 'var(--accent)' : 'var(--bg-3)'
                    "
                  ></div>
                }
              </div>

              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--fg-2)">
                <span
                  >{{ i18n.t('cuotas.restante') }}
                  <span class="mono" style="color:var(--negative)"
                    >{{ inst.currency }} {{ inst.remainingAmount | number: '1.0-0' }}</span
                  ></span
                >
                <button
                  class="btn btn--ghost"
                  style="font-size:10px;padding:2px 8px"
                  [disabled]="inst.paidCount >= inst.installmentsCount"
                  (click)="markPaid(inst)"
                >
                  {{ i18n.t('cuotas.marcar_cuota') }}
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CuotasComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public i18n = inject(I18nService);

  installments = signal<InstallmentResponse[]>([]);
  accounts = signal<AccountResponse[]>([]);
  loading = signal(true);
  saving = signal(false);
  showForm = false;

  form = this.fb.group({
    description: ['', Validators.required],
    totalAmount: [null as number | null, [Validators.required, Validators.min(1)]],
    currency: ['ARS', Validators.required],
    trmApplied: [1],
    installmentsCount: [null as number | null, [Validators.required, Validators.min(1), Validators.max(120)]],
    paidCount: [0],
    startDate: ['', Validators.required],
    accountId: [''],
  });

  ngOnInit() {
    this.api.getInstallments().subscribe({
      next: (list) => {
        this.installments.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.api.getAccounts().subscribe((list) => this.accounts.set(list));
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.value;
    this.api
      .createInstallment({
        description: v.description!,
        accountId: v.accountId || undefined,
        totalAmount: v.totalAmount!,
        currency: v.currency!,
        trmApplied: v.trmApplied ?? 1,
        installmentsCount: v.installmentsCount!,
        paidCount: v.paidCount ?? 0,
        startDate: v.startDate!,
      })
      .subscribe({
        next: (inst) => {
          this.installments.update((l) => [...l, inst]);
          this.saving.set(false);
          this.showForm = false;
          this.form.reset({ currency: 'ARS', trmApplied: 1, paidCount: 0 });
        },
        error: () => this.saving.set(false),
      });
  }

  markPaid(inst: InstallmentResponse) {
    const newCount = Math.min(inst.paidCount + 1, inst.installmentsCount);
    this.api.updateInstallmentPaid(inst.id, newCount).subscribe((updated) => {
      this.installments.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
    });
  }

  deleteInst(id: string) {
    this.api.deleteInstallment(id).subscribe(() => {
      this.installments.update((list) => list.filter((i) => i.id !== id));
    });
  }

  pct(inst: InstallmentResponse) {
    return Math.round((inst.paidCount / inst.installmentsCount) * 100);
  }
  range(n: number) {
    return Array.from({ length: Math.min(n, 36) }, (_, i) => i);
  }
  activeCount() {
    return this.installments().filter((i) => i.paidCount < i.installmentsCount).length;
  }
  totalRemaining() {
    return this.installments().reduce((s, i) => s + i.remainingAmount, 0);
  }
  monthlyTotal() {
    return this.installments()
      .filter((i) => i.paidCount < i.installmentsCount)
      .reduce((s, i) => s + i.monthlyAmount, 0);
  }
}
