import { Injectable, inject } from '@angular/core';
import { TokenService } from '../../services/auth/token.service';

export type LocalKind =
  | 'movement'
  | 'account'
  | 'category'
  | 'entity'
  | 'loan'
  | 'installmentpurchase'
  | 'recurringtransaction'
  | 'portfolioentity'
  | 'portfoliovaluation'
  | 'investmenttransaction'
  | 'budget'
  | 'financialgoal'
  | 'financialoperation';
export type LocalBatchOperation =
  | { action: 'put'; kind: LocalKind; value: unknown; operation?: string }
  | { action: 'remove'; kind: LocalKind; id: string; operation?: string };
interface LocalApi {
  status(): Promise<{ schemaVersion: number; encryptedPayloads: boolean }>;
  list<T>(kind: LocalKind, ownerId: string): Promise<T[]>;
  get<T>(kind: LocalKind, ownerId: string, id: string): Promise<T | null>;
  put<T>(kind: LocalKind, ownerId: string, value: T, operation?: string): Promise<{ document: T; changeId: string }>;
  putMany<T>(kind: LocalKind, ownerId: string, values: T[], operation?: string): Promise<T[]>;
  batch(ownerId: string, operations: LocalBatchOperation[]): Promise<unknown[]>;
  remove(kind: LocalKind, ownerId: string, id: string): Promise<boolean>;
  movements<T>(ownerId: string, query: Record<string, unknown>): Promise<T>;
  summary<T>(ownerId: string, year: number, month: number): Promise<T>;
  accountBalances<T>(ownerId: string, ids: string[]): Promise<T>;
  backup(destination?: string): Promise<{ path: string; schemaVersion: number; revision: string }>;
  backupPreview(source: string): Promise<{ schemaVersion: number; backupRevision: string; currentRevision: string }>;
  restore(source: string, expectedCurrentRevision: string): Promise<{ schemaVersion: number }>;
}

function api(): LocalApi | null {
  const electron = (window as unknown as { electronAPI?: { localData?: LocalApi } }).electronAPI;
  return electron?.localData ?? null;
}

@Injectable({ providedIn: 'root' })
export class LocalDataRepository {
  private token = inject(TokenService);
  get available(): boolean {
    return api() !== null && this.token.currentUser() !== null;
  }
  private owner(): string {
    const user = this.token.currentUser();
    if (!user) throw new Error('An authenticated local profile is required');
    return user.id;
  }
  list<T>(kind: LocalKind): Promise<T[]> {
    return this.required().list<T>(kind, this.owner());
  }
  get<T>(kind: LocalKind, id: string): Promise<T | null> {
    return this.required().get<T>(kind, this.owner(), id);
  }
  async put<T>(kind: LocalKind, value: T, operation = 'upsert'): Promise<T> {
    return (await this.required().put(kind, this.owner(), value, operation)).document;
  }
  putMany<T>(kind: LocalKind, values: T[], operation = 'upsert'): Promise<T[]> {
    return this.required().putMany(kind, this.owner(), values, operation);
  }
  batch(operations: LocalBatchOperation[]): Promise<unknown[]> {
    return this.required().batch(this.owner(), operations);
  }
  async remove(kind: LocalKind, id: string): Promise<void> {
    await this.required().remove(kind, this.owner(), id);
  }
  movements<T>(query: Record<string, unknown>): Promise<T> {
    return this.required().movements<T>(this.owner(), query);
  }
  summary<T>(year: number, month: number): Promise<T> {
    return this.required().summary<T>(this.owner(), year, month);
  }
  accountBalances<T>(ids: string[]): Promise<T> {
    return this.required().accountBalances<T>(this.owner(), ids);
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
