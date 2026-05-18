import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService, AccountResponse, AccountRequest } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';

@Component({
  selector: 'app-cuentas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="view">
      <!-- KPI strip -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="eyebrow">{{ i18n.t('cuentas.title') }}</div>
          <div class="num-md" style="margin-top:8px">{{ accounts().length }}</div>
        </div>
        <div class="kpi-card">
          <div class="eyebrow">{{ i18n.t('cuentas.total_ars') }}</div>
          <div class="num-md" style="margin-top:8px">$ {{ arsTotal() | number: '1.0-0' }}</div>
        </div>
        <div class="kpi-card">
          <div class="eyebrow">{{ i18n.t('cuentas.acciones') }}</div>
          <div style="margin-top:10px;display:flex;gap:6px">
            <button class="btn btn--ghost" style="font-size:11px">{{ i18n.t('cuentas.sincronizar') }}</button>
            <button class="btn btn--primary" style="font-size:11px" (click)="openCreate()">
              {{ i18n.t('cuentas.nueva') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Form -->
      @if (showForm) {
        <div class="card" style="padding:var(--pad-x)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <h3 style="font-family:'Instrument Serif',serif;font-style:italic;font-size:18px;font-weight:400">
              {{ editing() ? i18n.t('cuentas.editar_title') : i18n.t('cuentas.nueva_title') }}
            </h3>
            <button class="btn btn--ghost btn--icon" (click)="cancelForm()">
              <svg
                width="14"
                height="14"
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
          <form [formGroup]="form" (ngSubmit)="save()">
            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
              <label style="flex:2;min-width:160px">
                {{ i18n.t('cuentas.nombre') }}
                <input formControlName="name" placeholder="{{ i18n.t('cuentas.nombre_placeholder') }}" />
                @if (form.get('name')?.invalid && form.get('name')?.touched) {
                  <span class="field-error">{{ i18n.t('cuentas.required') }}</span>
                }
              </label>
              <label style="flex:1;min-width:120px">
                {{ i18n.t('cuentas.tipo') }}
                <select formControlName="type" (change)="onTypeChange()">
                  <option value="Cash">{{ i18n.t('cuentas.tipo_efectivo') }}</option>
                  <option value="Debit">{{ i18n.t('cuentas.tipo_debito') }}</option>
                  <option value="Credit">{{ i18n.t('cuentas.tipo_credito') }}</option>
                </select>
              </label>
              <label style="flex:1;min-width:100px">
                {{ i18n.t('cuentas.moneda') }}
                <select formControlName="currency">
                  <option>ARS</option>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>COP</option>
                </select>
              </label>
            </div>
            @if (isNotCash) {
              <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
                <label style="flex:2;min-width:160px">
                  {{ i18n.t('cuentas.banco') }}
                  <input formControlName="bank" placeholder="{{ i18n.t('cuentas.banco_placeholder') }}" />
                </label>
                <label style="flex:1;min-width:100px">
                  {{ i18n.t('cuentas.ultimos_digitos') }}
                  <input
                    formControlName="lastFour"
                    maxlength="4"
                    placeholder="{{ i18n.t('cuentas.ultimos_digitos_placeholder') }}"
                  />
                </label>
              </div>
            }
            @if (isCreditType) {
              <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
                <label style="flex:1;min-width:120px">
                  {{ i18n.t('cuentas.limite') }}
                  <input
                    type="number"
                    formControlName="creditLimit"
                    min="0"
                    step="1000"
                    placeholder="{{ i18n.t('cuentas.limite_placeholder') }}"
                  />
                </label>
                <label style="flex:1;min-width:100px">
                  {{ i18n.t('cuentas.dia_cierre') }}
                  <input type="number" formControlName="billingDay" min="1" max="31" />
                </label>
                <label style="flex:1;min-width:100px">
                  {{ i18n.t('cuentas.dia_vencimiento') }}
                  <input type="number" formControlName="paymentDay" min="1" max="31" />
                </label>
                <label style="flex:1;min-width:100px">
                  {{ i18n.t('cuentas.tasa_mensual') }}
                  <input type="number" formControlName="interestRate" min="0" step="0.01" />
                </label>
              </div>
            }
            <div style="display:flex;justify-content:flex-end;gap:8px">
              <button type="button" class="btn btn--ghost" (click)="cancelForm()">{{ i18n.t('common.cancel') }}</button>
              <button type="submit" class="btn btn--primary" [disabled]="form.invalid || saving()">
                {{ saving() ? i18n.t('common.saving') : i18n.t('common.save') }}
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Accounts table -->
      @if (loading()) {
        <div class="empty-state">
          <p>{{ i18n.t('cuentas.cargando') }}</p>
        </div>
      } @else if (accounts().length === 0 && !showForm) {
        <div class="empty-state">
          <div class="serif">{{ i18n.t('cuentas.sin_cuentas') }}</div>
          <p>{{ i18n.t('cuentas.sin_cuentas_desc') }}</p>
          <button class="btn btn--primary" style="margin-top:16px" (click)="openCreate()">
            {{ i18n.t('cuentas.nueva_btn') }}
          </button>
        </div>
      } @else if (accounts().length > 0) {
        <div class="card" style="padding:0;overflow:hidden">
          <table class="table">
            <thead>
              <tr>
                <th style="width:32px"></th>
                <th>{{ i18n.t('cuentas.table_cuenta') }}</th>
                <th>{{ i18n.t('cuentas.table_banco') }}</th>
                <th>{{ i18n.t('cuentas.table_tipo') }}</th>
                <th style="width:60px">{{ i18n.t('cuentas.table_moneda') }}</th>
                <th class="num">{{ i18n.t('cuentas.table_saldo') }}</th>
                <th class="num">{{ i18n.t('cuentas.table_detalle') }}</th>
                <th style="width:70px"></th>
              </tr>
            </thead>
            <tbody>
              @for (a of accounts(); track a.id) {
                <tr>
                  <td>
                    <span
                      style="width:28px;height:28px;border-radius:var(--radius-sm);background:var(--bg-2);border:1px solid var(--line);display:grid;place-items:center;font-family:'Geist Mono',monospace;font-size:10px;color:var(--fg-2)"
                    >
                      {{ (a.bank ?? a.name).slice(0, 2).toUpperCase() }}
                    </span>
                  </td>
                  <td>
                    <div style="color:var(--fg-0)">{{ a.name }}</div>
                    @if (a.lastFour) {
                      <div class="mono subtle" style="font-size:10px">···· {{ a.lastFour }}</div>
                    }
                  </td>
                  <td class="muted">{{ a.bank ?? '—' }}</td>
                  <td>
                    <span class="tag" [class]="'tag--' + a.type.toLowerCase()">{{ typeLabel(a.type) }}</span>
                  </td>
                  <td class="mono" style="font-size:12px">{{ a.currency }}</td>
                  <td class="num mono">{{ a.currency === 'ARS' ? '$ ' : '' }}{{ 0 | number: '1.0-0' }}</td>
                  <td class="num subtle" style="font-size:11px">
                    @if (a.type === 'Credit' && a.creditLimit) {
                      {{ i18n.t('cuentas.label_limite') }} {{ a.creditLimit | number: '1.0-0' }}
                    }
                    @if (a.billingDay) {
                      <span style="display:block">{{ i18n.t('cuentas.label_cierre') }} {{ a.billingDay }}</span>
                    }
                  </td>
                  <td>
                    <div style="display:flex;gap:4px">
                      <button
                        class="btn btn--ghost btn--icon"
                        (click)="openEdit(a)"
                        [title]="i18n.t('cuentas.editar_tooltip')"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.8"
                          stroke-linecap="round"
                        >
                          <path d="M11 2l3 3-9 9H2v-3z" />
                        </svg>
                      </button>
                      <button
                        class="btn btn--ghost btn--icon"
                        style="color:var(--negative)"
                        (click)="remove(a.id)"
                        [title]="i18n.t('cuentas.desactivar_tooltip')"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.8"
                          stroke-linecap="round"
                        >
                          <path d="M1 1l14 14M15 1L1 15" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class CuentasComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public i18n = inject(I18nService);

  accounts = signal<AccountResponse[]>([]);
  loading = signal(true);
  saving = signal(false);
  editing = signal<AccountResponse | null>(null);
  showForm = false;

  arsTotal = () =>
    this.accounts()
      .filter((a) => a.currency === 'ARS')
      .reduce((s, _) => s, 0);

  form = this.fb.group({
    name: ['', Validators.required],
    type: ['Debit' as 'Cash' | 'Debit' | 'Credit', Validators.required],
    currency: ['ARS', Validators.required],
    bank: [''],
    lastFour: [''],
    creditLimit: [null as number | null],
    billingDay: [null as number | null],
    paymentDay: [null as number | null],
    interestRate: [null as number | null],
  });

  get isNotCash(): boolean {
    return this.form.value.type !== 'Cash';
  }
  get isCreditType(): boolean {
    return this.form.value.type === 'Credit';
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.getAccounts().subscribe({
      next: (list) => {
        this.accounts.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate() {
    this.editing.set(null);
    this.form.reset({ type: 'Debit', currency: 'ARS' });
    this.showForm = true;
  }

  openEdit(a: AccountResponse) {
    this.editing.set(a);
    this.form.patchValue({
      name: a.name,
      type: a.type,
      currency: a.currency,
      bank: a.bank ?? '',
      lastFour: a.lastFour ?? '',
      creditLimit: a.creditLimit,
      billingDay: a.billingDay,
      paymentDay: a.paymentDay,
      interestRate: a.interestRate,
    });
    this.showForm = true;
  }

  cancelForm() {
    this.showForm = false;
    this.editing.set(null);
  }

  onTypeChange() {
    if (this.form.value.type !== 'Credit')
      this.form.patchValue({ creditLimit: null, billingDay: null, paymentDay: null, interestRate: null });
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.value;
    const req: AccountRequest = {
      name: v.name!,
      type: v.type!,
      currency: v.currency!,
      bank: v.bank || undefined,
      lastFour: v.lastFour || undefined,
      creditLimit: v.creditLimit ?? undefined,
      billingDay: v.billingDay ?? undefined,
      paymentDay: v.paymentDay ?? undefined,
      interestRate: v.interestRate ?? undefined,
    };
    const op = this.editing() ? this.api.updateAccount(this.editing()!.id, req) : this.api.createAccount(req);
    op.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm = false;
        this.editing.set(null);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(id: string) {
    if (!confirm(this.i18n.t('cuentas.desactivar_confirm'))) return;
    this.api.deleteAccount(id).subscribe(() => this.load());
  }

  typeLabel(t: string): string {
    return t === 'Cash'
      ? this.i18n.t('cuentas.tipo_efectivo')
      : t === 'Debit'
        ? this.i18n.t('cuentas.tipo_debito')
        : this.i18n.t('cuentas.tipo_credito');
  }
}
