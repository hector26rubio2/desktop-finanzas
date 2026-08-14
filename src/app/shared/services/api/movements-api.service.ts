import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { LocalDataRepository, type LocalBatchOperation } from '../local/local-data.repository';
import type { AccountResponse } from '../../models/account.model';
import type { CategoryResponse } from '../../models/category.model';
import type { InstallmentResponse } from '../../models/installment.model';
import type {
  MovementResponse,
  MovementRequest,
  MovementSummary,
  PagedResult,
  TransferRequest,
  TransferResponse,
  CreditCardPaymentRequest,
} from '../../models/movement.model';

type References = { account: AccountResponse | null; category: CategoryResponse | null };

@Injectable({ providedIn: 'root' })
export class MovementsApiService {
  private local = inject(LocalDataRepository);

  getMovements(
    yearMonth: string,
    page = 1,
    pageSize = 20,
    filters?: {
      currency?: string;
      categoryId?: string;
      accountId?: string;
      type?: 'Income' | 'Expense';
      portfolioEntityId?: string;
      portfolioType?: string;
    },
  ): Observable<PagedResult<MovementResponse>> {
    const [year, month] = yearMonth.split('-').map(Number);
    return from(this.page({ year, month, page, pageSize, ...filters }));
  }

  getMovementSummary(yearMonth: string): Observable<MovementSummary> {
    const [year, month] = yearMonth.split('-').map(Number);
    return from(this.local.summary<MovementSummary>(year, month));
  }

  createMovement(req: MovementRequest): Observable<MovementResponse> {
    return from(this.create(req));
  }

  createTransfer(req: TransferRequest, idempotencyKey: string): Observable<TransferResponse> {
    return from(this.localTransfer(req, false, idempotencyKey));
  }

  createCreditCardPayment(
    req: CreditCardPaymentRequest,
    idempotencyKey: string,
  ): Observable<TransferResponse> {
    return from(
      this.localTransfer(
        {
          sourceAccountId: req.sourceAccountId,
          destinationAccountId: req.creditAccountId,
          amount: req.amount,
          currency: req.currency,
          trmApplied: req.trmApplied,
          date: req.date,
          description: req.description,
          isSaving: false,
        },
        true,
        idempotencyKey,
      ),
    );
  }

  deleteMovement(id: string): Observable<void> {
    return from(this.remove(id));
  }

  updateMovement(id: string, req: MovementRequest): Observable<MovementResponse> {
    return from(this.update(id, req));
  }

  private async page(query: Record<string, unknown>): Promise<PagedResult<MovementResponse>> {
    const result = await this.local.movements<PagedResult<MovementResponse>>(query);
    const [accounts, categories] = await Promise.all([
      this.local.list<AccountResponse>('account'),
      this.local.list<CategoryResponse>('category'),
    ]);
    const accountMap = new Map(accounts.map((item) => [item.id, item]));
    const categoryMap = new Map(categories.map((item) => [item.id, item]));
    return {
      ...result,
      items: result.items.map((item) => {
        const account = item.accountId ? accountMap.get(item.accountId) : null;
        const category = item.categoryId ? categoryMap.get(item.categoryId) : null;
        return {
          ...item,
          accountName: account?.name ?? null,
          categoryName: category?.name ?? null,
          categoryColor: category?.color ?? null,
          categoryIcon: category?.icon ?? null,
        };
      }),
    };
  }

  private async create(req: MovementRequest): Promise<MovementResponse> {
    const refs = await this.validate(req);
    const movementId = globalThis.crypto.randomUUID();
    const installmentId = this.isInstallment(req) ? globalThis.crypto.randomUUID() : null;
    const movement = this.localMovement(req, movementId, refs, installmentId);
    if (!installmentId || !refs.account) return this.local.put('movement', movement, 'create');

    const installment = this.installmentProjection(req, movement, refs.account, installmentId, 0);
    await this.local.batch([
      { action: 'put', kind: 'movement', value: movement, operation: 'installment-purchase-create' },
      { action: 'put', kind: 'installmentpurchase', value: installment, operation: 'installment-purchase-create' },
    ]);
    return movement;
  }

