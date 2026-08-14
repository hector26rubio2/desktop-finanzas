import { describe, expect, it } from 'vitest';
import { prepareMovementImport } from './movement-import';

const baseMovement = {
  type: 'Expense',
  amount: 125.5,
  currency: 'COP',
  trmApplied: 1,
  date: '2026-08-09',
  description: 'Mercado',
  accountId: 'account-1',
};

describe('prepareMovementImport', () => {
  it('genera un ID y hash estables desde el contenido normalizado', async () => {
    const first = await prepareMovementImport(
      [
        {
          ...baseMovement,
          id: '   ',
          type: ' expense ',
          amount: '125.50',
          currency: ' cop ',
          trmApplied: '1.0',
          description: ' Mercado ',
          importHash: 'untrusted-input',
        },
      ],
      [],
    );
    const second = await prepareMovementImport(
      [
        {
          accountId: 'account-1',
          description: 'Mercado',
          date: '2026-08-09',
          trmApplied: 1,
          currency: 'COP',
          amount: 125.5,
          type: 'Expense',
        },
      ],
      [],
    );

    expect(first.invalid).toBe(0);
    expect(first.newCount).toBe(1);
    expect(first.newMovements[0].id).toMatch(/^import-[a-f0-9]{32}$/);
    expect(first.newMovements[0].importHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.newMovements[0].importHash).not.toBe('untrusted-input');
    expect(first.newMovements[0].id).toBe(second.newMovements[0].id);
    expect(first.newMovements[0].importHash).toBe(second.newMovements[0].importHash);
    expect(first.payloadHash).toBe(second.payloadHash);
  });

  it('detecta por ID o hash los movimientos que ya fueron aplicados', async () => {
    const initial = await prepareMovementImport([baseMovement], []);
    const existing = initial.newMovements[0];

    const sameContent = await prepareMovementImport([{ ...baseMovement, id: 'external-id' }], [existing]);
    const sameId = await prepareMovementImport([{ ...baseMovement, id: existing.id }], [existing]);
    const repeatedInsideFile = await prepareMovementImport([baseMovement, baseMovement], []);

    expect(sameContent).toMatchObject({ valid: 1, invalid: 0, alreadyApplied: 1, newCount: 0 });
    expect(sameId).toMatchObject({ valid: 1, invalid: 0, alreadyApplied: 1, newCount: 0 });
    expect(repeatedInsideFile).toMatchObject({ valid: 2, invalid: 0, alreadyApplied: 1, newCount: 1 });
  });

  it('rechaza cada campo financiero obligatorio inválido', async () => {
    const result = await prepareMovementImport(
      [
        { ...baseMovement, type: 'Transfer' },
        { ...baseMovement, amount: 0 },
        { ...baseMovement, currency: 'CO' },
        { ...baseMovement, trmApplied: -1 },
        { ...baseMovement, date: '2026-02-31' },
      ],
      [],
    );

    expect(result).toMatchObject({ valid: 0, invalid: 5, alreadyApplied: 0, newCount: 0 });
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'invalid_type',
      'invalid_amount',
      'invalid_currency',
      'invalid_trm',
      'invalid_date',
    ]);
  });

  it('trata como conflicto un ID existente con contenido financiero diferente', async () => {
    const existing = (await prepareMovementImport([{ ...baseMovement, id: 'movement-1' }], [])).newMovements[0];
    const result = await prepareMovementImport([{ ...baseMovement, id: 'movement-1', amount: 999 }], [existing]);

    expect(result).toMatchObject({ valid: 0, invalid: 1, alreadyApplied: 0, newCount: 0 });
    expect(result.issues[0]).toMatchObject({ index: 1, code: 'movement_id_conflict' });
  });
});
