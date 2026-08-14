export type LocalAuditSeverity = 'critical' | 'error' | 'warning';

export interface LocalAuditFinding {
  severity: LocalAuditSeverity;
  code: string;
  entityKind: 'movement' | 'account' | 'category' | 'loan' | 'installmentpurchase' | 'operation';
  entityId: string;
  message: string;
  relatedIds: string[];
  evidence?: Record<string, unknown>;
}

export interface LocalDataAuditInput {
  movements: unknown[];
  accounts: unknown[];
  categories: unknown[];
  loans: unknown[];
  installmentPurchases: unknown[];
}

export interface LocalDataAuditReport {
  reportVersion: 1;
  readOnly: true;
  scanned: {
    movements: number;
    accounts: number;
    categories: number;
    loans: number;
    installmentPurchases: number;
  };
  summary: {
    total: number;
    critical: number;
    error: number;
    warning: number;
    byCode: Array<{ code: string; severity: LocalAuditSeverity; count: number }>;
  };
  findings: LocalAuditFinding[];
}

type LocalRecord = Record<string, unknown>;

const PAIRED_OPERATION_TYPES = new Set(['Transfer', 'Saving', 'CreditPayment']);
const SEVERITY_ORDER: Record<LocalAuditSeverity, number> = { critical: 0, error: 1, warning: 2 };

