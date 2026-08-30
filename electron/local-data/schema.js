const { sqliteTable, text, integer, real, index } = require('drizzle-orm/sqlite-core');

const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
};

const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  currency: text('currency').notNull(),
  bank: text('bank'),
  lastFour: text('last_four'),
  creditLimit: real('credit_limit'),
  billingDay: integer('billing_day'),
  paymentDay: integer('payment_day'),
  interestRate: real('interest_rate'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
});

const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  type: text('type').notNull(),
  translations: text('translations', { mode: 'json' }),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
});

const operations = sqliteTable('operations', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  date: text('date').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
});

const loans = sqliteTable(
  'loans',
  {
    id: text('id').primaryKey(),
    description: text('description').notNull(),
    party: text('party'),
    purpose: text('purpose'),
    direction: text('direction').notNull().default('Taken'),
    principal: real('principal').notNull(),
    currency: text('currency').notNull(),
    trmApplied: real('trm_applied').notNull().default(1),
    interestRateAnnual: real('interest_rate_annual').notNull(),
    termMonths: integer('term_months').notNull(),
    startDate: text('start_date').notNull(),
    loanType: text('loan_type').notNull().default('French'),
    accountId: text('account_id').references(() => accounts.id),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
  },
  (t) => [index('ix_loans_active').on(t.isActive)],
);

const installmentPurchases = sqliteTable(
  'installment_purchases',
  {
    id: text('id').primaryKey(),
    description: text('description').notNull(),
    accountId: text('account_id').references(() => accounts.id),
    purchaseMovementId: text('purchase_movement_id'),
    interestRatePercent: real('interest_rate_percent'),
    totalAmount: real('total_amount').notNull(),
    currency: text('currency').notNull(),
    trmApplied: real('trm_applied').notNull().default(1),
    installmentsCount: integer('installments_count').notNull(),
    startDate: text('start_date').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
  },
  (t) => [index('ix_installments_active').on(t.isActive)],
);

const recurringTransactions = sqliteTable(
  'recurring_transactions',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    recurringType: text('recurring_type'),
    amount: real('amount').notNull(),
    currency: text('currency').notNull(),
    trmApplied: real('trm_applied').notNull().default(1),
    categoryId: text('category_id').references(() => categories.id),
    accountId: text('account_id').references(() => accounts.id),
    description: text('description'),
    frequency: text('frequency').notNull(),
    interval: integer('interval').notNull().default(1),
    dayOfMonth: integer('day_of_month'),
    dayOfWeek: integer('day_of_week'),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    lastRunAt: text('last_run_at'),
    nextRunAt: text('next_run_at').notNull(),
    ...timestamps,
  },
  (t) => [index('ix_recurring_next').on(t.isActive, t.nextRunAt)],
);

const instrumentTypes = sqliteTable('instrument_types', {
  code: text('code').primaryKey(),
  label: text('label').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

const portfolioEntities = sqliteTable(
  'portfolio_entities',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    type: text('type').notNull(),
    instrumentType: text('instrument_type').references(() => instrumentTypes.code),
    symbol: text('symbol'),
    riskLevel: text('risk_level'),
    name: text('name').notNull(),
    currency: text('currency').notNull(),
    institution: text('institution'),
    accountId: text('account_id').references(() => accounts.id),
    loanId: text('loan_id').references(() => loans.id),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
  },
  (t) => [index('ix_portfolio_kind').on(t.kind, t.isActive)],
);

const portfolioValuations = sqliteTable(
  'portfolio_valuations',
  {
    id: text('id').primaryKey(),
    portfolioEntityId: text('portfolio_entity_id')
      .notNull()
      .references(() => portfolioEntities.id),
    date: text('date').notNull(),
    amount: real('amount').notNull(),
    currency: text('currency').notNull(),
    trmApplied: real('trm_applied').notNull().default(1),
    amountBase: real('amount_base').notNull(),
    source: text('source').notNull(),
    externalReference: text('external_reference'),
    ...timestamps,
  },
  (t) => [index('ix_valuations_entity_date').on(t.portfolioEntityId, t.date)],
);

const creditCardTerms = sqliteTable('credit_card_terms', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id),
  purchaseApr: real('purchase_apr'),
  cashAdvanceApr: real('cash_advance_apr'),
  intlPurchaseApr: real('intl_purchase_apr'),
  minPaymentPct: real('min_payment_pct'),
  gracePeriodDays: integer('grace_period_days'),
  deferredDefaultApr: real('deferred_default_apr'),
  notes: text('notes'),
  ...timestamps,
});

const movements = sqliteTable(
  'movements',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    type: text('type').notNull(),
    kind: text('kind').notNull(),
    sourceType: text('source_type'),
    operationType: text('operation_type'),
    subType: text('sub_type'),
    investmentTransactionType: text('investment_transaction_type'),
    amount: real('amount').notNull(),
    currency: text('currency').notNull(),
    trmApplied: real('trm_applied').notNull().default(1),
    amountBase: real('amount_base').notNull(),
    description: text('description'),
    categoryId: text('category_id').references(() => categories.id),
    accountId: text('account_id').references(() => accounts.id),
    operationId: text('operation_id').references(() => operations.id),
    loanId: text('loan_id').references(() => loans.id),
    installmentPurchaseId: text('installment_purchase_id').references(() => installmentPurchases.id),
    installmentNumber: integer('installment_number'),
    principalComponent: real('principal_component'),
    interestComponent: real('interest_component'),
    recurringTransactionId: text('recurring_transaction_id').references(() => recurringTransactions.id),
    portfolioEntityId: text('portfolio_entity_id').references(() => portfolioEntities.id),
    loanParty: text('loan_party'),
    loanInstallments: integer('loan_installments'),
    loanInterestRate: real('loan_interest_rate'),
    ...timestamps,
  },
  (t) => [
    index('ix_movements_date').on(t.date),
    index('ix_movements_kind').on(t.kind),
    index('ix_movements_account').on(t.accountId),
    index('ix_movements_category').on(t.categoryId),
    index('ix_movements_operation').on(t.operationId),
    index('ix_movements_loan').on(t.loanId),
    index('ix_movements_installment').on(t.installmentPurchaseId),
    index('ix_movements_portfolio').on(t.portfolioEntityId),
  ],
);

const investmentTransactions = sqliteTable(
  'investment_transactions',
  {
    id: text('id').primaryKey(),
    portfolioEntityId: text('portfolio_entity_id')
      .notNull()
      .references(() => portfolioEntities.id),
    movementId: text('movement_id').references(() => movements.id),
    type: text('type').notNull(),
    quantity: real('quantity'),
    unitPrice: real('unit_price'),
    feeAmountBase: real('fee_amount_base').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('ix_investxn_entity').on(t.portfolioEntityId)],
);

module.exports = {
  accounts,
  categories,
  operations,
  loans,
  installmentPurchases,
  recurringTransactions,
  instrumentTypes,
  portfolioEntities,
  portfolioValuations,
  creditCardTerms,
  movements,
  investmentTransactions,
};