  private async update(id: string, req: MovementRequest): Promise<MovementResponse> {
    const existing = await this.local.get<MovementResponse>('movement', id);
    if (!existing) throw new Error('movement_not_found');
    if (existing.operationType && ['Transfer', 'CreditPayment', 'LoanDisbursement', 'LoanPayment'].includes(existing.operationType)) {
      throw new Error('linked_financial_operation_cannot_be_edited');
    }
    const refs = await this.validate(req);
    const oldProjection = existing.installmentPurchaseId
      ? await this.local.get<InstallmentResponse>('installmentpurchase', existing.installmentPurchaseId)
      : null;
    const wantsInstallment = this.isInstallment(req);
    if (oldProjection && oldProjection.paidCount > 0 && this.installmentTermsChanged(existing, req)) {
      throw new Error('paid_installment_terms_are_locked');
    }

    const installmentId = wantsInstallment
      ? (existing.installmentPurchaseId ?? globalThis.crypto.randomUUID())
      : null;
    const movement = {
      ...this.localMovement(req, id, refs, installmentId),
      createdAt: existing.createdAt,
    };
    const operations: LocalBatchOperation[] = [
      { action: 'put', kind: 'movement', value: movement, operation: 'movement-update' },
    ];
    if (wantsInstallment && refs.account && installmentId) {
      operations.push({
        action: 'put',
        kind: 'installmentpurchase',
        value: this.installmentProjection(req, movement, refs.account, installmentId, oldProjection?.paidCount ?? 0, oldProjection?.createdAt),
        operation: 'installment-purchase-update',
      });
    } else if (existing.installmentPurchaseId) {
      operations.push({
        action: 'remove',
        kind: 'installmentpurchase',
        id: existing.installmentPurchaseId,
        operation: 'installment-purchase-remove',
      });
    }
    await this.local.batch(operations);
    return movement;
  }

  private async remove(id: string): Promise<void> {
    const movement = await this.local.get<MovementResponse>('movement', id);
    if (!movement) return;
    if (movement.operationType === 'LoanDisbursement' || movement.operationType === 'LoanPayment') {
      throw new Error('loan_movements_must_be_changed_from_the_loan');
    }
    if (movement.installmentPurchaseId && (movement.operationType === 'CreditPayment' || movement.operationType === 'CreditInterest')) {
      throw new Error('installment_payments_cannot_be_deleted_individually');
    }
    if (movement.operationId && ['Transfer', 'CreditPayment', 'Saving'].includes(movement.operationType ?? '')) {
      const related = (await this.local.list<MovementResponse>('movement')).filter(
        (item) => item.operationId === movement.operationId,
      );
      await this.local.batch(
        related.map((item) => ({
          action: 'remove' as const,
          kind: 'movement' as const,
          id: item.id,
          operation: 'financial-operation-remove',
        })),
      );
      return;
    }
    if (movement.installmentPurchaseId) {
      const projection = await this.local.get<InstallmentResponse>('installmentpurchase', movement.installmentPurchaseId);
      if (projection && projection.paidCount > 0) throw new Error('paid_installment_purchase_cannot_be_deleted');
      await this.local.batch([
        { action: 'remove', kind: 'movement', id, operation: 'installment-purchase-remove' },
        { action: 'remove', kind: 'installmentpurchase', id: movement.installmentPurchaseId, operation: 'installment-purchase-remove' },
      ]);
      return;
    }
    await this.local.remove('movement', id);
  }

  private async validate(req: MovementRequest): Promise<References> {
    if (!Number.isFinite(req.amount) || req.amount <= 0) throw new Error('movement_amount_must_be_positive');
    if (!Number.isFinite(req.trmApplied) || req.trmApplied <= 0) throw new Error('movement_trm_must_be_positive');
    if (!/^[A-Za-z]{3}$/.test(req.currency)) throw new Error('movement_currency_is_invalid');
    if (!req.date || Number.isNaN(new Date(req.date).getTime())) throw new Error('movement_date_is_invalid');
    const [account, category] = await Promise.all([
      req.accountId ? this.local.get<AccountResponse>('account', req.accountId) : Promise.resolve(null),
      req.categoryId ? this.local.get<CategoryResponse>('category', req.categoryId) : Promise.resolve(null),
    ]);
    if (req.accountId && !account) throw new Error('movement_account_not_found');
    if (account && !account.isActive) throw new Error('movement_account_is_inactive');
    if (account && account.currency.toUpperCase() !== req.currency.toUpperCase()) throw new Error('movement_account_currency_mismatch');
    if (req.categoryId && !category) throw new Error('movement_category_not_found');
    if (category && category.type !== req.type) throw new Error('movement_category_type_mismatch');
    if (req.sourceType === 'CreditCard' && (req.type !== 'Expense' || account?.type !== 'Credit')) {
      throw new Error('credit_purchase_requires_a_credit_account');
    }
    if (this.isInstallment(req) && (!Number.isInteger(req.loanInstallments) || (req.loanInstallments ?? 0) > 120)) {
      throw new Error('installment_count_is_invalid');
    }
    if ((req.loanInterestRate ?? 0) < 0) throw new Error('installment_interest_is_invalid');
    return { account, category };
  }