export function auditLocalData(input: LocalDataAuditInput): LocalDataAuditReport {
  const movements = records(input.movements);
  const accounts = records(input.accounts);
  const categories = records(input.categories);
  const loans = records(input.loans);
  const installments = records(input.installmentPurchases);
  const accountIds = idSet(accounts);
  const categoryIds = idSet(categories);
  const loanIds = idSet(loans);
  const installmentIds = idSet(installments);
  const movementsById = new Map(movements.flatMap((item) => (id(item) ? [[id(item)!, item] as const] : [])));
  const findings: LocalAuditFinding[] = [];
  const findingKeys = new Set<string>();

  const add = (finding: LocalAuditFinding) => {
    const key = `${finding.code}:${finding.entityKind}:${finding.entityId}`;
    if (findingKeys.has(key)) return;
    findingKeys.add(key);
    findings.push(finding);
  };

  for (const movement of movements) {
    const movementId = id(movement) ?? '[sin-id]';
    auditAmountBase(movement, movementId, add);
    auditReference(movement, movementId, 'accountId', accountIds, 'account', 'movement_account_missing', add);
    auditReference(movement, movementId, 'categoryId', categoryIds, 'category', 'movement_category_missing', add);
    auditReference(movement, movementId, 'loanId', loanIds, 'loan', 'movement_loan_missing', add);
    auditReference(
      movement,
      movementId,
      'installmentPurchaseId',
      installmentIds,
      'installmentpurchase',
      'movement_installment_plan_missing',
      add,
    );
    if (
      (text(movement['sourceType']) === 'Loan'
        || ['LoanReceived', 'LoanGiven'].includes(text(movement['subType']) ?? ''))
      && !text(movement['loanId'])
    ) {
      add({
        severity: 'error',
        code: 'movement_loan_link_missing',
        entityKind: 'movement',
        entityId: movementId,
        message: 'El movimiento de prÃ©stamo no estÃ¡ enlazado a un documento loan.',
        relatedIds: [],
      });
    }
  }

  for (const loan of loans) {
    const loanId = id(loan) ?? '[sin-id]';
    auditReference(loan, loanId, 'accountId', accountIds, 'account', 'loan_account_missing', add, 'loan');
    const disbursements = movements.filter(
      (movement) => text(movement['loanId']) === loanId && text(movement['operationType']) === 'LoanDisbursement',
    );
    if (disbursements.length === 0) {
      add({
        severity: 'critical',
        code: 'loan_disbursement_missing',
        entityKind: 'loan',
        entityId: loanId,
        message: 'El préstamo no tiene un movimiento de desembolso enlazado.',
        relatedIds: [],
      });
    } else if (disbursements.length > 1) {
      add({
        severity: 'error',
        code: 'loan_multiple_disbursements',
        entityKind: 'loan',
        entityId: loanId,
        message: 'El préstamo tiene más de un desembolso y requiere conciliación manual.',
        relatedIds: disbursements.map((movement) => id(movement) ?? '[sin-id]'),
        evidence: { count: disbursements.length },
      });
    }
    const loanPayments = movements.filter(
      (movement) => text(movement['loanId']) === loanId && text(movement['operationType']) === 'LoanPayment',
    );
    const paidMonths = finiteNumber(loan['paidMonths']);
    if (paidMonths !== null && paidMonths !== loanPayments.length) {
      add({
        severity: 'error',
        code: 'loan_payment_count_mismatch',
        entityKind: 'loan',
        entityId: loanId,
        message: 'paidMonths no coincide con los movimientos LoanPayment enlazados.',
        relatedIds: loanPayments.map((movement) => id(movement) ?? '[sin-id]'),
        evidence: { paidMonths, linkedPayments: loanPayments.length },
      });
    }
    const principal = finiteNumber(loan['principal']);
    const outstanding = finiteNumber(loan['outstandingPrincipal']);
    const principalComponents = loanPayments.map((movement) => finiteNumber(movement['principalComponent']));
    if (principal !== null && outstanding !== null && principalComponents.every((value) => value !== null)) {
      const expected = Math.max(0, principal - principalComponents.reduce((sum, value) => sum + (value ?? 0), 0));
      if (Math.abs(outstanding - expected) > Math.max(0.01, Math.abs(expected) * 1e-9)) {
        add({
          severity: 'error',
          code: 'loan_outstanding_principal_mismatch',
          entityKind: 'loan',
          entityId: loanId,
          message: 'outstandingPrincipal no concilia con el capital pagado en movements.',
          relatedIds: loanPayments.map((movement) => id(movement) ?? '[sin-id]'),
          evidence: { outstandingPrincipal: outstanding, expected },
        });
      }
    }
  }

  for (const installment of installments) {
    const installmentId = id(installment) ?? '[sin-id]';
    auditReference(
      installment,
      installmentId,
      'accountId',
      accountIds,
      'account',
      'installment_account_missing',
      add,
      'installmentpurchase',
    );

    const purchaseMovementId = text(installment['purchaseMovementId']);
    if (!purchaseMovementId) {
      add({
        severity: 'error',
        code: 'installment_purchase_link_missing',
        entityKind: 'installmentpurchase',
        entityId: installmentId,
        message: 'El plan de cuotas no declara el movimiento de compra que lo originó.',
        relatedIds: [],
      });
    } else {
      const purchase = movementsById.get(purchaseMovementId);
      if (!purchase) {
        add({
          severity: 'critical',
          code: 'installment_purchase_movement_missing',
          entityKind: 'installmentpurchase',
          entityId: installmentId,
          message: 'El movimiento de compra enlazado por el plan de cuotas no existe.',
          relatedIds: [purchaseMovementId],
        });
      } else if (
        text(purchase['installmentPurchaseId']) !== installmentId ||
        text(purchase['operationType']) !== 'CreditPurchase'
      ) {
        add({
          severity: 'error',
          code: 'installment_purchase_link_inconsistent',
          entityKind: 'installmentpurchase',
          entityId: installmentId,
          message: 'El enlace entre el plan y su movimiento de compra no es bidireccional o no es CreditPurchase.',
          relatedIds: [purchaseMovementId],
          evidence: {
            movementInstallmentPurchaseId: purchase['installmentPurchaseId'] ?? null,
            movementOperationType: purchase['operationType'] ?? null,
          },
        });
      }
    }

    const linkedPurchases = movements.filter(
      (movement) =>
        text(movement['installmentPurchaseId']) === installmentId &&
        text(movement['operationType']) === 'CreditPurchase',
    );
    if (linkedPurchases.length === 0) {
      add({
        severity: 'critical',
        code: 'installment_credit_purchase_missing',
        entityKind: 'installmentpurchase',
        entityId: installmentId,
        message: 'El plan de cuotas no tiene una compra CreditPurchase enlazada.',
        relatedIds: [],
      });
    } else if (linkedPurchases.length > 1) {
      add({
        severity: 'error',
        code: 'installment_multiple_credit_purchases',
        entityKind: 'installmentpurchase',
        entityId: installmentId,
        message: 'Más de una compra reclama el mismo plan de cuotas; el caso es ambiguo.',
        relatedIds: linkedPurchases.map((movement) => id(movement) ?? '[sin-id]'),
        evidence: { count: linkedPurchases.length },
      });
    }
    const paidCount = finiteNumber(installment['paidCount']);
    const paymentIds = new Set(
      movements
        .filter(
          (movement) =>
            text(movement['installmentPurchaseId']) === installmentId
            && text(movement['operationType']) === 'CreditPayment',
        )
        .map((movement) => text(movement['operationId']))
        .filter((value): value is string => Boolean(value)),
    );
    if (paidCount !== null && paidCount !== paymentIds.size) {
      add({
        severity: 'error',
        code: 'installment_payment_count_mismatch',
        entityKind: 'installmentpurchase',
        entityId: installmentId,
        message: 'paidCount no coincide con los pagos CreditPayment enlazados.',
        relatedIds: [...paymentIds],
        evidence: { paidCount, linkedPayments: paymentIds.size },
      });
    }
  }

  auditPairedOperations(movements, add);

  findings.sort(
    (left, right) =>
      SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity] ||
      left.code.localeCompare(right.code) ||
      left.entityKind.localeCompare(right.entityKind) ||
      left.entityId.localeCompare(right.entityId),
  );
  const byCodeMap = new Map<string, { severity: LocalAuditSeverity; count: number }>();
  for (const finding of findings) {
    const current = byCodeMap.get(finding.code);
    byCodeMap.set(finding.code, { severity: finding.severity, count: (current?.count ?? 0) + 1 });
  }

  return {
    reportVersion: 1,
    readOnly: true,
    scanned: {
      movements: input.movements.length,
      accounts: input.accounts.length,
      categories: input.categories.length,
      loans: input.loans.length,
      installmentPurchases: input.installmentPurchases.length,
    },
    summary: {
      total: findings.length,
      critical: findings.filter((finding) => finding.severity === 'critical').length,
      error: findings.filter((finding) => finding.severity === 'error').length,
      warning: findings.filter((finding) => finding.severity === 'warning').length,
      byCode: [...byCodeMap.entries()]
        .map(([code, value]) => ({ code, ...value }))
        .sort(
          (left, right) =>
            SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity] || left.code.localeCompare(right.code),
        ),
    },
    findings,
  };
}

