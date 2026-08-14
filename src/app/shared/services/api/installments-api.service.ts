import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, from } from 'rxjs';
import type { AccountResponse } from '../../models/account.model';
import type { MovementResponse } from '../../models/movement.model';
import type { InstallmentResponse, InstallmentRequest } from '../../models/installment.model';
import { roundMoney } from '../../utils/amortization';
import { LocalDataRepository, type LocalBatchOperation } from '../local/local-data.repository';
import { MovementsApiService } from './movements-api.service';

/**
 * Clave estable del pago de una cuota. Pagar la cuota N de una compra es **una
 * sola** operación: si el usuario hace doble clic o reintenta, la segunda
 * llamada trae la misma clave y `pay()` la reconoce como reintento en vez de
 * cobrar otra vez. Generarla con `randomUUID()` en el click anulaba por
 * completo esa protección.
 *
 * Si el llamador trae un `paidCount` desactualizado, la clave choca con un pago
 * ya registrado y la operación se rechaza como duplicada — que es el fallo
 * correcto.
 */
export function installmentPaymentKey(purchase: Pick<InstallmentResponse, 'id' | 'paidCount'>): string {
  return `${purchase.id}:installment:${purchase.paidCount + 1}`;
}

@Injectable({ providedIn: 'root' })
export class InstallmentsApiService {
  private local = inject(LocalDataRepository);
  private movementsApi = inject(MovementsApiService);

  getInstallments(): Observable<InstallmentResponse[]> {
    return from(this.local.list<InstallmentResponse>('installmentpurchase'));
  }

  createInstallment(req: InstallmentRequest): Observable<InstallmentResponse> {
    return from(this.create(req));
  }

  updateInstallmentPaid(id: string, paidCount: number): Observable<InstallmentResponse> {
    return from(this.rejectManualProgress(id, paidCount));
  }

  payInstallment(
    id: string,
    sourceAccountId: string,
    idempotencyKey: string,
  ): Observable<InstallmentResponse> {
    return from(this.pay(id, sourceAccountId, idempotencyKey));
  }

  deleteInstallment(id: string): Observable<void> {
    return from(this.remove(id));
  }

  private async create(req: InstallmentRequest): Promise<InstallmentResponse> {
    if (!req.accountId) throw new Error('installment_credit_account_is_required');
    if (!Number.isInteger(req.installmentsCount) || req.installmentsCount < 2 || req.installmentsCount > 120) {
      throw new Error('installment_count_is_invalid');
    }
    if ((req.paidCount ?? 0) !== 0) throw new Error('new_installment_purchase_cannot_start_as_paid');
    const movement = await firstValueFrom(
      this.movementsApi.createMovement({
        type: 'Expense',
        sourceType: 'CreditCard',
        amount: req.totalAmount,
        currency: req.currency,
        trmApplied: req.trmApplied ?? 1,
        date: req.startDate,
        description: req.description,
        accountId: req.accountId,
        loanInstallments: req.installmentsCount,
      }),
    );
    if (!movement.installmentPurchaseId) throw new Error('installment_projection_was_not_created');
    return this.required(movement.installmentPurchaseId);
  }

