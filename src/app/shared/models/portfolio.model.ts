export type PortfolioEntityKind = 'Asset' | 'Liability';
export type PortfolioEntityType =
  | 'Cash'
  | 'BankAccount'
  | 'CreditCard'
  | 'Loan'
  | 'Investment'
  | 'OtherAsset'
  | 'OtherLiability';
export type PortfolioValuationSource = 'MovementLedger' | 'ContractBalance' | 'MarketPrice' | 'Manual';
export type InvestmentTransactionType = 'Contribution' | 'Withdrawal' | 'Buy' | 'Sell' | 'Fee';

/** Local aggregate. Numeric enum values are accepted for old API snapshots. */
export interface PortfolioEntityDocument {
  id: string;
  userId?: string;
  kind: PortfolioEntityKind | 0 | 1;
  type: PortfolioEntityType | 0 | 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  currency: string;
  institution: string | null;
  legacyAccountId: string | null;
  legacyLoanId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface PortfolioValuationDocument {
  id: string;
  portfolioEntityId: string;
  date: string;
  amount: number;
  currency: string;
  trmApplied: number;
  amountBase: number;
  source: PortfolioValuationSource | 0 | 1 | 2 | 3;
  externalReference: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface InvestmentTransactionDocument {
  id: string;
  portfolioEntityId: string;
  movementId: string;
  type: InvestmentTransactionType | 0 | 1 | 2 | 3 | 4;
  quantity: number | null;
  unitPrice: number | null;
  feeAmountBase: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateInvestmentRequest {
  name: string;
  currency: string;
  institution?: string | null;
}

export interface AddPortfolioValuationRequest {
  date: string;
  amount: number;
  currency: string;
  trmApplied: number;
  source: 'MarketPrice' | 'Manual';
  externalReference?: string | null;
}

export interface AddInvestmentTransactionRequest {
  movementId: string;
  type: InvestmentTransactionType;
  quantity?: number | null;
  unitPrice?: number | null;
  feeAmountBase?: number;
}

export interface PortfolioItem {
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
}
export interface PortfolioOverview {
  baseCurrency: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  items: PortfolioItem[];
}
