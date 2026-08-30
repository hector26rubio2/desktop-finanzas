import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { UserInfo } from '../models/auth.model';
import { TokenService } from './auth/token.service';
import { LocalDataRepository, type LocalKind } from './local/local-data.repository';
import { BaseCurrencyPolicyService } from './base-currency-policy.service';

describe('BaseCurrencyPolicyService', () => {
  let service: BaseCurrencyPolicyService;
  let local: { available: boolean; list: ReturnType<typeof vi.fn> };
  let token: { currentUser: ReturnType<typeof signal<UserInfo | null>>; updateBaseCurrency: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    local = { available: true, list: vi.fn().mockResolvedValue([]) };
    token = {
      currentUser: signal<UserInfo | null>({
        id: 'user-1',
        email: 'test@finanzas.app',
        name: 'Test',
        baseCurrency: 'COP',
        role: 'User',
      }),
      updateBaseCurrency: vi.fn((currency: string) => {
        const user = token.currentUser();
        if (user) token.currentUser.set({ ...user, baseCurrency: currency });
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        BaseCurrencyPolicyService,
        { provide: LocalDataRepository, useValue: local },
        { provide: TokenService, useValue: token },
      ],
    });
    service = TestBed.inject(BaseCurrencyPolicyService);
  });

  it('allows selecting the current currency without reading local data', async () => {
    local.available = false;

    await expect(service.change('cop')).resolves.toEqual({ status: 'unchanged', currency: 'COP' });
    expect(local.list).not.toHaveBeenCalled();
    expect(token.updateBaseCurrency).not.toHaveBeenCalled();
  });

  it('changes the base currency when every financial collection is empty', async () => {
    await expect(service.change('usd')).resolves.toEqual({ status: 'changed', currency: 'USD' });

    expect(local.list.mock.calls.map(([kind]) => kind)).toEqual([
      'movement',
      'account',
      'loan',
      'installmentpurchase',
      'recurringtransaction',
      'portfolioentity',
      'portfoliovaluation',
      'investmenttransaction',
    ]);
    expect(token.updateBaseCurrency).toHaveBeenCalledWith('USD');
  });

  it.each<LocalKind>([
    'movement',
    'account',
    'loan',
    'installmentpurchase',
    'recurringtransaction',
    'portfolioentity',
    'portfoliovaluation',
    'investmenttransaction',
  ])('blocks a change when %s data exists', async (blockingKind) => {
    local.list.mockImplementation((kind: LocalKind) => Promise.resolve(kind === blockingKind ? [{ id: '1' }] : []));

    await expect(service.change('USD')).resolves.toMatchObject({
      status: 'blocked',
      currency: 'COP',
      blockingKind,
    });
    expect(token.updateBaseCurrency).not.toHaveBeenCalled();
  });

  it('fails closed when the local store is unavailable', async () => {
    local.available = false;

    await expect(service.change('USD')).resolves.toEqual({ status: 'unavailable', currency: 'COP' });
    expect(token.updateBaseCurrency).not.toHaveBeenCalled();
  });

  it('fails closed when local financial data cannot be read', async () => {
    local.list.mockRejectedValue(new Error('database locked'));

    await expect(service.change('USD')).resolves.toEqual({ status: 'unavailable', currency: 'COP' });
    expect(token.updateBaseCurrency).not.toHaveBeenCalled();
  });
});