  private localMovement(
    req: MovementRequest,
    id: string,
    refs: References,
    installmentPurchaseId: string | null,
  ): MovementResponse {
    const now = new Date().toISOString();
    const creditPurchase = req.sourceType === 'CreditCard' && req.type === 'Expense';
    return {
      id,
      type: req.type,
      subType: (req.subType as MovementResponse['subType']) ?? null,
      sourceType: (req.sourceType as MovementResponse['sourceType']) ?? null,
      loanParty: req.loanParty ?? null,
      loanInstallments: req.loanInstallments ?? null,
      loanInterestRate: req.loanInterestRate ?? refs.account?.interestRate ?? null,
      amount: req.amount,
      currency: req.currency.toUpperCase(),
      trmApplied: req.trmApplied,
      amountBase: req.amount * req.trmApplied,
      date: req.date,
      description: req.description ?? null,
      categoryId: req.categoryId ?? null,
      categoryName: refs.category?.name ?? null,
      categoryColor: refs.category?.color ?? null,
      categoryIcon: refs.category?.icon ?? null,
      accountId: req.accountId ?? null,
      accountName: refs.account?.name ?? null,
      installmentPurchaseId,
      operationId: installmentPurchaseId,
      operationType: creditPurchase ? 'CreditPurchase' : null,
      createdAt: now,
    };
  }

  private installmentProjection(
    req: MovementRequest,
    movement: MovementResponse,
    account: AccountResponse,
    id: string,
    paidCount: number,
    createdAt = new Date().toISOString(),
  ): InstallmentResponse {
    const installmentsCount = req.loanInstallments!;
    const monthlyAmount = req.amount / installmentsCount;
    const count = Math.max(0, Math.min(installmentsCount, paidCount));
    return {
      id,
      userId: '',
      description: req.description ?? 'Compra en cuotas',
      accountId: account.id,
      purchaseMovementId: movement.id,
      totalAmount: req.amount,
      currency: req.currency.toUpperCase(),
      trmApplied: req.trmApplied,
      installmentsCount,
      paidCount: count,
      startDate: req.date.slice(0, 10),
      isActive: count < installmentsCount,
      monthlyAmount,
      interestRatePercent: req.loanInterestRate ?? account.interestRate ?? 0,
      remainingAmount: Math.max(0, req.amount - monthlyAmount * count),
      createdAt,
    };
  }

  private isInstallment(req: MovementRequest): boolean {
    return req.sourceType === 'CreditCard' && req.type === 'Expense' && (req.loanInstallments ?? 0) > 1;
  }

  private installmentTermsChanged(existing: MovementResponse, req: MovementRequest): boolean {
    return existing.amount !== req.amount
      || existing.currency !== req.currency.toUpperCase()
      || existing.trmApplied !== req.trmApplied
      || existing.accountId !== (req.accountId ?? null)
      || existing.loanInstallments !== (req.loanInstallments ?? null)
      || existing.loanInterestRate !== (req.loanInterestRate ?? null);
  }

