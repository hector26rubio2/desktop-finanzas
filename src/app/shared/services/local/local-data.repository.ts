import { Injectable, inject } from '@angular/core';
import { TokenService } from '../../services/auth/token.service';

export type LocalKind =
  | 'movement'
  | 'account'
  | 'category'
  | 'loan'
  | 'installmentpurchase'
  | 'recurringtransaction'
  | 'portfolioentity'
  | 'portfoliovaluation'
  | 'investmenttransaction'
  | 'creditcardterms';

export type LocalBatchOperation =
  | { action: 'put'; kind: LocalKind; value: unknown; operation?: string }
  | { action: 'remove'; kind: LocalKind; id: string; operation?: string };

interface LocalApi {
  status(): Promise<{ schemaVersion: number; encryptedPayloads: boolean }>;
  list<T>(entity: LocalKind): Promise<T[]>;
  get<T>(entity: LocalKind, id: string): Promise<T | null>;
  put<T>(entity: LocalKind, value: T): Promise<T>;
  putMany<T>(entity: LocalKind, values: T[]): Promise<T[]>;
  batch(operations: LocalBatchOperation[]): Promise<unknown[]>;
  remove(entity: LocalKind, id: string): Promise<boolean>;
  movements<T>(query: Record<string, unknown>): Promise<T>;
  summary<T>(year: number, month: number): Promise<T>;
  accountBalances<T>(ids: string[]): Promise<T>;
  backup(destination?: string): Promise<{ path: string; schemaVersion: number; revision: string }>;
  backupPreview(source: string): Promise<{ schemaVersion: number; backupRevision: string; currentRevision: string }>;
  restore(source: string, expectedCurrentRevision: string): Promise<{ schemaVersion: number }>;
}

function api(): LocalApi | null {
  const electron = (window as unknown as { electronAPI?: { localData?: LocalApi } }).electronAPI;
  return electron?.localData ?? null;
}

function withMovementKind<T>(kind: LocalKind, value: T): T {
  if (kind !== 'movement' || !value || typeof value !== 'object') return value;
  const movement = value as Record<string, unknown>;
  if (typeof movement['kind'] === 'string' && movement['kind']) return value;
  return { ...movement, kind: deriveMovementKind(movement) } as T;
}

function deriveMovementKind(m: Record<string, unknown>): string {
  const op = m['operationType'];
  if (op === 'Transfer') return 'Transfer';
  if (op === 'Saving' || m['subType'] === 'Saving') return 'Saving';
  if (op === 'CreditPurchase') return 'CreditPurchase';
  if (op === 'CreditPayment') return 'CreditPayment';
  if (op === 'CreditInterest') return 'CreditInterest';
  if (op === 'LoanDisbursement') return m['subType'] === 'LoanGiven' ? 'LoanGiven' : 'LoanReceived';
  if (op === 'LoanPayment') return 'LoanPayment';
  if (m['investmentTransactionType']) return 'Investment';
  if (m['installmentPurchaseId'] && m['installmentNumber'] != null) return 'InstallmentPayment';
  return m['type'] === 'Income' ? 'Income' : 'Expense';
}

@Injectable({ providedIn: 'root' })
export class LocalDataRepository {
  private token = inject(TokenService);

  get available(): boolean {
    return api() !== null && this.token.currentUser() !== null;
  }

  list<T>(kind: LocalKind): Promise<T[]> {
    return this.required().list<T>(kind);
  }

  get<T>(kind: LocalKind, id: string): Promise<T | null> {
    return this.required().get<T>(kind, id);
  }

  put<T>(kind: LocalKind, value: T, _operation?: string): Promise<T> {
    return this.required().put<T>(kind, withMovementKind(kind, value));
  }

  putMany<T>(kind: LocalKind, values: T[], _operation?: string): Promise<T[]> {
    return this.required().putMany<T>(kind, values.map((value) => withMovementKind(kind, value)));
  }

  batch(operations: LocalBatchOperation[]): Promise<unknown[]> {
    return this.required().batch(
      operations.map((op) => (op.action === 'put' ? { ...op, value: withMovementKind(op.kind, op.value) } : op)),
    );
  }

  async remove(kind: LocalKind, id: string): Promise<void> {
    await this.required().remove(kind, id);
  }

  movements<T>(query: Record<string, unknown>): Promise<T> {
    return this.required().movements<T>(query);
  }

  summary<T>(year: number, month: number): Promise<T> {
    return this.required().summary<T>(year, month);
  }

  accountBalances<T>(ids: string[]): Promise<T> {
    return this.required().accountBalances<T>(ids);
  }

  backup(destination?: string) {
    return this.required().backup(destination);
  }

  backupPreview(source: string) {
    return this.required().backupPreview(source);
  }

  restore(source: string, expectedCurrentRevision: string) {
    return this.required().restore(source, expectedCurrentRevision);
  }

  private required(): LocalApi {
    const value = api();
    if (!value) throw new Error('Local data is only available in the desktop application');
    return value;
  }
}
