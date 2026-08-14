export interface MovementImportIssue {
  index: number;
  code: string;
  message: string;
}

export interface NormalizedImportedMovement {
  id: string;
  type: 'Income' | 'Expense';
  subType: 'Income' | 'Expense' | 'LoanReceived' | 'LoanGiven' | 'Saving' | null;
  sourceType: 'Cash' | 'OwnAccount' | 'CreditCard' | 'Loan' | null;
  loanParty: string | null;
  loanInstallments: number | null;
  loanInterestRate: number | null;
  amount: number;
  currency: string;
  trmApplied: number;
  amountBase: number;
  date: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  accountId: string | null;
  accountName: string | null;
  installmentPurchaseId: string | null;
  operationId: string | null;
  operationType:
    | 'Transfer'
    | 'CreditPurchase'
    | 'CreditPayment'
    | 'CreditInterest'
    | 'LoanDisbursement'
    | 'LoanPayment'
    | 'Saving'
    | null;
  loanId: string | null;
  principalComponent: number | null;
  interestComponent: number | null;
  portfolioEntityId: string | null;
  portfolioType: string | null;
  createdAt: string;
  importHash: string;
}

export interface MovementImportPreview {
  payloadHash: string;
  valid: number;
  invalid: number;
  alreadyApplied: number;
  newCount: number;
  newMovements: NormalizedImportedMovement[];
  issues: MovementImportIssue[];
}

interface NormalizedCandidate {
  index: number;
  movement: NormalizedImportedMovement;
  contentHash: string;
}

interface FailedCandidate {
  issues: MovementImportIssue[];
}

const SUB_TYPES = new Map([
  ['income', 'Income'],
  ['expense', 'Expense'],
  ['loanreceived', 'LoanReceived'],
  ['loangiven', 'LoanGiven'],
  ['saving', 'Saving'],
] as const);

const SOURCE_TYPES = new Map([
  ['cash', 'Cash'],
  ['ownaccount', 'OwnAccount'],
  ['creditcard', 'CreditCard'],
  ['loan', 'Loan'],
] as const);

const OPERATION_TYPES = new Map([
  ['transfer', 'Transfer'],
  ['creditpurchase', 'CreditPurchase'],
  ['creditpayment', 'CreditPayment'],
  ['creditinterest', 'CreditInterest'],
  ['loandisbursement', 'LoanDisbursement'],
  ['loanpayment', 'LoanPayment'],
  ['saving', 'Saving'],
] as const);

export function extractMovementRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const data = (value as Record<string, unknown>)['data'];
  return Array.isArray(data) ? data : [];
}

export function parseMovementCsv(text: string): unknown[] {
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  const pushRow = () => {
    row.push(cell);
    if (row.some((value) => value.trim() !== '')) matrix.push(row);
    row = [];
    cell = '';
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index++;
      pushRow();
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error('csv_unclosed_quote');
  if (cell !== '' || row.length > 0) pushRow();
  if (matrix.length === 0) return [];

  const headers = matrix[0].map((value, index) => (index === 0 ? value.replace(/^\uFEFF/, '') : value).trim());
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length)
    throw new Error('csv_invalid_header');

  return matrix
    .slice(1)
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])));
}

