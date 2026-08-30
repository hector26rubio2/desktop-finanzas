import type { DynamicField } from '../ui/organisms/dynamic-form/dynamic-form.component';

export interface EntityFormOptions {
  categories?: Array<{ value: string; label: string }>;
  accounts?: Array<{ value: string; label: string }>;
  creditAccounts?: Array<{ value: string; label: string }>;
  instrumentTypes?: Array<{ value: string; label: string }>;
  baseCurrency?: string;
}

const CURRENCIES = ['COP', 'ARS', 'USD', 'EUR'];
const currencyField = (): DynamicField => ({
  key: 'currency',
  label: 'Moneda',
  type: 'select',
  options: CURRENCIES.map((value) => ({ value, label: value })),
});
const trmField = (baseCurrency = 'COP'): DynamicField => ({
  key: 'trmApplied',
  label: `TRM a ${baseCurrency}`,
  type: 'number',
  min: 0.000001,
  step: 0.000001,
  visibleWhen: (v) => v['currency'] !== baseCurrency,
});

export function accountFormFields(): DynamicField[] {
  const isCredit = (v: Record<string, unknown>) => v['type'] === 'Credit';
  return [
    { key: 'name', label: 'Nombre', type: 'text', fullWidth: true },
    {
      key: 'type',
      label: 'Tipo',
      type: 'select',
      options: [
        { value: 'Cash', label: 'Efectivo' },
        { value: 'Debit', label: 'Débito' },
        { value: 'Credit', label: 'Crédito' },
      ],
    },
    currencyField(),
    { key: 'bank', label: 'Banco', type: 'text' },
    { key: 'lastFour', label: 'Últimos 4 dígitos', type: 'text', visibleWhen: isCredit },
    { key: 'creditLimit', label: 'Cupo', type: 'number', min: 0, visibleWhen: isCredit },
    { key: 'billingDay', label: 'Día de corte', type: 'number', min: 1, max: 31, visibleWhen: isCredit },
    { key: 'paymentDay', label: 'Día de pago', type: 'number', min: 1, max: 31, visibleWhen: isCredit },
    {
      key: 'interestRate',
      label: 'Tasa de interés (%)',
      type: 'number',
      min: 0,
      max: 1000,
      step: 0.01,
      visibleWhen: isCredit,
    },
    { key: 'isDefault', label: 'Cuenta por defecto', type: 'checkbox' },
  ];
}

export function loanFormFields(o: EntityFormOptions = {}): DynamicField[] {
  return [
    { key: 'description', label: 'Descripción', type: 'text', fullWidth: true },
    {
      key: 'direction',
      label: 'Dirección',
      type: 'select',
      options: [
        { value: 'Taken', label: 'Tomado (yo debo)' },
        { value: 'Given', label: 'Otorgado (me deben)' },
      ],
    },
    {
      key: 'purpose',
      label: 'Propósito',
      type: 'select',
      options: [
        { value: 'FreeInvestment', label: 'Libre inversión' },
        { value: 'Mortgage', label: 'Hipotecario' },
        { value: 'Vehicle', label: 'Vehículo' },
        { value: 'Personal', label: 'Personal' },
        { value: 'Education', label: 'Educativo' },
        { value: 'Other', label: 'Otro' },
      ],
    },
    { key: 'party', label: 'Contraparte', type: 'text' },
    { key: 'principal', label: 'Capital', type: 'number', min: 0.01, step: 0.01 },
    currencyField(),
    trmField(o.baseCurrency),
    { key: 'interestRateAnnual', label: 'Tasa anual (%)', type: 'number', min: 0, max: 1000, step: 0.01 },
    { key: 'termMonths', label: 'Plazo (meses)', type: 'number', min: 1, max: 600 },
    { key: 'startDate', label: 'Fecha de inicio', type: 'date' },
    {
      key: 'loanType',
      label: 'Sistema de amortización',
      type: 'select',
      options: [
        { value: 'French', label: 'Francés' },
        { value: 'German', label: 'Alemán' },
        { value: 'American', label: 'Americano' },
      ],
    },
    {
      key: 'accountId',
      label: 'Cuenta destino',
      type: 'select',
      options: [{ value: '', label: 'Sin cuenta' }, ...(o.accounts ?? [])],
    },
  ];
}

export function creditCardTermsFormFields(o: EntityFormOptions = {}): DynamicField[] {
  return [
    { key: 'accountId', label: 'Tarjeta', type: 'select', options: o.creditAccounts ?? [] },
    { key: 'purchaseApr', label: 'Interés compras (% E.A.)', type: 'number', min: 0, max: 1000, step: 0.01 },
    { key: 'cashAdvanceApr', label: 'Interés avances (% E.A.)', type: 'number', min: 0, max: 1000, step: 0.01 },
    { key: 'intlPurchaseApr', label: 'Interés internacional (% E.A.)', type: 'number', min: 0, max: 1000, step: 0.01 },
    { key: 'minPaymentPct', label: 'Pago mínimo (%)', type: 'number', min: 0, max: 100, step: 0.1 },
    { key: 'gracePeriodDays', label: 'Días de gracia', type: 'number', min: 0, max: 60 },
    { key: 'notes', label: 'Notas', type: 'text' },
  ];
}

