import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import type { AccountResponse } from '../../models/account.model';
import type { CategoryResponse } from '../../models/category.model';
import type { MovementResponse } from '../../models/movement.model';
import type {
  RecurringTransactionResponse,
  RecurringTransactionRequest,
} from '../../models/recurring-transaction.model';
import { LocalDataRepository, type LocalBatchOperation } from '../local/local-data.repository';

const dateOnly = (value: string | Date): string => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error('recurring_date_is_invalid');
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    throw new Error('recurring_date_is_invalid');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error('recurring_date_is_invalid');
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
};

const daysInUtcMonth = (year: number, monthIndex: number): number =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

export function nextRecurringDate(
  current: string,
  frequency: RecurringTransactionResponse['frequency'],
  interval: number,
  dayOfMonth: number | null,
): string {
  const value = dateOnly(current);
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (frequency === 'Daily') date.setUTCDate(date.getUTCDate() + interval);
  if (frequency === 'Weekly') date.setUTCDate(date.getUTCDate() + interval * 7);
  if (frequency === 'Monthly') {
    const targetMonth = date.getUTCMonth() + interval;
    const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    date.setUTCFullYear(
      targetYear,
      normalizedMonth,
      Math.min(dayOfMonth ?? day, daysInUtcMonth(targetYear, normalizedMonth)),
    );
  }
  if (frequency === 'Yearly') {
    const targetYear = date.getUTCFullYear() + interval;
    const targetDay = dayOfMonth ?? day;
    date.setUTCFullYear(
      targetYear,
      date.getUTCMonth(),
      Math.min(targetDay, daysInUtcMonth(targetYear, date.getUTCMonth())),
    );
  }
  if (!['Daily', 'Weekly', 'Monthly', 'Yearly'].includes(frequency)) {
    throw new Error('recurring_frequency_is_invalid');
  }
  return date.toISOString().slice(0, 10);
}

@Injectable({ providedIn: 'root' })
export class RecurringTransactionsApiService {
  private local = inject(LocalDataRepository);

  getRecurring(): Observable<RecurringTransactionResponse[]> {
    return from(this.local.list<RecurringTransactionResponse>('recurringtransaction'));
  }

  createRecurring(req: RecurringTransactionRequest): Observable<RecurringTransactionResponse> {
    return from(this.create(req));
  }

  updateRecurring(id: string, req: RecurringTransactionRequest): Observable<RecurringTransactionResponse> {
    return from(this.update(id, req));
  }

  toggleActive(id: string, isActive: boolean): Observable<RecurringTransactionResponse> {
    return from(this.updateActive(id, isActive));
  }

  deleteRecurring(id: string): Observable<void> {
    return from(this.local.remove('recurringtransaction', id));
  }

  materializeDue(referenceDate = new Date()): Observable<number> {
    return from(this.materializeAll(dateOnly(referenceDate)));
  }

  private async create(req: RecurringTransactionRequest): Promise<RecurringTransactionResponse> {
    await this.validate(req);
    const document = this.document(req);
    await this.materializeOne(document, dateOnly(new Date()));
    return (await this.local.get<RecurringTransactionResponse>('recurringtransaction', document.id)) ?? document;
  }

  private async update(id: string, req: RecurringTransactionRequest): Promise<RecurringTransactionResponse> {
    await this.validate(req);
    const current = await this.required(id);
    const document: RecurringTransactionResponse = {
      ...this.document(req, id),
      createdAt: current.createdAt,
      isActive: current.isActive,
      lastRunAt: current.lastRunAt,
      nextRunAt: dateOnly(req.startDate),
    };
    if (document.isActive) await this.materializeOne(document, dateOnly(new Date()));
    else await this.local.put('recurringtransaction', document, 'update');
    return (await this.local.get<RecurringTransactionResponse>('recurringtransaction', id)) ?? document;
  }

  private async updateActive(id: string, isActive: boolean): Promise<RecurringTransactionResponse> {
    const current = await this.required(id);
    const updated = { ...current, isActive };
    if (isActive) await this.materializeOne(updated, dateOnly(new Date()));
    else await this.local.put('recurringtransaction', updated, 'update');
    return (await this.local.get<RecurringTransactionResponse>('recurringtransaction', id)) ?? updated;
  }

  private async materializeAll(referenceDate: string): Promise<number> {
    let created = 0;
    for (const item of await this.local.list<RecurringTransactionResponse>('recurringtransaction')) {
      if (!item.isActive) continue;
      try {
        created += await this.materializeOne(item, referenceDate);
      } catch {}
    }
    return created;
  }