export async function prepareMovementImport(rows: unknown[], existingRows: unknown[]): Promise<MovementImportPreview> {
  if (rows.length === 0) {
    return {
      payloadHash: await stableHash('empty-import'),
      valid: 0,
      invalid: 1,
      alreadyApplied: 0,
      newCount: 0,
      newMovements: [],
      issues: [{ index: -1, code: 'empty_import', message: 'El archivo no contiene movimientos.' }],
    };
  }

  const existingById = new Map<string, string | null>();
  const existingHashes = new Set<string>();

  for (const row of existingRows) {
    const record = asRecord(row);
    const id = record ? optionalText(record['id']) : null;
    if (!id) continue;
    const normalized = await normalizeCandidate(row, -1);
    const storedHash = record ? optionalText(record['importHash']) : null;
    const contentHash = isCandidate(normalized)
      ? normalized.contentHash
      : storedHash && /^[a-f0-9]{64}$/i.test(storedHash)
        ? storedHash.toLowerCase()
        : null;
    existingById.set(id, contentHash);
    if (contentHash) existingHashes.add(contentHash);
  }

  const normalized = await Promise.all(rows.map((row, index) => normalizeCandidate(row, index + 1)));
  const newMovements: NormalizedImportedMovement[] = [];
  const issues: MovementImportIssue[] = [];
  const seenIds = new Map<string, string>();
  const seenHashes = new Set<string>();
  const payloadParts: string[] = [];
  let alreadyApplied = 0;

  for (const candidate of normalized) {
    if (!isCandidate(candidate)) {
      issues.push(...candidate.issues);
      payloadParts.push(...candidate.issues.map((issue) => `invalid:${issue.code}`));
      continue;
    }

    const { movement, contentHash } = candidate;
    payloadParts.push(contentHash);
    const existingIdHash = existingById.get(movement.id);
    if (existingById.has(movement.id)) {
      if (existingIdHash === contentHash) {
        alreadyApplied++;
      } else {
        issues.push({
          index: candidate.index,
          code: 'movement_id_conflict',
          message: `El ID ${movement.id} ya existe con otro contenido.`,
        });
      }
      continue;
    }
    if (existingHashes.has(contentHash)) {
      alreadyApplied++;
      continue;
    }

    const seenIdHash = seenIds.get(movement.id);
    if (seenIdHash !== undefined) {
      if (seenIdHash === contentHash) alreadyApplied++;
      else
        issues.push({
          index: candidate.index,
          code: 'movement_id_conflict',
          message: `El ID ${movement.id} se repite con contenido diferente dentro del archivo.`,
        });
      continue;
    }
    if (seenHashes.has(contentHash)) {
      alreadyApplied++;
      continue;
    }

    seenIds.set(movement.id, contentHash);
    seenHashes.add(contentHash);
    newMovements.push(movement);
  }

  const payloadHash = await stableHash([...payloadParts].sort().join('\n'));
  const invalidRows = new Set(issues.map((issue) => issue.index)).size;
  return {
    payloadHash,
    valid: rows.length - invalidRows,
    invalid: invalidRows,
    alreadyApplied,
    newCount: newMovements.length,
    newMovements,
    issues,
  };
}

async function normalizeCandidate(raw: unknown, rowIndex: number): Promise<NormalizedCandidate | FailedCandidate> {
  const record = asRecord(raw);
  if (!record) return { issues: [{ index: rowIndex, code: 'invalid_row', message: 'La fila debe ser un objeto.' }] };

  const issues: MovementImportIssue[] = [];
  const type = normalizeRequiredEnum(
    record['type'],
    new Map([
      ['income', 'Income'],
      ['expense', 'Expense'],
    ] as const),
  );
  if (!type) issues.push({ index: rowIndex, code: 'invalid_type', message: 'type debe ser Income o Expense.' });

  const amount = positiveNumber(record['amount']);
  if (amount === null)
    issues.push({ index: rowIndex, code: 'invalid_amount', message: 'amount debe ser mayor que cero.' });

  const currency = optionalText(record['currency'])?.toUpperCase() ?? null;
  if (!currency || !/^[A-Z]{3}$/.test(currency))
    issues.push({ index: rowIndex, code: 'invalid_currency', message: 'currency debe ser un código ISO de 3 letras.' });

  const trmApplied = positiveNumber(record['trmApplied']);
  if (trmApplied === null)
    issues.push({ index: rowIndex, code: 'invalid_trm', message: 'trmApplied debe ser mayor que cero.' });

  const date = normalizeIsoDate(record['date']);
  if (!date) issues.push({ index: rowIndex, code: 'invalid_date', message: 'date debe ser una fecha ISO válida.' });

  const explicitId = optionalText(record['id']);
  if (record['id'] !== undefined && record['id'] !== null && typeof record['id'] !== 'string')
    issues.push({ index: rowIndex, code: 'invalid_id', message: 'id debe ser texto cuando está presente.' });

  const subType = normalizeOptionalEnum(record['subType'], SUB_TYPES, issues, rowIndex, 'subType');
  const sourceType = normalizeOptionalEnum(record['sourceType'], SOURCE_TYPES, issues, rowIndex, 'sourceType');
  const operationType = normalizeOptionalEnum(
    record['operationType'],
    OPERATION_TYPES,
    issues,
    rowIndex,
    'operationType',
  );
  const loanInstallments = optionalInteger(record['loanInstallments'], issues, rowIndex, 'loanInstallments');
  const loanInterestRate = optionalNonNegative(record['loanInterestRate'], issues, rowIndex, 'loanInterestRate');
  const principalComponent = optionalNonNegative(record['principalComponent'], issues, rowIndex, 'principalComponent');
  const interestComponent = optionalNonNegative(record['interestComponent'], issues, rowIndex, 'interestComponent');

  if (issues.length > 0 || !type || amount === null || !currency || trmApplied === null || !date) return { issues };

  const content = {
    type,
    subType,
    sourceType,
    loanParty: optionalText(record['loanParty']),
    loanInstallments,
    loanInterestRate,
    amount,
    currency,
    trmApplied,
    amountBase: normalizeProduct(amount, trmApplied),
    date,
    description: optionalText(record['description']),
    categoryId: optionalText(record['categoryId']),
    accountId: optionalText(record['accountId']),
    installmentPurchaseId: optionalText(record['installmentPurchaseId']),
    operationId: optionalText(record['operationId']),
    operationType,
    loanId: optionalText(record['loanId']),
    principalComponent,
    interestComponent,
    portfolioEntityId: optionalText(record['portfolioEntityId']),
    portfolioType: optionalText(record['portfolioType']),
  };
  const contentHash = await stableHash(canonicalStringify(content));
  const id = explicitId ?? `import-${contentHash.slice(0, 32)}`;
  const createdAt = normalizeIsoDate(record['createdAt']) ?? date;

  // El documento se construye desde una lista blanca. El ID calculado se asigna
  // después del contenido normalizado y nunca puede ser sustituido por el input.
  const movement: NormalizedImportedMovement = {
    ...content,
    categoryName: optionalText(record['categoryName']),
    categoryColor: optionalText(record['categoryColor']),
    categoryIcon: optionalText(record['categoryIcon']),
    accountName: optionalText(record['accountName']),
    createdAt,
    id,
    importHash: contentHash,
  };
  return { index: rowIndex, movement, contentHash };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function positiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN;
  return Number.isFinite(result) && result > 0 ? result : null;
}

