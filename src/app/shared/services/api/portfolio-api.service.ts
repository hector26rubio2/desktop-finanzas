import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import type { MovementResponse } from '../../models/movement.model';
import type {
  AddInvestmentTransactionRequest,
  AddPortfolioValuationRequest,
  CreateInvestmentRequest,
  InvestmentTransactionDocument,
  PortfolioEntityDocument,
  PortfolioOverview,
  PortfolioValuationDocument,
} from '../../models/portfolio.model';
import { roundMoney } from '../../utils/amortization';
import { TokenService } from '../auth/token.service';
import { LocalDataRepository } from '../local/local-data.repository';
import { FinancialApiService } from './financial-api.service';

@Injectable({ providedIn: 'root' })
export class PortfolioApiService {
  private financial = inject(FinancialApiService);
  private local = inject(LocalDataRepository);
  private token = inject(TokenService);

  getOverview(): Observable<PortfolioOverview> {
    return this.financial.getPortfolio();
  }

  getInvestments(): Observable<PortfolioEntityDocument[]> {
    return from(this.investments());
  }

  createInvestment(request: CreateInvestmentRequest): Observable<PortfolioEntityDocument> {
    return from(this.create(request));
  }

  addValuation(entityId: string, request: AddPortfolioValuationRequest): Observable<PortfolioValuationDocument> {
    return from(this.value(entityId, request));
  }

  addTransaction(
    entityId: string,
    request: AddInvestmentTransactionRequest,
  ): Observable<InvestmentTransactionDocument> {
    return from(this.transact(entityId, request));
  }

  private async investments(): Promise<PortfolioEntityDocument[]> {
    const entities = await this.local.list<PortfolioEntityDocument>('portfolioentity');
    return entities.filter((entity) => entity.isActive !== false && this.entityType(entity) === 'Investment');
  }

  private async create(request: CreateInvestmentRequest): Promise<PortfolioEntityDocument> {
    const name = request.name.trim();
    const currency = this.isoCurrency(request.currency);
    if (!name) throw new Error('investment_name_required');
    const now = new Date().toISOString();
    const entity: PortfolioEntityDocument = {
      id: globalThis.crypto.randomUUID(),
      userId: this.token.currentUser()?.id,
      kind: 'Asset',
      type: 'Investment',
      name,
      currency,
      institution: request.institution?.trim() || null,
      legacyAccountId: null,
      legacyLoanId: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    return this.local.put('portfolioentity', entity, 'create-investment');
  }

  private async value(
    entityId: string,
    request: AddPortfolioValuationRequest,
  ): Promise<PortfolioValuationDocument> {
    await this.requiredInvestment(entityId);
    const amount = this.positive(request.amount, 'valuation_amount_must_be_positive');
    const trmApplied = this.positive(request.trmApplied, 'valuation_trm_must_be_positive');
    const date = this.date(request.date);
    const currency = this.isoCurrency(request.currency);
    if (!['Manual', 'MarketPrice'].includes(request.source)) throw new Error('valuation_source_not_allowed');
    const now = new Date().toISOString();
    const valuation: PortfolioValuationDocument = {
      id: globalThis.crypto.randomUUID(),
      portfolioEntityId: entityId,
      date,
      amount,
      currency,
      trmApplied,
      amountBase: roundMoney(amount * trmApplied),
      source: request.source,
      externalReference: request.externalReference?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    return this.local.put('portfoliovaluation', valuation, 'add-portfolio-valuation');
  }

  private async transact(
    entityId: string,
    request: AddInvestmentTransactionRequest,
  ): Promise<InvestmentTransactionDocument> {
    await this.requiredInvestment(entityId);
    const movement = await this.local.get<MovementResponse>('movement', request.movementId);
    if (!movement) throw new Error('investment_movement_not_found');
    if (movement.portfolioEntityId && movement.portfolioEntityId !== entityId)
      throw new Error('movement_already_linked_to_another_portfolio_entity');
    const validTypes = ['Contribution', 'Withdrawal', 'Buy', 'Sell', 'Fee'];
    if (!validTypes.includes(request.type)) throw new Error('investment_transaction_type_invalid');
    const quantity = this.optionalNonNegative(request.quantity, 'investment_quantity_invalid');
    const unitPrice = this.optionalNonNegative(request.unitPrice, 'investment_unit_price_invalid');
    const feeAmountBase = this.nonNegative(request.feeAmountBase ?? 0, 'investment_fee_invalid');
    if (['Buy', 'Sell'].includes(request.type) && (!(quantity && quantity > 0) || !(unitPrice && unitPrice > 0)))
      throw new Error('investment_trade_requires_quantity_and_unit_price');
    if (!Number.isFinite(Number(movement.amountBase)) || Number(movement.amountBase) <= 0)
      throw new Error('investment_movement_amount_invalid');
    const expectedDirection = ['Contribution', 'Buy', 'Fee'].includes(request.type) ? 'Expense' : 'Income';
    if (movement.type !== expectedDirection) throw new Error('investment_transaction_movement_direction_invalid');
    const existing = await this.local.list<InvestmentTransactionDocument>('investmenttransaction');
    if (existing.some((transaction) => transaction.movementId === movement.id))
      throw new Error('investment_movement_already_registered');
    const now = new Date().toISOString();
    const transaction: InvestmentTransactionDocument = {
      id: globalThis.crypto.randomUUID(),
      portfolioEntityId: entityId,
      movementId: movement.id,
      type: request.type,
      quantity,
      unitPrice,
      feeAmountBase,
      createdAt: now,
      updatedAt: now,
    };
    await this.local.batch([
      {
        action: 'put',
        kind: 'movement',
        value: {
          ...movement,
          portfolioEntityId: entityId,
          portfolioType: 'Investment',
          investmentTransactionType: request.type,
          updatedAt: now,
        },
        operation: 'link-investment-transaction',
      },
      {
        action: 'put',
        kind: 'investmenttransaction',
        value: transaction,
        operation: 'add-investment-transaction',
      },
    ]);
    return transaction;
  }

  private async requiredInvestment(id: string): Promise<PortfolioEntityDocument> {
    const entity = await this.local.get<PortfolioEntityDocument>('portfolioentity', id);
    if (!entity || entity.isActive === false || this.entityType(entity) !== 'Investment')
      throw new Error('active_investment_not_found');
    return entity;
  }

  private entityType(entity: PortfolioEntityDocument): string {
    return typeof entity.type === 'number'
      ? ['Cash', 'BankAccount', 'CreditCard', 'Loan', 'Investment', 'OtherAsset', 'OtherLiability'][entity.type] ?? ''
      : entity.type;
  }

  private isoCurrency(value: string): string {
    const currency = String(value ?? '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error('currency_must_be_iso_4217');
    return currency;
  }

  private date(value: string): string {
    const date = String(value ?? '').slice(0, 10);
    const parsed = new Date(`${date}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    )
      throw new Error('valuation_date_invalid');
    return date;
  }

  private positive(value: number, error: string): number {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new Error(error);
    return number;
  }

  private nonNegative(value: number, error: string): number {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new Error(error);
    return number;
  }

  private optionalNonNegative(value: number | null | undefined, error: string): number | null {
    return value == null ? null : this.nonNegative(value, error);
  }
}