  private async localTransfer(
    req: TransferRequest,
    cardPayment: boolean,
    idempotencyKey: string,
  ): Promise<TransferResponse> {
    this.assertIdempotencyKey(idempotencyKey);
    if (!Number.isFinite(req.amount) || req.amount <= 0) throw new Error('transfer_amount_must_be_positive');
    if (!Number.isFinite(req.trmApplied) || req.trmApplied <= 0) throw new Error('transfer_trm_must_be_positive');
    if (req.sourceAccountId === req.destinationAccountId) throw new Error('transfer_accounts_must_be_different');
    const [sourceAccount, destinationAccount] = await Promise.all([
      this.local.get<AccountResponse>('account', req.sourceAccountId),
      this.local.get<AccountResponse>('account', req.destinationAccountId),
    ]);
    if (!sourceAccount || !destinationAccount) throw new Error('transfer_account_not_found');
    if (!sourceAccount.isActive || !destinationAccount.isActive) throw new Error('transfer_account_is_inactive');
    if (sourceAccount.type === 'Credit') throw new Error('transfer_source_must_be_cash_or_debit');
    if (cardPayment ? destinationAccount.type !== 'Credit' : destinationAccount.type === 'Credit') {
      throw new Error(cardPayment ? 'card_payment_requires_a_credit_destination' : 'use_card_payment_for_credit_accounts');
    }
    const currency = req.currency.toUpperCase();
    if (sourceAccount.currency.toUpperCase() !== currency || destinationAccount.currency.toUpperCase() !== currency) {
      throw new Error('cross_currency_transfer_requires_an_exchange_operation');
    }

    const operationId = idempotencyKey;
    const existing = (await this.local.list<MovementResponse>('movement')).filter(
      (item) => item.operationId === operationId,
    );
    const sourceMovementId = `${operationId}:source`;
    const destinationMovementId = `${operationId}:destination`;

    const operationType: MovementResponse['operationType'] = cardPayment
      ? 'CreditPayment'
      : req.isSaving
        ? 'Saving'
        : 'Transfer';
    const now = new Date().toISOString();
    const common = {
      currency,
      trmApplied: req.trmApplied,
      amount: req.amount,
      amountBase: req.amount * req.trmApplied,
      date: req.date,
      description: req.description ?? null,
      categoryId: null,
      categoryName: null,
      categoryColor: null,
      categoryIcon: null,
      loanParty: null,
      loanInstallments: null,
      loanInterestRate: null,
      installmentPurchaseId: null,
      operationId,
      operationType,
      createdAt: now,
    };
    const source: MovementResponse = {
      ...common,
      id: sourceMovementId,
      type: 'Expense',
      subType: req.isSaving ? 'Saving' : 'Expense',
      sourceType: 'OwnAccount',
      accountId: req.sourceAccountId,
      accountName: sourceAccount.name,
    };
    const destination: MovementResponse = {
      ...common,
      id: destinationMovementId,
      type: 'Income',
      subType: req.isSaving ? 'Saving' : 'Income',
      sourceType: cardPayment ? 'CreditCard' : 'OwnAccount',
      accountId: req.destinationAccountId,
      accountName: destinationAccount.name,
    };
    if (existing.length > 0) {
      const persistedSource = existing.find((item) => item.id === sourceMovementId);
      const persistedDestination = existing.find((item) => item.id === destinationMovementId);
      if (
        existing.length === 2
        && persistedSource
        && persistedDestination
        && this.sameTransferLeg(persistedSource, source)
        && this.sameTransferLeg(persistedDestination, destination)
      ) {
        return this.transferResponse(req, operationId, sourceMovementId, destinationMovementId);
      }
      throw new Error('idempotency_key_conflict');
    }
    await this.local.putMany('movement', [source, destination], operationType ?? 'transfer');
    return this.transferResponse(req, operationId, sourceMovementId, destinationMovementId);
  }

  private transferResponse(
    req: TransferRequest,
    operationId: string,
    sourceMovementId: string,
    destinationMovementId: string,
  ): TransferResponse {
    return {
      operationId,
      sourceMovementId,
      destinationMovementId,
      sourceAccountId: req.sourceAccountId,
      destinationAccountId: req.destinationAccountId,
      amount: req.amount,
      currency: req.currency.toUpperCase(),
      amountBase: req.amount * req.trmApplied,
      date: req.date,
      isSaving: req.isSaving,
    };
  }

  private assertIdempotencyKey(value: string): void {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(value)) throw new Error('invalid_idempotency_key');
  }

  private sameTransferLeg(persisted: MovementResponse, expected: MovementResponse): boolean {
    return persisted.type === expected.type
      && persisted.accountId === expected.accountId
      && persisted.operationType === expected.operationType
      && persisted.amount === expected.amount
      && persisted.currency === expected.currency
      && persisted.trmApplied === expected.trmApplied
      && persisted.amountBase === expected.amountBase
      && persisted.date === expected.date
      && persisted.description === expected.description;
  }
}
