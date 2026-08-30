import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { firstValueFrom } from 'rxjs';
import type { AccountResponse } from '../../models/account.model';
import type { InstallmentResponse } from '../../models/installment.model';
import type { MovementResponse } from '../../models/movement.model';
import { LocalDataRepository, type LocalBatchOperation, type LocalKind } from '../local/local-data.repository';
import { InstallmentsApiService, installmentPaymentKey } from './installments-api.service';
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

const account = (id: string, type: AccountResponse['type'], currency = 'COP'): AccountResponse => ({
  id,
  name: id,
  type,
  currency,
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
    local.seed('account', account('usd', 'Debit', 'USD'));
    local.seed('account', { ...account('closed', 'Debit'), isActive: false });
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
    const purchase = await firstValueFrom(
      movements.createMovement({
        type: 'Expense',
        sourceType: 'CreditCard',
        accountId: 'card',
        amount: 300,
        currency: 'COP',
        trmApplied: 1,
        date: '2026-08-01',
        description: 'Equipo',
        loanInstallments: 3,
      }),
    );
    const plans = await local.list<InstallmentResponse>('installmentpurchase');
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ totalAmount: 300, monthlyAmount: 100, purchaseMovementId: purchase.id });
    expect(purchase.installmentPurchaseId).toBe(plans[0].id);
  });

  it('replays an idempotent savings transfer without duplicating its two legs', async () => {
    const request = {
      sourceAccountId: 'cash',
      destinationAccountId: 'savings',
      amount: 80,
      currency: 'COP',
      trmApplied: 1,
      date: '2026-08-02',
      isSaving: true,
    };
    await firstValueFrom(movements.createTransfer(request, 'saving-1'));
    await firstValueFrom(movements.createTransfer(request, 'saving-1'));
    await expect(firstValueFrom(movements.createTransfer({ ...request, amount: 81 }, 'saving-1'))).rejects.toThrow(
      'idempotency_key_conflict',
    );
    const rows = (await local.list<MovementResponse>('movement')).filter((item) => item.operationId === 'saving-1');
    expect(rows).toHaveLength(2);
    expect(rows.every((item) => item.operationType === 'Saving')).toBe(true);
  });

  it('records loan disbursement and payment with principal and interest', async () => {
    const loan = await firstValueFrom(
      loans.createLoan({
        description: 'Banco',
        principal: 1200,
        currency: 'COP',
        trmApplied: 1,
        interestRateAnnual: 12,
        termMonths: 12,
        startDate: '2026-08-01',
        accountId: 'cash',
      }),
    );
    const paid = await firstValueFrom(loans.payLoan(loan.id, 'cash', 0, 'loan-payment-1'));
    const replay = await firstValueFrom(loans.payLoan(loan.id, 'cash', 0, 'loan-payment-1'));
    await expect(firstValueFrom(loans.payLoan(loan.id, 'savings', 0, 'loan-payment-1'))).rejects.toThrow(
      'idempotency_key_conflict',
    );
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
    const purchase = await firstValueFrom(
      movements.createMovement({
        type: 'Expense',
        sourceType: 'CreditCard',
        accountId: 'card',
        amount: 300,
        currency: 'COP',
        trmApplied: 1,
        date: '2026-08-01',
        description: 'Equipo',
        loanInstallments: 3,
        loanInterestRate: 2,
      }),
    );
    const first = await firstValueFrom(installments.payInstallment(purchase.installmentPurchaseId!, 'cash', 'quota-1'));
    const replay = await firstValueFrom(
      installments.payInstallment(purchase.installmentPurchaseId!, 'cash', 'quota-1'),
    );
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

  describe('installment payment key', () => {
    it('identifies the installment being paid, not the moment of the click', () => {
      expect(installmentPaymentKey({ id: 'plan-a', paidCount: 0 })).toBe('plan-a:installment:1');
      expect(installmentPaymentKey({ id: 'plan-a', paidCount: 2 })).toBe('plan-a:installment:3');

      expect(installmentPaymentKey({ id: 'plan-a', paidCount: 0 })).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    });

    it('collapses a double click into a single charge', async () => {
      const purchase = await firstValueFrom(
        movements.createMovement({
          type: 'Expense',
          sourceType: 'CreditCard',
          accountId: 'card',
          amount: 300,
          currency: 'COP',
          trmApplied: 1,
          date: '2026-08-01',
          description: 'Equipo',
          loanInstallments: 3,
        }),
      );
      const plan = (await local.list<InstallmentResponse>('installmentpurchase'))[0];

      const key = installmentPaymentKey(plan);
      await firstValueFrom(installments.payInstallment(plan.id, 'cash', key));
      const second = await firstValueFrom(installments.payInstallment(plan.id, 'cash', key));

      expect(second.paidCount).toBe(1);
      const charges = (await local.list<MovementResponse>('movement')).filter(
        (item) => item.operationType === 'CreditPayment' && item.installmentPurchaseId === plan.id,
      );
      expect(charges).toHaveLength(2);
      expect(purchase.installmentPurchaseId).toBe(plan.id);
    });
  });

  describe('cross-currency operations are rejected instead of guessed', () => {
    it('rejects a transfer between accounts in different currencies', async () => {
      await expect(
        firstValueFrom(
          movements.createTransfer(
            {
              sourceAccountId: 'cash',
              destinationAccountId: 'usd',
              amount: 10,
              currency: 'COP',
              trmApplied: 1,
              date: '2026-08-02',
              isSaving: false,
            },
            'cross-1',
          ),
        ),
      ).rejects.toThrow('cross_currency_transfer_requires_an_exchange_operation');
    });

    it('rejects a loan payment from an account in another currency', async () => {
      const loan = await firstValueFrom(
        loans.createLoan({
          description: 'Banco',
          principal: 1200,
          currency: 'COP',
          trmApplied: 1,
          interestRateAnnual: 12,
          termMonths: 12,
          startDate: '2026-08-01',
          accountId: 'cash',
        }),
      );
      await expect(firstValueFrom(loans.payLoan(loan.id, 'usd', 0, 'cross-loan-1'))).rejects.toThrow(
        'cross_currency_loan_payment_requires_an_exchange_operation',
      );
    });

    it('rejects an installment payment from an account in another currency', async () => {
      await firstValueFrom(
        movements.createMovement({
          type: 'Expense',
          sourceType: 'CreditCard',
          accountId: 'card',
          amount: 300,
          currency: 'COP',
          trmApplied: 1,
          date: '2026-08-01',
          description: 'Equipo',
          loanInstallments: 3,
        }),
      );
      const plan = (await local.list<InstallmentResponse>('installmentpurchase'))[0];
      await expect(firstValueFrom(installments.payInstallment(plan.id, 'usd', 'cross-quota-1'))).rejects.toThrow(
        'cross_currency_installment_payment_requires_an_exchange_operation',
      );
    });
  });

  describe('transfer guards', () => {
    const base = {
      sourceAccountId: 'cash',
      destinationAccountId: 'savings',
      amount: 50,
      currency: 'COP',
      trmApplied: 1,
      date: '2026-08-02',
      isSaving: false,
    };

    it('records an ordinary transfer as Transfer, not as income and expense', async () => {
      await firstValueFrom(movements.createTransfer(base, 'transfer-1'));
      const legs = (await local.list<MovementResponse>('movement')).filter((item) => item.operationId === 'transfer-1');
      expect(legs).toHaveLength(2);
      expect(legs.every((item) => item.operationType === 'Transfer')).toBe(true);
      expect(legs.filter((item) => item.type === 'Expense')).toHaveLength(1);
      expect(legs.filter((item) => item.type === 'Income')).toHaveLength(1);
    });

    it.each([
      [{ amount: 0 }, 'transfer_amount_must_be_positive'],
      [{ amount: -5 }, 'transfer_amount_must_be_positive'],
      [{ trmApplied: 0 }, 'transfer_trm_must_be_positive'],
      [{ destinationAccountId: 'cash' }, 'transfer_accounts_must_be_different'],
      [{ destinationAccountId: 'missing' }, 'transfer_account_not_found'],
      [{ destinationAccountId: 'closed' }, 'transfer_account_is_inactive'],
      [{ sourceAccountId: 'card' }, 'transfer_source_must_be_cash_or_debit'],
      [{ destinationAccountId: 'card' }, 'use_card_payment_for_credit_accounts'],
    ])('rejects %o', async (patch, message) => {
      await expect(firstValueFrom(movements.createTransfer({ ...base, ...patch }, 'guard-1'))).rejects.toThrow(
        message as string,
      );
    });

    it('demands a valid idempotency key', async () => {
      await expect(firstValueFrom(movements.createTransfer(base, ''))).rejects.toThrow('invalid_idempotency_key');
    });
  });

  describe('credit card payment', () => {
    it('moves the debt with both legs and marks them as CreditPayment', async () => {
      await firstValueFrom(
        movements.createCreditCardPayment(
          {
            sourceAccountId: 'cash',
            creditAccountId: 'card',
            amount: 120,
            currency: 'COP',
            trmApplied: 1,
            date: '2026-08-10',
            description: 'Pago tarjeta',
          },
          'card-payment-1',
        ),
      );

      const legs = (await local.list<MovementResponse>('movement')).filter(
        (item) => item.operationId === 'card-payment-1',
      );
      expect(legs).toHaveLength(2);
      expect(legs.every((item) => item.operationType === 'CreditPayment')).toBe(true);
      expect(legs.find((item) => item.accountId === 'cash')?.type).toBe('Expense');
      expect(legs.find((item) => item.accountId === 'card')?.type).toBe('Income');
    });

    it('refuses a destination that is not a credit account', async () => {
      await expect(
        firstValueFrom(
          movements.createCreditCardPayment(
            {
              sourceAccountId: 'cash',
              creditAccountId: 'savings',
              amount: 120,
              currency: 'COP',
              trmApplied: 1,
              date: '2026-08-10',
              description: 'Pago tarjeta',
            },
            'card-payment-2',
          ),
        ),
      ).rejects.toThrow('card_payment_requires_a_credit_destination');
    });

    it('replays without duplicating and rejects a conflicting reuse of the key', async () => {
      const request = {
        sourceAccountId: 'cash',
        creditAccountId: 'card',
        amount: 120,
        currency: 'COP',
        trmApplied: 1,
        date: '2026-08-10',
        description: 'Pago tarjeta',
      };
      await firstValueFrom(movements.createCreditCardPayment(request, 'card-payment-3'));
      await firstValueFrom(movements.createCreditCardPayment(request, 'card-payment-3'));
      await expect(
        firstValueFrom(movements.createCreditCardPayment({ ...request, amount: 121 }, 'card-payment-3')),
      ).rejects.toThrow('idempotency_key_conflict');
      const legs = (await local.list<MovementResponse>('movement')).filter(
        (item) => item.operationId === 'card-payment-3',
      );
      expect(legs).toHaveLength(2);
    });
  });

  describe('linked operations cannot be broken from a single leg', () => {
    it('refuses to edit one leg of a transfer', async () => {
      await firstValueFrom(
        movements.createTransfer(
          {
            sourceAccountId: 'cash',
            destinationAccountId: 'savings',
            amount: 50,
            currency: 'COP',
            trmApplied: 1,
            date: '2026-08-02',
            isSaving: false,
          },
          'edit-guard-1',
        ),
      );
      const leg = (await local.list<MovementResponse>('movement')).find((item) => item.operationId === 'edit-guard-1')!;
      await expect(
        firstValueFrom(
          movements.updateMovement(leg.id, {
            type: 'Expense',
            sourceType: 'OwnAccount',
            accountId: 'cash',
            amount: 99,
            currency: 'COP',
            trmApplied: 1,
            date: '2026-08-02',
          }),
        ),
      ).rejects.toThrow('linked_financial_operation_cannot_be_edited');
    });

    it('deletes both legs when one is removed', async () => {
      await firstValueFrom(
        movements.createTransfer(
          {
            sourceAccountId: 'cash',
            destinationAccountId: 'savings',
            amount: 50,
            currency: 'COP',
            trmApplied: 1,
            date: '2026-08-02',
            isSaving: false,
          },
          'delete-cascade-1',
        ),
      );
      const leg = (await local.list<MovementResponse>('movement')).find(
        (item) => item.operationId === 'delete-cascade-1',
      )!;

      await firstValueFrom(movements.deleteMovement(leg.id));

      const left = (await local.list<MovementResponse>('movement')).filter(
        (item) => item.operationId === 'delete-cascade-1',
      );
      expect(left).toHaveLength(0);
    });

    it('refuses to delete a loan movement from the movements list', async () => {
      const loan = await firstValueFrom(
        loans.createLoan({
          description: 'Banco',
          principal: 1200,
          currency: 'COP',
          trmApplied: 1,
          interestRateAnnual: 12,
          termMonths: 12,
          startDate: '2026-08-01',
          accountId: 'cash',
        }),
      );
      const disbursement = (await local.list<MovementResponse>('movement')).find(
        (item) => item.loanId === loan.id && item.operationType === 'LoanDisbursement',
      )!;
      await expect(firstValueFrom(movements.deleteMovement(disbursement.id))).rejects.toThrow(
        'loan_movements_must_be_changed_from_the_loan',
      );
    });

    it('refuses to delete an installment purchase that already has payments', async () => {
      const purchase = await firstValueFrom(
        movements.createMovement({
          type: 'Expense',
          sourceType: 'CreditCard',
          accountId: 'card',
          amount: 300,
          currency: 'COP',
          trmApplied: 1,
          date: '2026-08-01',
          description: 'Equipo',
          loanInstallments: 3,
        }),
      );
      const plan = (await local.list<InstallmentResponse>('installmentpurchase'))[0];
      await firstValueFrom(installments.payInstallment(plan.id, 'cash', installmentPaymentKey(plan)));

      await expect(firstValueFrom(movements.deleteMovement(purchase.id))).rejects.toThrow(
        'paid_installment_purchase_cannot_be_deleted',
      );
    });

    it('refuses to change the financial terms of a loan that is already being paid', async () => {
      const loan = await firstValueFrom(
        loans.createLoan({
          description: 'Banco',
          principal: 1200,
          currency: 'COP',
          trmApplied: 1,
          interestRateAnnual: 12,
          termMonths: 12,
          startDate: '2026-08-01',
          accountId: 'cash',
        }),
      );
      await firstValueFrom(loans.payLoan(loan.id, 'cash', 0, 'loan-lock-1'));

      await expect(
        firstValueFrom(
          loans.updateLoan(loan.id, {
            description: 'Banco',
            principal: 2400,
            currency: 'COP',
            trmApplied: 1,
            interestRateAnnual: 12,
            termMonths: 12,
            startDate: '2026-08-01',
            accountId: 'cash',
          }),
        ),
      ).rejects.toThrow('paid_loan_financial_terms_are_locked');

      await expect(firstValueFrom(loans.deleteLoan(loan.id))).rejects.toThrow('paid_loan_cannot_be_deleted');
    });
  });
});