function optionalNonNegative(
  value: unknown,
  issues: MovementImportIssue[],
  index: number,
  field: string,
): number | null {
  if (value === null || value === undefined || value === '') return null;
  const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN;
  if (!Number.isFinite(result) || result < 0) {
    issues.push({ index, code: `invalid_${field}`, message: `${field} debe ser un número mayor o igual a cero.` });
    return null;
  }
  return result;
}

function optionalInteger(value: unknown, issues: MovementImportIssue[], index: number, field: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN;
  if (!Number.isInteger(result) || result <= 0) {
    issues.push({ index, code: `invalid_${field}`, message: `${field} debe ser un entero mayor que cero.` });
    return null;
  }
  return result;
}

function normalizeRequiredEnum<T extends string>(value: unknown, values: ReadonlyMap<string, T>): T | null {
  const text = optionalText(value)?.toLowerCase();
  return text ? (values.get(text) ?? null) : null;
}

function normalizeOptionalEnum<T extends string>(
  value: unknown,
  values: ReadonlyMap<string, T>,
  issues: MovementImportIssue[],
  index: number,
  field: string,
): T | null {
  if (value === null || value === undefined || value === '') return null;
  const normalized = normalizeRequiredEnum(value, values);
  if (!normalized)
    issues.push({ index, code: `invalid_${field}`, message: `${field} contiene un valor no soportado.` });
  return normalized;
}

function normalizeProduct(amount: number, trm: number): number {
  return Number((amount * trm).toPrecision(15));
}

function normalizeIsoDate(value: unknown): string | null {
  const text = optionalText(value);
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(
    text,
  );
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, millisText, zone] = match;
  const year = Number(yearText),
    month = Number(monthText),
    day = Number(dayText);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day)
    return null;
  if (!hourText) return `${yearText}-${monthText}-${dayText}`;

  const hour = Number(hourText),
    minute = Number(minuteText),
    second = Number(secondText ?? '0');
  if (hour > 23 || minute > 59 || second > 59) return null;
  const milliseconds = (millisText ?? '').padEnd(3, '0');
  const local = `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${String(second).padStart(2, '0')}${milliseconds ? `.${milliseconds}` : ''}`;
  if (!zone) return local;
  const parsed = new Date(`${local}${zone}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function stableHash(value: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  // Electron moderno ofrece Web Crypto. Este fallback conserva estabilidad en
  // entornos de prueba/reparación antiguos sin convertir el ID en aleatorio.
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f, 0x165667b1, 0xd3a2646c, 0xfd7046c5];
  return seeds
    .map((seed) => {
      let hash = seed >>> 0;
      for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
      return hash.toString(16).padStart(8, '0');
    })
    .join('');
}

function isCandidate(value: NormalizedCandidate | FailedCandidate): value is NormalizedCandidate {
  return 'movement' in value;
}
