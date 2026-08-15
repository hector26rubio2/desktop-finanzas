export interface FinancialSnapshot {
  baseCurrency: string;
  liquidAssets: number;
  creditCardDebt: number;
  loanDebt: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  accounts: Array<{
    accountId: string;
    name: string;
    type: 'Cash' | 'Debit' | 'Credit';
    currency: string;
    positionBase: number;
  }>;
}

export interface FinancialKpis {
  year: number;
  month: number;
  income: number;
  expense: number;
  net: number;
  incomeMomPercent: number;
  expenseMomPercent: number;
  incomeYoyPercent: number;
  expenseYoyPercent: number;
  savings: number;
  savingsRate: number;
  topExpenseCategories: Array<{
    categoryId: string | null;
    name: string;
    amountBase: number;
    sharePercent: number;
    momPercent: number;
  }>;
  averageDailyExpense: number;
  projectedMonthExpense: number;
  creditUtilizationPercent: number;

  creditCardsExcluded: number;
  creditCardsCounted: number;
  totalDebt: number;
  monthlyDebtService: number;
  financialBurdenPercent: number;
  runwayMonths: number;
}

export interface PortfolioAnalytics {
  baseCurrency: string;
  composition: Array<{ type: string; valueBase: number; percentOfAssets: number }>;
  evolution: Array<{ date: string; assets: number; liabilities: number; netWorth: number }>;
  investments: Array<{
    entityId: string;
    name: string;
    currentValueBase: number | null;
    netContributionsBase: number;
    feesBase: number;
    nominalReturnPercent: number | null;
    realReturnPercent: number | null;
    concentrationPercent: number;
    missingData: string[];
  }>;
}

export interface PortfolioOverview {
  baseCurrency: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  items: Array<{
    id: string;
    kind: 'Asset' | 'Liability';
    type: string;
    name: string;
    currency: string;
    institution: string | null;
    valueBase: number | null;
    valuationDate: string | null;
    valuationSource: string | null;
    legacyAccountId: string | null;
    legacyLoanId: string | null;
  }>;
}

export interface AccountingVerification {
  generatedAt: string;
  baseCurrency: string;
  tolerance: number;
  isReconciled: boolean;
  checks: Array<{ metric: string; served: number; recalculated: number; difference: number; matches: boolean }>;
}