function auditAmountBase(movement: LocalRecord, movementId: string, add: (finding: LocalAuditFinding) => void): void {
  const amount = finiteNumber(movement['amount']);
  const trmApplied = finiteNumber(movement['trmApplied']);
  const amountBase = finiteNumber(movement['amountBase']);
  const expected = amount !== null && trmApplied !== null ? amount * trmApplied : null;
  const tolerance = expected === null ? 0.01 : Math.max(0.01, Math.abs(expected) * 1e-9);
  if (
    amount === null ||
    amount <= 0 ||
    trmApplied === null ||
    trmApplied <= 0 ||
    amountBase === null ||
    expected === null ||
    Math.abs(amountBase - expected) > tolerance
  ) {
    add({
      severity: 'error',
      code: 'movement_amount_base_invalid',
      entityKind: 'movement',
      entityId: movementId,
      message: 'amountBase no coincide con amount × trmApplied o contiene valores no válidos.',
      relatedIds: [],
      evidence: {
        amount: movement['amount'] ?? null,
        trmApplied: movement['trmApplied'] ?? null,
        amountBase: movement['amountBase'] ?? null,
        expected,
      },
    });
  }
}

function auditReference(
  record: LocalRecord,
  recordId: string,
  field: string,
  targetIds: Set<string>,
  targetKind: LocalAuditFinding['entityKind'],
  code: string,
  add: (finding: LocalAuditFinding) => void,
  entityKind: LocalAuditFinding['entityKind'] = 'movement',
): void {
  const reference = text(record[field]);
  if (!reference || targetIds.has(reference)) return;
  add({
    severity: 'error',
    code,
    entityKind,
    entityId: recordId,
    message: `La referencia ${field} apunta a un ${targetKind} inexistente.`,
    relatedIds: [reference],
    evidence: { field, targetKind },
  });
}

