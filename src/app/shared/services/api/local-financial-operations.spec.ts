import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { firstValueFrom } from 'rxjs';
import type { AccountResponse } from '../../models/account.model';
import type { InstallmentResponse } from '../../models/installment.model';
import type { MovementResponse } from '../../models/movement.model';
import { LocalDataRepository, type LocalBatchOperation, type LocalKind } from '../local/local-data.repository';
import { InstallmentsApiService } from './installments-api.service';
import { LoansApiService } from './loans-api.service';
import { MovementsApiService } from './movements-api.service';

class MemoryLocalData {
  private documents = new Map<LocalKind, Map<string, unknown>>();

  seed<T extends { id: string }>(kind: LocalKind, value: T): void {
    const bucket = this.documents.get(kind) ?? new Map<string, unknown>();
    bucket.set(value.id, structuredClone(value));
    this.documents.set(kind, bucket);
  }

  async list<T>(kind: LocalKind): Promise<T[]> {
    return [...(this.documents.get(kind)?.values() ?? [])].map((value) => structuredClone(value as T));
  }

  async get<T>(kind: LocalKind, id: string): Promise<T | null> {
    const value = this.documents.get(kind)?.get(id);
    return value ? structuredClone(value as T) : null;
  }

  async put<T extends { id: string }>(kind: LocalKind, value: T): Promise<T> {
    this.seed(kind, value);
    return structuredClone(value);
  }

  async putMany<T extends { id: string }>(kind: LocalKind, values: T[]): Promise<T[]> {
    for (const value of values) this.seed(kind, value);
    return structuredClone(values);
  }

  async batch(operations: LocalBatchOperation[]): Promise<unknown[]> {
    for (const operation of operations) {
      if (operation.action === 'put') this.seed(operation.kind, operation.value as { id: string });
      else this.documents.get(operation.kind)?.delete(operation.id);
    }
    return [];
  }

  async remove(kind: LocalKind, id: string): Promise<void> {
    this.documents.get(kind)?.delete(id);
  }
}

const account = (id: string, type: AccountResponse['type']): AccountResponse => ({
  id,
  name: id,
  type,
  currency: 'COP',
  bank: null,
  lastFour: null,
  creditLimit: type === 'Credit' ? 5000 : null,
  billingDay: type === 'Credit' ? 15 : null,
  paymentDay: type === 'Credit' ? 5 : null,
  interestRate: type === 'Credit' ? 2 : null,
  isDefault: false,
  isActive: true,
  createdAt: '2026-08-01',
});

describe('local financial operation services', () => {
  let local: MemoryLocalData;
  let movements: MovementsApiService;
  let loans: LoansApiService;
  let installments: InstallmentsApiService;

  beforeEach(() => {
    local = new MemoryLocalData();
    local.seed('account', account('cash', 'Debit'));
    local.seed('account', account('savings', 'Debit'));
    local.seed('account', account('card', 'Credit'));
    TestBed.configureTestingModule({
      providers: [
        MovementsApiService,
        LoansApiService,
        InstallmentsApiService,
        { provide: LocalDataRepository, useValue: local },
      ],
    });
    movements = TestBed.inject(MovementsApiService);
    loans = TestBed.inject(LoansApiService);
    installments = TestBed.inject(InstallmentsApiService);
  });

  it('creates one linked installment projection using the total purchase amount', async () => {
    const purchase = await firstValueFrom(movements.createMovement({
      type: 'Expense', sourceType: 'CreditCard', accountId: 'card', amount: 300, currency: 'COP',
      trmApplied: 1, date: '2026-08-01', description: 'Equipo', loanInstallments: 3,
    }));
    const plans = await local.list<InstallmentResponse>('installmentpurchase');
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ totalAmount: 300, monthlyAmount: 100, purchaseMovementId: purchase.id });
    expect(purchase.installmentPurchaseId).toBe(plans[0].id);
  });

  it('replays an idempotent savings transfer without duplicating its two legs', async () => {
    const request = {
      sourceAccountId: 'cash', destinationAccountId: 'savings', amount: 80, currency: 'COP',
      trmApplied: 1, date: '2026-08-02', isSaving: true,
    };
    await firstValueFrom(movements.createTransfer(request, 'saving-1'));
    await firstValueFrom(movements.createTransfer(request, 'saving-1'));
    await expect(
      firstValueFrom(movements.createTransfer({ ...request, amount: 81 }, 'saving-1')),
    ).rejects.toThrow('idempotency_key_conflict');
    const rows = (await local.list<MovementResponse>('movement')).filter((item) => item.operationId === 'saving-1');
    expect(rows).toHaveLength(2);
    expect(rows.every((item) => item.operationType === 'Saving')).toBe(true);
  });

  it('records loan disbursement and payment with principal and interest', async () => {
    const loan = await firstValueFrom(loans.createLoan({
      description: 'Banco', principal: 1200, currency: 'COP', trmApplied: 1,
      interestRateAnnual: 12, termMonths: 12, startDate: '2026-08-01', accountId: 'cash',
    }));
    const paid = await firstValueFrom(loans.payLoan(loan.id, 'cash', 0, 'loan-payment-1'));
    const replay = await firstValueFrom(loans.payLoan(loan.id, 'cash', 0, 'loan-payment-1'));
    await expect(
      firstValueFrom(loans.payLoan(loan.id, 'savings', 0, 'loan-payment-1')),
    ).rejects.toThrow('idempotency_key_conflict');
    const rows = (await local.list<MovementResponse>('movement')).filter((item) => item.loanId === loan.id);
    expect(rows.some((item) => item.operationType === 'LoanDisbursement')).toBe(true);
    const payment = rows.find((item) => item.operationType === 'LoanPayment')!;
    expect(payment.interestComponent).toBeGreaterThan(0);
    expect(payment.principalComponent).toBeGreaterThan(0);
    expect(paid.outstandingPrincipal).toBeLessThan(loan.principal);
    expect(replay.paidMonths).toBe(1);
    expect(rows.filter((item) => item.operationType === 'LoanPayment')).toHaveLength(1);
  });

  it('pays an installment atomically and does not duplicate an idempotent replay', async () => {
    const purchase = await firstValueFrom(movements.createMovement({
      type: 'Expense', sourceType: 'CreditCard', accountId: 'card', amount: 300, currency: 'COP',
      trmApplied: 1, date: '2026-08-01', description: 'Equipo', loanInstallments: 3, loanInterestRate: 2,
    }));
    const first = await firstValueFrom(installments.payInstallment(purchase.installmentPurchaseId!, 'cash', 'quota-1'));
    const replay = await firstValueFrom(installments.payInstallment(purchase.installmentPurchaseId!, 'cash', 'quota-1'));
    await expect(
      firstValueFrom(installments.payInstallment(purchase.installmentPurchaseId!, 'savings', 'quota-1')),
    ).rejects.toThrow('idempotency_key_conflict');
    const rows = (await local.list<MovementResponse>('movement')).filter((item) => item.operationId === 'quota-1');
    expect(first).toMatchObject({ paidCount: 1, remainingAmount: 200 });
    expect(replay.paidCount).toBe(1);
    expect(rows).toHaveLength(3);
    expect(rows.filter((item) => item.operationType === 'CreditPayment')).toHaveLength(2);
    expect(rows.find((item) => item.operationType === 'CreditInterest')?.amount).toBe(2);
  });
});