  private async materializeOne(item: RecurringTransactionResponse, referenceDate: string): Promise<number> {
    if (!item.isActive) return 0;
    const [account, category, movements] = await Promise.all([
      item.accountId ? this.local.get<AccountResponse>('account', item.accountId) : Promise.resolve(null),
      item.categoryId ? this.local.get<CategoryResponse>('category', item.categoryId) : Promise.resolve(null),
      this.local.list<MovementResponse>('movement'),
    ]);
    if (item.accountId && !account) throw new Error('recurring_account_not_found');
    if (account && (!account.isActive || account.currency.toUpperCase() !== item.currency.toUpperCase())) {
      throw new Error('recurring_account_is_invalid');
    }
    if (item.categoryId && (!category || category.type !== item.type)) throw new Error('recurring_category_is_invalid');
    const existingIds = new Set(movements.map((movement) => movement.id));
    const operations: LocalBatchOperation[] = [];
    let occurrence = dateOnly(item.nextRunAt || item.startDate);
    let lastRunAt = item.lastRunAt;
    let created = 0;
    for (let guard = 0; guard < 500 && occurrence <= referenceDate; guard++) {
      if (item.endDate && occurrence > dateOnly(item.endDate)) break;
      const movementId = `${item.id}:occurrence:${occurrence}`;
      if (!existingIds.has(movementId)) {
        operations.push({
          action: 'put',
          kind: 'movement',
          value: this.movement(item, occurrence, movementId, account, category),
          operation: 'recurring-materialize',
        });
        created++;
      }
      lastRunAt = occurrence;
      occurrence = nextRecurringDate(occurrence, item.frequency, item.interval, item.dayOfMonth);
    }
    const exhausted = Boolean(item.endDate && occurrence > dateOnly(item.endDate));
    operations.push({
      action: 'put',
      kind: 'recurringtransaction',
      value: { ...item, lastRunAt, nextRunAt: occurrence, isActive: exhausted ? false : item.isActive },
      operation: 'recurring-materialize',
    });
    await this.local.batch(operations);
    return created;
  }

  private movement(
    item: RecurringTransactionResponse,
    occurrence: string,
    id: string,
    account: AccountResponse | null,
    category: CategoryResponse | null,
  ): MovementResponse {
    const sourceType: MovementResponse['sourceType'] =
      account?.type === 'Credit' ? 'CreditCard' : account?.type === 'Debit' ? 'OwnAccount' : 'Cash';
    return {
      id,
      type: item.type,
      subType: item.type,
      sourceType,
      loanParty: null,
      loanInstallments: null,
      loanInterestRate: null,
      amount: item.amount,
      currency: item.currency,
      trmApplied: item.trmApplied,
      amountBase: item.amount * item.trmApplied,
      date: occurrence,
      description: item.description,
      categoryId: item.categoryId,
      categoryName: category?.name ?? null,
      categoryColor: category?.color ?? null,
      categoryIcon: category?.icon ?? null,
      accountId: item.accountId,
      accountName: account?.name ?? null,
      installmentPurchaseId: null,
      recurringTransactionId: item.id,
      operationId: `${item.id}:${occurrence}`,
      operationType: account?.type === 'Credit' && item.type === 'Expense' ? 'CreditPurchase' : null,
      createdAt: new Date().toISOString(),
    };
  }

  private async validate(req: RecurringTransactionRequest): Promise<void> {
    if (!['Income', 'Expense'].includes(req.type)) throw new Error('recurring_type_is_invalid');
    if (!/^[A-Za-z]{3}$/.test(req.currency)) throw new Error('recurring_currency_is_invalid');
    if (!['Daily', 'Weekly', 'Monthly', 'Yearly'].includes(req.frequency)) {
      throw new Error('recurring_frequency_is_invalid');
    }
    if (!Number.isFinite(req.amount) || req.amount <= 0) throw new Error('recurring_amount_must_be_positive');
    if (!Number.isFinite(req.trmApplied ?? 1) || (req.trmApplied ?? 1) <= 0)
      throw new Error('recurring_trm_must_be_positive');
    if (!Number.isInteger(req.interval) || req.interval <= 0 || req.interval > 3650) {
      throw new Error('recurring_interval_is_invalid');
    }
    if (req.dayOfMonth != null && (!Number.isInteger(req.dayOfMonth) || req.dayOfMonth < 1 || req.dayOfMonth > 31)) {
      throw new Error('recurring_day_of_month_is_invalid');
    }
    dateOnly(req.startDate);
    if (req.endDate && dateOnly(req.endDate) < dateOnly(req.startDate)) throw new Error('recurring_end_precedes_start');
  }

  private async required(id: string): Promise<RecurringTransactionResponse> {
    const current = await this.local.get<RecurringTransactionResponse>('recurringtransaction', id);
    if (!current) throw new Error('recurring_transaction_not_found');
    return current;
  }

  private document(
    req: RecurringTransactionRequest,
    id: string = globalThis.crypto.randomUUID(),
  ): RecurringTransactionResponse {
    const startDate = dateOnly(req.startDate);
    const calendarDay = Number(startDate.slice(8, 10));
    return {
      id,
      userId: '',
      ...req,
      currency: req.currency.toUpperCase(),
      trmApplied: req.trmApplied ?? 1,
      categoryId: req.categoryId ?? null,
      accountId: req.accountId ?? null,
      description: req.description ?? null,
      dayOfMonth: ['Monthly', 'Yearly'].includes(req.frequency) ? (req.dayOfMonth ?? calendarDay) : null,
      dayOfWeek: req.dayOfWeek ?? null,
      startDate,
      endDate: req.endDate ? dateOnly(req.endDate) : null,
      isActive: true,
      lastRunAt: null,
      nextRunAt: startDate,
      createdAt: new Date().toISOString(),
    };
  }
}