function auditPairedOperations(movements: LocalRecord[], add: (finding: LocalAuditFinding) => void): void {
  const groups = new Map<string, LocalRecord[]>();
  for (const movement of movements) {
    const operationType = text(movement['operationType']);
    const operationId = text(movement['operationId']);
    if (operationType && PAIRED_OPERATION_TYPES.has(operationType) && !operationId) {
      add({
        severity: 'critical',
        code: 'paired_operation_id_missing',
        entityKind: 'movement',
        entityId: id(movement) ?? '[sin-id]',
        message: `El movimiento ${operationType} no declara operationId.`,
        relatedIds: [],
      });
    }
    if (!operationId) continue;
    const list = groups.get(operationId) ?? [];
    list.push(movement);
    groups.set(operationId, list);
  }

  for (const [operationId, group] of groups) {
    const pairTypes = [
      ...new Set(
        group
          .map((movement) => text(movement['operationType']))
          .filter((value): value is string => Boolean(value && PAIRED_OPERATION_TYPES.has(value))),
      ),
    ];
    if (pairTypes.length === 0) {
      if (group.some((movement) => text(movement['operationType']) === 'CreditInterest')) {
        add({
          severity: 'critical',
          code: 'credit_interest_payment_pair_missing',
          entityKind: 'operation',
          entityId: operationId,
          message: 'Existe interés de tarjeta sin el par de movimientos CreditPayment.',
          relatedIds: group.map((movement) => id(movement) ?? '[sin-id]'),
        });
      }
      continue;
    }
    if (pairTypes.length > 1) {
      add({
        severity: 'critical',
        code: 'paired_operation_types_mixed',
        entityKind: 'operation',
        entityId: operationId,
        message: 'La misma operationId mezcla tipos de operación pareada.',
        relatedIds: group.map((movement) => id(movement) ?? '[sin-id]'),
        evidence: { operationTypes: pairTypes },
      });
      continue;
    }

    const operationType = pairTypes[0];
    const legs = group.filter((movement) => text(movement['operationType']) === operationType);
    const expenseLegs = legs.filter((movement) => text(movement['type']) === 'Expense');
    const incomeLegs = legs.filter((movement) => text(movement['type']) === 'Income');
    if (legs.length !== 2 || expenseLegs.length !== 1 || incomeLegs.length !== 1) {
      add({
        severity: 'critical',
        code: 'paired_operation_incomplete',
        entityKind: 'operation',
        entityId: operationId,
        message: `La operación ${operationType} no tiene exactamente una salida y una entrada.`,
        relatedIds: legs.map((movement) => id(movement) ?? '[sin-id]'),
        evidence: { legs: legs.length, expenses: expenseLegs.length, incomes: incomeLegs.length },
      });
      continue;
    }

    const expense = expenseLegs[0];
    const income = incomeLegs[0];
    const expenseBase = finiteNumber(expense['amountBase']);
    const incomeBase = finiteNumber(income['amountBase']);
    const balanced =
      expenseBase !== null &&
      incomeBase !== null &&
      Math.abs(expenseBase - incomeBase) <= Math.max(0.01, Math.abs(expenseBase) * 1e-9) &&
      text(expense['currency']) === text(income['currency']) &&
      text(expense['accountId']) !== text(income['accountId']) &&
      Boolean(text(expense['accountId'])) &&
      Boolean(text(income['accountId']));
    if (!balanced) {
      add({
        severity: 'critical',
        code: 'paired_operation_unbalanced',
        entityKind: 'operation',
        entityId: operationId,
        message: `Las patas de ${operationType} no conservan monto, moneda o cuentas distintas.`,
        relatedIds: [id(expense) ?? '[sin-id]', id(income) ?? '[sin-id]'],
        evidence: {
          expenseAmountBase: expense['amountBase'] ?? null,
          incomeAmountBase: income['amountBase'] ?? null,
          expenseCurrency: expense['currency'] ?? null,
          incomeCurrency: income['currency'] ?? null,
          expenseAccountId: expense['accountId'] ?? null,
          incomeAccountId: income['accountId'] ?? null,
        },
      });
    }
  }
}

function records(values: unknown[]): LocalRecord[] {
  return values.filter(
    (value): value is LocalRecord => value !== null && typeof value === 'object' && !Array.isArray(value),
  );
}

function idSet(values: LocalRecord[]): Set<string> {
  return new Set(values.map(id).filter((value): value is string => Boolean(value)));
}

function id(value: LocalRecord): string | null {
  return text(value['id']);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
