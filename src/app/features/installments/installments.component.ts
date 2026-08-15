import { Component, inject, OnInit, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, formatNumber } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService, InstallmentResponse, AccountResponse } from '../../shared/services/api.service';
import { installmentPaymentKey } from '../../shared/services/api/installments-api.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { ModalComponent } from '@ui/organisms/modal/modal.component';
import { FieldErrorComponent } from '@ui/atoms/field-error/field-error.component';
import { KpiStripComponent, type KpiStripItem } from '@ui/molecules/kpi-strip/kpi-strip.component';
import { ConfirmDialogComponent } from '@ui/molecules/confirm-dialog/confirm-dialog.component';
import { NotificationService } from '../../core/services/notification.service';
import { Router } from '@angular/router';
import { SkeletonComponent } from '@ui/atoms/skeleton/skeleton.component';

@Component({
  selector: 'app-installments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalComponent,
    FieldErrorComponent,
    KpiStripComponent,
    ConfirmDialogComponent,
    SkeletonComponent,
  ],
  templateUrl: './installments.component.html',
  styleUrl: './installments.component.css',
})
export class InstallmentsComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private notif = inject(NotificationService);

  createPurchase() {
    this.router.navigate(['/cards']);
  }

  installments = signal<InstallmentResponse[]>([]);
  accounts = signal<AccountResponse[]>([]);
  loading = signal(true);
  saving = signal(false);
  showForm = signal(false);
  deleting = signal<InstallmentResponse | null>(null);

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
    this.api
      .getInstallments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.installments.set(list);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    this.api
      .getAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => this.accounts.set(list));
  }

  save() {
    // Un doble clic creaba dos compras a cuotas con sus dos movimientos.
    if (this.saving()) return;
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
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (inst) => {
          this.installments.update((l) => [...l, inst]);
          this.saving.set(false);
          this.showForm.set(false);
          this.form.reset({ currency: 'ARS', trmApplied: 1, paidCount: 0 });
        },
        error: () => this.saving.set(false),
      });
  }

  markPaid(inst: InstallmentResponse) {
    const source = this.accounts().find((a) => a.type !== 'Credit' && a.isActive && a.currency === inst.currency);
    if (!source) return;
    this.api
      .payInstallment(inst.id, source.id, installmentPaymentKey(inst))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updated) => {
        this.installments.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
      });
  }

  hasPaymentSource(inst: InstallmentResponse) {
    return this.accounts().some((a) => a.type !== 'Credit' && a.isActive && a.currency === inst.currency);
  }

  /**
   * Borrar un plan de cuotas es irreversible y antes bastaba un clic. Se
   * pregunta primero, igual que en préstamos y recurrentes.
   */
  askDelete(inst: InstallmentResponse) {
    this.deleting.set(inst);
  }

  cancelDelete() {
    this.deleting.set(null);
  }

  confirmDelete() {
    const inst = this.deleting();
    if (!inst) return;
    this.deleting.set(null);
    this.api
      .deleteInstallment(inst.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.installments.update((list) => list.filter((i) => i.id !== inst.id));
          this.notif.announce(this.i18n.t('installments.deleted'));
        },
        error: () => this.notif.announce(this.i18n.t('common.load_error')),
      });
  }

  pct(inst: InstallmentResponse) {
    return Math.round((inst.paidCount / inst.installmentsCount) * 100);
  }
  range(n: number) {
    return Array.from({ length: Math.min(n, 36) }, (_, i) => i);
  }
  kpiItems(): KpiStripItem[] {
    const fmt = (v: number) => formatNumber(v, 'en-US', '1.0-0');
    return [
      { label: this.i18n.t('installments.compras_activas'), value: '' + this.activeCount() },
      {
        label: this.i18n.t('installments.total_comprometido'),
        value: fmt(this.totalRemaining()),
        color: 'var(--negative)',
      },
      { label: this.i18n.t('installments.cuotas_este_mes'), value: fmt(this.monthlyTotal()) },
    ];
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