  private async pay(
    id: string,
    sourceAccountId: string,
    idempotencyKey: string,
  ): Promise<InstallmentResponse> {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey)) throw new Error('invalid_idempotency_key');
    const item = await this.required(id);
    if (!item.accountId) throw new Error('installment_credit_account_is_missing');
    const existing = (await this.local.list<MovementResponse>('movement')).filter(
      (movement) => movement.operationId === idempotencyKey,
    );
    if (existing.length > 0) {
      const sourceLeg = existing.find(
        (movement) => movement.operationType === 'CreditPayment'
          && movement.type === 'Expense'
          && movement.accountId === sourceAccountId,
      );
      const destinationLeg = existing.find(
        (movement) => movement.operationType === 'CreditPayment'
          && movement.type === 'Income'
          && movement.accountId === item.accountId,
      );
      const belongsToPlan = existing.every((movement) => movement.installmentPurchaseId === id);
      if (belongsToPlan && sourceLeg && destinationLeg && existing.length <= 3) return item;
      throw new Error('idempotency_key_conflict');
    }
    const [source, credit] = await Promise.all([
      this.local.get<AccountResponse>('account', sourceAccountId),
      this.local.get<AccountResponse>('account', item.accountId),
    ]);
    if (!source || !credit) throw new Error('installment_payment_account_not_found');
    if (!source.isActive || source.type === 'Credit') throw new Error('installment_payment_requires_an_active_cash_or_debit_account');
    if (!credit.isActive || credit.type !== 'Credit') throw new Error('installment_purchase_credit_account_is_invalid');
    if (source.currency.toUpperCase() !== item.currency.toUpperCase() || credit.currency.toUpperCase() !== item.currency.toUpperCase()) {
      throw new Error('cross_currency_installment_payment_requires_an_exchange_operation');
    }

    if (!item.isActive || item.paidCount >= item.installmentsCount) throw new Error('installment_purchase_is_already_paid');

    const installmentNumber = item.paidCount + 1;
    const principalComponent = roundMoney(
      installmentNumber === item.installmentsCount ? item.remainingAmount : Math.min(item.monthlyAmount, item.remainingAmount),
    );
    const interestComponent = roundMoney(principalComponent * ((item.interestRatePercent ?? 0) / 100));
    const totalPayment = roundMoney(principalComponent + interestComponent);
    const now = new Date().toISOString();
    const updated: InstallmentResponse = {
      ...item,
      paidCount: installmentNumber,
      remainingAmount: roundMoney(Math.max(0, item.remainingAmount - principalComponent)),
      isActive: installmentNumber < item.installmentsCount,
    };
    const common = {
      currency: item.currency,
      trmApplied: item.trmApplied,
      date: now,
      categoryId: null,
      categoryName: null,
      categoryColor: null,
      categoryIcon: null,
      loanParty: null,
      loanInstallments: item.installmentsCount,
      loanInterestRate: item.interestRatePercent ?? 0,
      installmentPurchaseId: item.id,
      installmentNumber,
      operationId: idempotencyKey,
      createdAt: now,
    };
    const sourcePayment: MovementResponse = {
      ...common,
      id: `${idempotencyKey}:source`,
      type: 'Expense',
      subType: 'Expense',
      sourceType: 'OwnAccount',
      amount: totalPayment,
      amountBase: totalPayment * item.trmApplied,
      description: `Pago cuota ${installmentNumber}/${item.installmentsCount} · ${item.description}`,
      accountId: source.id,
      accountName: source.name,
      principalComponent,
      interestComponent,
      operationType: 'CreditPayment',
    };
    const creditPayment: MovementResponse = {
      ...sourcePayment,
      id: `${idempotencyKey}:destination`,
      type: 'Income',
      subType: 'Income',
      sourceType: 'CreditCard',
      accountId: credit.id,
      accountName: credit.name,
    };
    const operations: LocalBatchOperation[] = [
      { action: 'put', kind: 'installmentpurchase', value: updated, operation: 'installment-payment' },
      { action: 'put', kind: 'movement', value: sourcePayment, operation: 'installment-payment' },
      { action: 'put', kind: 'movement', value: creditPayment, operation: 'installment-payment' },
    ];
    if (interestComponent > 0) {
      const interestCharge: MovementResponse = {
        ...common,
        id: `${idempotencyKey}:interest`,
        type: 'Expense',
        subType: 'Expense',
        sourceType: 'CreditCard',
        amount: interestComponent,
        amountBase: interestComponent * item.trmApplied,
        description: `Interés cuota ${installmentNumber}/${item.installmentsCount} · ${item.description}`,
        accountId: credit.id,
        accountName: credit.name,
        principalComponent: 0,
        interestComponent,
        operationType: 'CreditInterest',
      };
      operations.push({ action: 'put', kind: 'movement', value: interestCharge, operation: 'installment-payment' });
    }
    await this.local.batch(operations);
    return updated;
  }

  private async rejectManualProgress(id: string, paidCount: number): Promise<InstallmentResponse> {
    const item = await this.required(id);
    if (paidCount !== item.paidCount) throw new Error('installment_progress_is_derived_from_payment_movements');
    return item;
  }

  private async remove(id: string): Promise<void> {
    const item = await this.local.get<InstallmentResponse>('installmentpurchase', id);
    if (!item) return;
    if (item.paidCount > 0) throw new Error('paid_installment_purchase_cannot_be_deleted');
    if (item.purchaseMovementId) {
      await firstValueFrom(this.movementsApi.deleteMovement(item.purchaseMovementId));
      return;
    }
    await this.local.remove('installmentpurchase', id);
  }

  private async required(id: string): Promise<InstallmentResponse> {
    const item = await this.local.get<InstallmentResponse>('installmentpurchase', id);
    if (!item) throw new Error('installment_not_found');
    return item;
  }
}
