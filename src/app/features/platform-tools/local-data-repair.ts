import type { LocalBatchOperation } from '@shared/services/local/local-data.repository';
import type { LocalAuditFinding, LocalDataAuditInput, LocalDataAuditReport } from './local-data-audit';

/**
 * Segundo tiempo de la auditoría. `local-data-audit.ts` solo detecta —está
 * marcado `readOnly`—; aquí se decide qué se puede arreglar.
 *
 * La regla que gobierna el módulo: **solo se repara lo que se deduce por
 * aritmética o del propio libro de movimientos.** Todo lo que exija adivinar la
 * intención del usuario se lista para que él decida (invariante §2.7 de
 * ESTADO-EJECUTIVO: no se corrige información ambigua en silencio).
 *
 * Reparable:
 * - `movement_amount_base_invalid`, y solo si `amount` y `trmApplied` son
 *   positivos: `amountBase = amount × trmApplied` es una multiplicación, no un
 *   criterio. Si falta cualquiera de los dos, no hay nada que deducir.
 * - `loan_payment_count_mismatch` e `installment_payment_count_mismatch`:
 *   `paidMonths` y `paidCount` son contadores derivados. El libro manda, así que
 *   se recalculan desde los movimientos enlazados.
 *
 * No reparable —requiere tu decisión—: desembolsos ausentes o duplicados,
 * enlaces rotos entre compra y plan, saldos vivos que no cuadran, y toda
 * operación pareada incompleta o desbalanceada. En esos casos falta información
 * o sobra, y elegir por el usuario sería inventar un hecho financiero.
 */

export const REPAIRABLE_CODES = [
  'movement_amount_base_invalid',
  'loan_payment_count_mismatch',
  'installment_payment_count_mismatch',
] as const;

export type RepairableCode = (typeof REPAIRABLE_CODES)[number];

export interface LocalRepairChange {
  code: string;
  entityKind: LocalAuditFinding['entityKind'];
  entityId: string;
  field: string;
  before: unknown;
  after: unknown;
  reason: string;
}

export interface LocalRepairSkip {
  code: string;
  entityKind: LocalAuditFinding['entityKind'];
  entityId: string;
  /** Por qué no se toca. El usuario lee esto para decidir. */
  reason: string;
}

export interface LocalRepairPlan {
  planVersion: 1;
  /** Nada se ha escrito todavía: esto es lo que se haría. */
  applied: false;
  summary: {
    findings: number;
    repairable: number;
    requiresDecision: number;
  };
  changes: LocalRepairChange[];
  skipped: LocalRepairSkip[];
  /** Se aplican en una sola transacción o no se aplica ninguna. */
  operations: LocalBatchOperation[];
}

type LocalRecord = Record<string, unknown>;

function records(values: unknown[]): LocalRecord[] {
  return values.filter((value): value is LocalRecord => typeof value === 'object' && value !== null);
}

