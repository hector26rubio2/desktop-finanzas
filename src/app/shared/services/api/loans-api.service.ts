import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import type { AccountResponse } from '../../models/account.model';
import type { MovementResponse } from '../../models/movement.model';
import type { LoanResponse, LoanRequest, LoanAmortizationRow } from '../../models/loan.model';
import { buildAmortization } from '../../utils/amortization';
import { LocalDataRepository, type LocalBatchOperation } from '../local/local-data.repository';

@Injectable({ providedIn: 'root' })
export class LoansApiService {
  private local = inject(LocalDataRepository);

  getLoans(): Observable<LoanResponse[]> {
    return from(this.local.list<LoanResponse>('loan'));
  }

  getSchedule(id: string): Observable<LoanAmortizationRow[]> {
    return from(this.schedule(id));
  }

  createLoan(req: LoanRequest): Observable<LoanResponse> {
    return from(this.create(req));
  }

  updateLoan(id: string, req: LoanRequest): Observable<LoanResponse> {
    return from(this.update(id, req));
  }

  payLoan(
    id: string,
    sourceAccountId: string,
    extraPrincipal: number,
    idempotencyKey: string,
  ): Observable<LoanResponse> {
    return from(this.pay(id, sourceAccountId, extraPrincipal, idempotencyKey));
  }

  deleteLoan(id: string): Observable<void> {
    return from(this.remove(id));
  }

  private async create(req: LoanRequest): Promise<LoanResponse> {
    const account = await this.validate(req);
    const loan = this.document(req);
    const disbursement = this.disbursement(loan, account);
    await this.local.batch([
      { action: 'put', kind: 'loan', value: loan, operation: 'loan-create' },
      { action: 'put', kind: 'movement', value: disbursement, operation: 'loan-create' },
    ]);
    return loan;
  }

  private async schedule(id: string): Promise<LoanAmortizationRow[]> {
    const loan = await this.required(id);
    if (loan.outstandingPrincipal <= 0 || loan.remainingMonths <= 0) return [];
    return buildAmortization(
      loan.outstandingPrincipal,
      loan.interestRateAnnual,
      loan.remainingMonths,
      loan.startDate,
      loan.loanType,
    ).map((row) => ({
      number: loan.paidMonths + row.month,
      payment: row.payment,
      interest: row.interest,
      principal: row.principal,
      balance: row.balance,
    }));
  }

  private async update(id: string, req: LoanRequest): Promise<LoanResponse> {
    const current = await this.required(id);
    const account = await this.validate(req);
    if (current.paidMonths > 0 && this.financialTermsChanged(current, req)) {
      throw new Error('paid_loan_financial_terms_are_locked');
    }
    const updated: LoanResponse = {
      ...this.document(req, id),
      createdAt: current.createdAt,
      paidMonths: current.paidMonths,
      paidPrincipal: current.paidPrincipal,
      outstandingPrincipal: Math.max(0, req.principal - current.paidPrincipal),
      remainingMonths: Math.max(0, req.termMonths - current.paidMonths),
      isActive: req.principal > current.paidPrincipal,
    };
    const operations: LocalBatchOperation[] = [
      { action: 'put', kind: 'loan', value: updated, operation: 'loan-update' },
    ];
    if (current.paidMonths === 0) {
      const movement = (await this.local.list<MovementResponse>('movement')).find(
        (item) => item.loanId === id && item.operationType === 'LoanDisbursement',
      );
      operations.push({
        action: 'put',
        kind: 'movement',
        value: this.disbursement(updated, account, movement?.id, movement?.createdAt),
        operation: 'loan-update',
      });
    }
    await this.local.batch(operations);
    return updated;
  }