export function installmentFormFields(o: EntityFormOptions = {}): DynamicField[] {
  return [
    { key: 'description', label: 'Descripción', type: 'text' },
    {
      key: 'accountId',
      label: 'Tarjeta/Cuenta',
      type: 'select',
      options: [{ value: '', label: 'Sin cuenta' }, ...(o.accounts ?? [])],
    },
    { key: 'totalAmount', label: 'Monto total', type: 'number', min: 0.01, step: 0.01 },
    currencyField(),
    trmField(o.baseCurrency),
    { key: 'installmentsCount', label: 'Número de cuotas', type: 'number', min: 1, max: 60 },
    { key: 'interestRatePercent', label: 'Interés por cuota (%)', type: 'number', min: 0, max: 1000, step: 0.01 },
    { key: 'startDate', label: 'Fecha de compra', type: 'date' },
  ];
}

export function recurringFormFields(o: EntityFormOptions = {}): DynamicField[] {
  const isMonthly = (v: Record<string, unknown>) => v['frequency'] === 'Monthly';
  const isWeekly = (v: Record<string, unknown>) => v['frequency'] === 'Weekly';
  return [
    {
      key: 'type',
      label: 'Tipo',
      type: 'select',
      options: [
        { value: 'Expense', label: 'Gasto' },
        { value: 'Income', label: 'Ingreso' },
      ],
    },
    {
      key: 'recurringType',
      label: 'Clase',
      type: 'select',
      options: [
        { value: 'FixedExpense', label: 'Gasto fijo' },
        { value: 'Subscription', label: 'Suscripción' },
        { value: 'Rent', label: 'Arriendo' },
        { value: 'Utility', label: 'Servicio' },
        { value: 'Salary', label: 'Salario' },
        { value: 'Other', label: 'Otro' },
      ],
    },
    { key: 'amount', label: 'Monto', type: 'number', min: 0.01, step: 0.01 },
    currencyField(),
    trmField(o.baseCurrency),
    {
      key: 'categoryId',
      label: 'Categoría',
      type: 'select',
      options: [{ value: '', label: 'Sin categoría' }, ...(o.categories ?? [])],
    },
    {
      key: 'accountId',
      label: 'Cuenta',
      type: 'select',
      options: [{ value: '', label: 'Sin cuenta' }, ...(o.accounts ?? [])],
    },
    { key: 'description', label: 'Concepto', type: 'text' },
    {
      key: 'frequency',
      label: 'Frecuencia',
      type: 'select',
      options: [
        { value: 'Daily', label: 'Diaria' },
        { value: 'Weekly', label: 'Semanal' },
        { value: 'Monthly', label: 'Mensual' },
        { value: 'Yearly', label: 'Anual' },
      ],
    },
    { key: 'interval', label: 'Cada', type: 'number', min: 1 },
    { key: 'dayOfMonth', label: 'Día del mes', type: 'number', min: 1, max: 31, visibleWhen: isMonthly },
    { key: 'dayOfWeek', label: 'Día de la semana (0-6)', type: 'number', min: 0, max: 6, visibleWhen: isWeekly },
    { key: 'startDate', label: 'Inicio', type: 'date' },
    { key: 'endDate', label: 'Fin (opcional)', type: 'date' },
  ];
}

export function investmentFormFields(o: EntityFormOptions = {}): DynamicField[] {
  return [
    { key: 'name', label: 'Nombre', type: 'text' },
    {
      key: 'instrumentType',
      label: 'Instrumento',
      type: 'select',
      options: o.instrumentTypes ?? [
        { value: 'Stock', label: 'Acción' },
        { value: 'ETF', label: 'ETF' },
        { value: 'Fund', label: 'Fondo' },
        { value: 'Bond', label: 'Bono' },
        { value: 'Crypto', label: 'Cripto' },
        { value: 'Other', label: 'Otro' },
      ],
    },
    { key: 'symbol', label: 'Ticker/Símbolo', type: 'text' },
    currencyField(),
    { key: 'institution', label: 'Institución', type: 'text' },
    {
      key: 'riskLevel',
      label: 'Riesgo',
      type: 'select',
      options: [
        { value: 'Low', label: 'Bajo' },
        { value: 'Medium', label: 'Medio' },
        { value: 'High', label: 'Alto' },
      ],
    },
  ];
}

export function valuationFormFields(o: EntityFormOptions = {}): DynamicField[] {
  return [
    { key: 'date', label: 'Fecha', type: 'date' },
    { key: 'amount', label: 'Valor (moneda del activo)', type: 'number', min: 0.000001, step: 0.01 },
    currencyField(),
    {
      key: 'trmApplied',
      label: `TRM a ${o.baseCurrency ?? 'moneda base'}`,
      type: 'number',
      min: 0.000001,
      step: 0.000001,
    },
    {
      key: 'source',
      label: 'Fuente',
      type: 'select',
      options: [
        { value: 'Manual', label: 'Manual' },
        { value: 'MarketPrice', label: 'Precio de mercado' },
      ],
    },
    { key: 'externalReference', label: 'Referencia', type: 'text' },
  ];
}

export const ENTITY_FORM_SCHEMAS = {
  account: accountFormFields,
  loan: loanFormFields,
  creditCardTerms: creditCardTermsFormFields,
  installment: installmentFormFields,
  recurring: recurringFormFields,
  investment: investmentFormFields,
  valuation: valuationFormFields,
} as const;

export type EntityFormType = keyof typeof ENTITY_FORM_SCHEMAS;
