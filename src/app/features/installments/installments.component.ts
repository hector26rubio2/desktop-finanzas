import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService, InstallmentResponse, AccountResponse } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';

@Component({
  selector: 'app-installments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './installments.component.html',
  styleUrl: './installments.component.css',
})
export class InstallmentsComponent implements OnInit {
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
