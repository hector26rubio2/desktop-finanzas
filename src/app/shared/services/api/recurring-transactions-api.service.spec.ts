import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { firstValueFrom } from 'rxjs';
import type { AccountResponse } from '../../models/account.model';
import type { MovementResponse } from '../../models/movement.model';
import type { RecurringTransactionResponse } from '../../models/recurring-transaction.model';
import { LocalDataRepository, type LocalBatchOperation, type LocalKind } from '../local/local-data.repository';
import { nextRecurringDate, RecurringTransactionsApiService } from './recurring-transactions-api.service';

class RecurringMemoryLocal {
  docs = new Map<LocalKind, Map<string, unknown>>();
  seed(kind: LocalKind, value: { id: string }) {
    const bucket = this.docs.get(kind) ?? new Map<string, unknown>();
    bucket.set(value.id, structuredClone(value));
    this.docs.set(kind, bucket);
  }
  async list<T>(kind: LocalKind): Promise<T[]> { return [...(this.docs.get(kind)?.values() ?? [])] as T[]; }
  async get<T>(kind: LocalKind, id: string): Promise<T | null> { return (this.docs.get(kind)?.get(id) as T) ?? null; }
  async put<T extends { id: string }>(kind: LocalKind, value: T): Promise<T> { this.seed(kind, value); return value; }
  async remove(kind: LocalKind, id: string): Promise<void> { this.docs.get(kind)?.delete(id); }
  async batch(operations: LocalBatchOperation[]): Promise<unknown[]> {
    for (const operation of operations) {
      if (operation.action === 'put') this.seed(operation.kind, operation.value as { id: string });
      else this.docs.get(operation.kind)?.delete(operation.id);
    }
    return [];
  }
}

describe('RecurringTransactionsApiService', () => {
  let local: RecurringMemoryLocal;
  let service: RecurringTransactionsApiService;

  beforeEach(() => {
    local = new RecurringMemoryLocal();
    local.seed('account', {
      id: 'cash', name: 'Caja', type: 'Cash', currency: 'COP', bank: null, lastFour: null,
      creditLimit: null, billingDay: null, paymentDay: null, interestRate: null,
      isDefault: true, isActive: true, createdAt: '2026-01-01',
    } satisfies AccountResponse);
    local.seed('recurringtransaction', {
      id: 'rent', userId: '', type: 'Expense', amount: 10, currency: 'COP', trmApplied: 1,
      categoryId: null, accountId: 'cash', description: 'Diario', frequency: 'Daily', interval: 1,
      dayOfMonth: null, dayOfWeek: null, startDate: '2026-08-01', endDate: null, isActive: true,
      lastRunAt: null, nextRunAt: '2026-08-01', createdAt: '2026-08-01',
    } satisfies RecurringTransactionResponse);
    TestBed.configureTestingModule({ providers: [
      RecurringTransactionsApiService,
      { provide: LocalDataRepository, useValue: local },
    ] });
    service = TestBed.inject(RecurringTransactionsApiService);
  });

  it('clamps monthly and yearly dates at calendar boundaries', () => {
    expect(nextRecurringDate('2026-01-31', 'Monthly', 1, 31)).toBe('2026-02-28');
    expect(nextRecurringDate('2024-02-29', 'Yearly', 1, null)).toBe('2025-02-28');
    expect(nextRecurringDate('2027-02-28', 'Yearly', 1, 29)).toBe('2028-02-29');
    expect(() => nextRecurringDate('2026-02-31', 'Monthly', 1, 31)).toThrow('recurring_date_is_invalid');
  });

  it('materializes every due occurrence exactly once and advances the template atomically', async () => {
    expect(await firstValueFrom(service.materializeDue(new Date('2026-08-03T12:00:00Z')))).toBe(3);
    expect(await firstValueFrom(service.materializeDue(new Date('2026-08-03T12:00:00Z')))).toBe(0);
    const movements = await local.list<MovementResponse>('movement');
    const template = await local.get<RecurringTransactionResponse>('recurringtransaction', 'rent');
    expect(movements.map((item) => item.id)).toEqual([
      'rent:occurrence:2026-08-01', 'rent:occurrence:2026-08-02', 'rent:occurrence:2026-08-03',
    ]);
    expect(template).toMatchObject({ lastRunAt: '2026-08-03', nextRunAt: '2026-08-04' });
  });

  it('isolates a malformed template so other due movements are still created', async () => {
    const valid = await local.get<RecurringTransactionResponse>('recurringtransaction', 'rent');
    local.docs.set('recurringtransaction', new Map([
      ['broken', { ...valid!, id: 'broken', frequency: 'Unknown' }],
      ['rent', valid!],
    ]));

    expect(await firstValueFrom(service.materializeDue(new Date('2026-08-01T12:00:00Z')))).toBe(1);
    expect((await local.list<MovementResponse>('movement')).map((item) => item.id)).toEqual([
      'rent:occurrence:2026-08-01',
    ]);
  });
});