function documentId(value: LocalRecord): string | null {
  const id = value['id'];
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function indexById(values: LocalRecord[]): Map<string, LocalRecord> {
  const map = new Map<string, LocalRecord>();
  for (const value of values) {
    const id = documentId(value);
    if (id) map.set(id, value);
  }
  return map;
}

export function planLocalDataRepair(report: LocalDataAuditReport, input: LocalDataAuditInput): LocalRepairPlan {
  const movements = records(input.movements);
  const loans = records(input.loans);
  const purchases = records(input.installmentPurchases);
  const movementsById = indexById(movements);
  const loansById = indexById(loans);
  const purchasesById = indexById(purchases);

  const changes: LocalRepairChange[] = [];
  const skipped: LocalRepairSkip[] = [];
  const operations: LocalBatchOperation[] = [];
  // Un documento puede acumular varios hallazgos; se escribe una sola vez.
  const patched = new Map<string, { kind: 'movement' | 'loan' | 'installmentpurchase'; value: LocalRecord }>();

  const patch = (
    kind: 'movement' | 'loan' | 'installmentpurchase',
    id: string,
    source: LocalRecord,
    field: string,
    after: unknown,
  ): void => {
    const current = patched.get(`${kind}:${id}`)?.value ?? { ...source };
    current[field] = after;
    patched.set(`${kind}:${id}`, { kind, value: current });
  };

  const skip = (finding: LocalAuditFinding, reason: string): void => {
    skipped.push({ code: finding.code, entityKind: finding.entityKind, entityId: finding.entityId, reason });
  };

  for (const finding of report.findings) {
    switch (finding.code) {
      case 'movement_amount_base_invalid': {
        const movement = movementsById.get(finding.entityId);
        if (!movement) {
          skip(finding, 'El movimiento ya no existe en los datos suministrados.');
          break;
        }
        const amount = finiteNumber(movement['amount']);
        const trmApplied = finiteNumber(movement['trmApplied']);
        if (amount === null || amount <= 0 || trmApplied === null || trmApplied <= 0) {
          // Rellenar una TRM o un monto ausente sería inventar la operación.
          skip(finding, 'Falta amount o trmApplied válido: no se puede deducir amountBase sin inventar una cifra.');
          break;
        }
        const after = amount * trmApplied;
        changes.push({
          code: finding.code,
          entityKind: 'movement',
          entityId: finding.entityId,
          field: 'amountBase',
          before: movement['amountBase'] ?? null,
          after,
          reason: `amountBase = amount (${amount}) × trmApplied (${trmApplied}).`,
        });
        patch('movement', finding.entityId, movement, 'amountBase', after);
        break;
      }

      case 'loan_payment_count_mismatch': {
        const loan = loansById.get(finding.entityId);
        if (!loan) {
          skip(finding, 'El préstamo ya no existe en los datos suministrados.');
          break;
        }
        const linked = movements.filter(
          (movement) => text(movement['loanId']) === finding.entityId && text(movement['operationType']) === 'LoanPayment',
        ).length;
        changes.push({
          code: finding.code,
          entityKind: 'loan',
          entityId: finding.entityId,
          field: 'paidMonths',
          before: loan['paidMonths'] ?? null,
          after: linked,
          reason: `El libro tiene ${linked} movimiento(s) LoanPayment enlazado(s); el contador se deriva de ellos.`,
        });
        patch('loan', finding.entityId, loan, 'paidMonths', linked);
        break;
      }

      case 'installment_payment_count_mismatch': {
        const purchase = purchasesById.get(finding.entityId);
        if (!purchase) {
          skip(finding, 'El plan de cuotas ya no existe en los datos suministrados.');
          break;
        }
        // Cada pago aporta dos patas con el mismo operationId: se cuentan operaciones, no filas.
        const paymentOperations = new Set(
          movements
            .filter(
              (movement) =>
                text(movement['installmentPurchaseId']) === finding.entityId &&
                text(movement['operationType']) === 'CreditPayment',
            )
            .map((movement) => text(movement['operationId']))
            .filter((value): value is string => value !== null),
        );
        changes.push({
          code: finding.code,
          entityKind: 'installmentpurchase',
          entityId: finding.entityId,
          field: 'paidCount',
          before: purchase['paidCount'] ?? null,
          after: paymentOperations.size,
          reason: `El libro tiene ${paymentOperations.size} pago(s) CreditPayment enlazado(s); el contador se deriva de ellos.`,
        });
        patch('installmentpurchase', finding.entityId, purchase, 'paidCount', paymentOperations.size);
        break;
      }

      default:
        skip(finding, 'Requiere una decisión tuya: no se deduce del libro ni por aritmética.');
    }
  }

  for (const { kind, value } of patched.values()) {
    operations.push({ action: 'put', kind, value, operation: 'local-data-repair' });
  }

  return {
    planVersion: 1,
    applied: false,
    summary: {
      findings: report.findings.length,
      repairable: changes.length,
      requiresDecision: skipped.length,
    },
    changes,
    skipped,
    operations,
  };
}