  private async pay(
    id: string,
    sourceAccountId: string,
    extraPrincipal: number,
    idempotencyKey: string,
  ): Promise<LoanResponse> {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey)) throw new Error('invalid_idempotency_key');
    const loan = await this.required(id);
    const existing = (await this.local.list<MovementResponse>('movement')).filter(
      (movement) => movement.operationId === idempotencyKey,
    );
    if (existing.length > 0) {
      if (
        existing.length === 1 &&
        existing[0].operationType === 'LoanPayment' &&
        existing[0].loanId === id &&
        existing[0].accountId === sourceAccountId
      ) {
        return loan;
      }
      throw new Error('idempotency_key_conflict');
    }
    if (!loan.isActive || loan.outstandingPrincipal <= 0 || loan.remainingMonths <= 0) {
      throw new Error('loan_is_already_paid');
    }
    if (!Number.isFinite(extraPrincipal) || extraPrincipal < 0) throw new Error('extra_principal_is_invalid');
    const account = await this.local.get<AccountResponse>('account', sourceAccountId);
    if (!account) throw new Error('loan_payment_account_not_found');
    if (!account.isActive || account.type === 'Credit')
      throw new Error('loan_payment_requires_an_active_cash_or_debit_account');
    if (account.currency.toUpperCase() !== loan.currency.toUpperCase()) {
      throw new Error('cross_currency_loan_payment_requires_an_exchange_operation');
    }
    const row = buildAmortization(
      loan.outstandingPrincipal,
      loan.interestRateAnnual,
      loan.remainingMonths,
      loan.startDate,
      loan.loanType,
    )[0];
    const principalComponent = Math.min(loan.outstandingPrincipal, row.principal + extraPrincipal);
    const interestComponent = row.interest;
    const amount = principalComponent + interestComponent;
    const paidPrincipal = loan.paidPrincipal + principalComponent;
    const outstandingPrincipal = Math.max(0, loan.principal - paidPrincipal);
    const updated: LoanResponse = {
      ...loan,
      paidMonths: loan.paidMonths + 1,
      paidPrincipal,
      outstandingPrincipal,
      remainingMonths: Math.max(0, loan.remainingMonths - 1),
      isActive: outstandingPrincipal > 0,
    };
    const installmentNumber = loan.paidMonths + 1;
    const operationId = idempotencyKey;
    const movement: MovementResponse = {
      id: `${operationId}:source`,
      type: 'Expense',
      subType: 'Expense',
      sourceType: 'Loan',
      loanParty: loan.party,
      loanInstallments: loan.termMonths,
      loanInterestRate: loan.interestRateAnnual,
      amount,
      currency: loan.currency,
      trmApplied: loan.trmApplied,
      amountBase: amount * loan.trmApplied,
      date: new Date().toISOString(),
      description: `Cuota ${installmentNumber}/${loan.termMonths} · ${loan.description}`,
      categoryId: null,
      categoryName: null,
      categoryColor: null,
      categoryIcon: null,
      accountId: account.id,
      accountName: account.name,
      installmentPurchaseId: null,
      loanId: loan.id,
      principalComponent,
      interestComponent,
      installmentNumber,
      operationId,
      operationType: 'LoanPayment',
      createdAt: new Date().toISOString(),
    };
    await this.local.batch([
      { action: 'put', kind: 'loan', value: updated, operation: 'loan-payment' },
      { action: 'put', kind: 'movement', value: movement, operation: 'loan-payment' },
    ]);
    return updated;
  }

  private async remove(id: string): Promise<void> {
    const loan = await this.local.get<LoanResponse>('loan', id);
    if (!loan) return;
    const related = (await this.local.list<MovementResponse>('movement')).filter((item) => item.loanId === id);
    if (related.some((item) => item.operationType === 'LoanPayment')) throw new Error('paid_loan_cannot_be_deleted');
    await this.local.batch([
      { action: 'remove', kind: 'loan', id, operation: 'loan-remove' },
      ...related.map((item) => ({
        action: 'remove' as const,
        kind: 'movement' as const,
        id: item.id,
        operation: 'loan-remove',
      })),
    ]);
  }

  private async validate(req: LoanRequest): Promise<AccountResponse> {
    if (!Number.isFinite(req.principal) || req.principal <= 0) throw new Error('loan_principal_must_be_positive');
    if (!Number.isFinite(req.trmApplied ?? 1) || (req.trmApplied ?? 1) <= 0)
      throw new Error('loan_trm_must_be_positive');
    if (!Number.isFinite(req.interestRateAnnual) || req.interestRateAnnual < 0)
      throw new Error('loan_interest_is_invalid');
    if (!Number.isInteger(req.termMonths) || req.termMonths <= 0 || req.termMonths > 600)
      throw new Error('loan_term_is_invalid');
    if (!req.accountId) throw new Error('loan_destination_account_is_required');
    const account = await this.local.get<AccountResponse>('account', req.accountId);
    if (!account) throw new Error('loan_destination_account_not_found');
    if (!account.isActive || account.type === 'Credit')
      throw new Error('loan_destination_requires_an_active_cash_or_debit_account');
    if (account.currency.toUpperCase() !== req.currency.toUpperCase())
      throw new Error('loan_account_currency_mismatch');
    return account;
  }

  private async required(id: string): Promise<LoanResponse> {
    const loan = await this.local.get<LoanResponse>('loan', id);
    if (!loan) throw new Error('loan_not_found');
    return loan;
  }

  private document(req: LoanRequest, id: string = globalThis.crypto.randomUUID()): LoanResponse {
    return {
      id,
      userId: '',
      ...req,
      currency: req.currency.toUpperCase(),
      party: req.party ?? null,
      trmApplied: req.trmApplied ?? 1,
      loanType: req.loanType ?? 'French',
      accountId: req.accountId ?? null,
      isActive: true,
      paidMonths: 0,
      remainingMonths: req.termMonths,
      paidPrincipal: 0,
      outstandingPrincipal: req.principal,
      createdAt: new Date().toISOString(),
    };
  }

  private disbursement(
    loan: LoanResponse,
    account: AccountResponse,
    id = `${loan.id}:disbursement`,
    createdAt = new Date().toISOString(),
  ): MovementResponse {
    return {
      id,
      type: 'Income',
      subType: 'LoanReceived',
      sourceType: 'Loan',
      loanParty: loan.party,
      loanInstallments: loan.termMonths,
      loanInterestRate: loan.interestRateAnnual,
      amount: loan.principal,
      currency: loan.currency,
      trmApplied: loan.trmApplied,
      amountBase: loan.principal * loan.trmApplied,
      date: loan.startDate,
      description: `Desembolso · ${loan.description}`,
      categoryId: null,
      categoryName: null,
      categoryColor: null,
      categoryIcon: null,
      accountId: account.id,
      accountName: account.name,
      installmentPurchaseId: null,
      loanId: loan.id,
      principalComponent: loan.principal,
      interestComponent: 0,
      installmentNumber: 0,
      operationId: loan.id,
      operationType: 'LoanDisbursement',
      createdAt,
    };
  }

  private financialTermsChanged(current: LoanResponse, req: LoanRequest): boolean {
    return (
      current.principal !== req.principal ||
      current.currency !== req.currency.toUpperCase() ||
      current.trmApplied !== (req.trmApplied ?? 1) ||
      current.interestRateAnnual !== req.interestRateAnnual ||
      current.termMonths !== req.termMonths ||
      current.startDate !== req.startDate ||
      current.loanType !== (req.loanType ?? 'French') ||
      current.accountId !== (req.accountId ?? null)
    );
  }
}
