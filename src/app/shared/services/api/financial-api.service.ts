import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import type {
  AccountingVerification,
  FinancialSnapshot,
  FinancialKpis,
  PortfolioAnalytics,
  PortfolioOverview,
} from '../../models/financial.model';
import type { MovementResponse } from '../../models/movement.model';
import type { AccountResponse, AccountBalance } from '../../models/account.model';
import type { LoanResponse } from '../../models/loan.model';
import type { InstallmentResponse } from '../../models/installment.model';
import type {
  InvestmentTransactionDocument,
  InvestmentTransactionType,
  PortfolioEntityDocument,
  PortfolioEntityKind,
  PortfolioEntityType,
  PortfolioValuationDocument,
  PortfolioValuationSource,
} from '../../models/portfolio.model';
import { buildAmortization, roundMoney } from '../../utils/amortization';
import { financialFlowContribution } from '../../utils/financial-classification';
import { LocalDataRepository } from '../local/local-data.repository';
import { TokenService } from '../auth/token.service';

@Injectable({ providedIn: 'root' })
export class FinancialApiService {
  private local = inject(LocalDataRepository);
  private token = inject(TokenService);
  getSnapshot(): Observable<FinancialSnapshot> {
    return from(this.snapshot());
  }
  getKpis(yearMonth: string): Observable<FinancialKpis> {
    return from(this.kpis(yearMonth));
  }
  getPortfolioAnalytics(inflationPercentForPeriod = 0): Observable<PortfolioAnalytics> {
    return from(this.analytics(inflationPercentForPeriod));
  }
  getPortfolio(): Observable<PortfolioOverview> {
    return from(this.portfolio());
  }
  getReconciliation(): Observable<AccountingVerification> {
    return from(this.reconciliation());
  }
  private currency() {
    return this.token.currentUser()?.baseCurrency ?? 'COP';
  }
  private async movements() {
    return this.local.list<MovementResponse>('movement');
  }
  private period(items: MovementResponse[], ym: string) {
    return items.filter((x) => String(x.date).slice(0, 7) === ym);
  }
  private totals(items: MovementResponse[]) {
    return items.reduce(
      (totals, movement) => {
        const contribution = financialFlowContribution(movement);
        totals.income += contribution.income;
        totals.expense += contribution.expense;
        return totals;
      },
      { income: 0, expense: 0 },
    );
  }
  private shift(ym: string, months: number) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + months, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  private pct(current: number, previous: number) {
    return previous === 0 ? 0 : ((current - previous) / Math.abs(previous)) * 100;
  }
  private async snapshot(): Promise<FinancialSnapshot> {
    const [accounts, loans, portfolioEntities, valuations] = await Promise.all([
      this.local.list<AccountResponse>('account'),
      this.local.list<LoanResponse>('loan'),
      this.local.list<PortfolioEntityDocument>('portfolioentity'),
      this.local.list<PortfolioValuationDocument>('portfoliovaluation'),
    ]);
    const ids = accounts.map((x) => x.id);
    const balances = ids.length ? await this.local.accountBalances<Record<string, AccountBalance>>(ids) : {};
    const rows = accounts.map((a) => ({
      accountId: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      positionBase:
        a.type === 'Credit'
          ? -Math.max(
              0,
              Number(
                balances[a.id]?.outstandingDebtBase ??
                  balances[a.id]?.usedInCycleBase ??
                  balances[a.id]?.outstandingDebt ??
                  balances[a.id]?.usedInCycle ??
                  0,
              ),
            )
          : Number(balances[a.id]?.balanceBase ?? balances[a.id]?.balance ?? 0),
    }));
    const liquidAssets = rows.filter((x) => x.type !== 'Credit').reduce((s, x) => s + Math.max(0, x.positionBase), 0);
    const overdraftDebt = rows.filter((x) => x.type !== 'Credit').reduce((s, x) => s + Math.max(0, -x.positionBase), 0);
    const creditCardDebt = rows
      .filter((x) => x.type === 'Credit')
      .reduce((s, x) => s + Math.max(0, -x.positionBase), 0);
    const loanDebt = loans.reduce((s, x) => s + Number(x.outstandingPrincipal || 0) * Number(x.trmApplied || 1), 0);
    const portfolioPosition = this.valuedPortfolioPosition(portfolioEntities, valuations);
    const totalAssets = liquidAssets + portfolioPosition.assets;
    const totalLiabilities = overdraftDebt + creditCardDebt + loanDebt + portfolioPosition.liabilities;
    return {
      baseCurrency: this.currency(),
      liquidAssets,
      creditCardDebt,
      loanDebt,
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      accounts: rows,
    };
  }
  private async kpis(ym: string): Promise<FinancialKpis> {
    const all = await this.movements();
    const current = this.period(all, ym),
      previous = this.period(all, this.shift(ym, -1)),
      yoy = this.period(all, this.shift(ym, -12));
    const now = this.totals(current),
      prev = this.totals(previous),
      year = this.totals(yoy);
    const [yy, mm] = ym.split('-').map(Number);
    const savings = current
      .filter((x) => x.type === 'Expense' && (x.subType === 'Saving' || x.operationType === 'Saving'))
      .reduce((s, x) => s + Number(x.amountBase || 0), 0);
    const category = new Map<string, { categoryId: string | null; name: string; amountBase: number }>();
    for (const x of current) {
      const expense = financialFlowContribution(x).expense;
      if (expense <= 0) continue;
      const key = x.categoryId ?? 'none';
      const row = category.get(key) ?? {
        categoryId: x.categoryId,
        name: x.categoryName ?? 'Sin categoría',
        amountBase: 0,
      };
      row.amountBase += expense;
      category.set(key, row);
    }
    const previousCategory = new Map<string, number>();
    for (const x of previous) {
      const expense = financialFlowContribution(x).expense;
      if (expense <= 0) continue;
      previousCategory.set(x.categoryId ?? 'none', (previousCategory.get(x.categoryId ?? 'none') ?? 0) + expense);
    }
    const topExpenseCategories = [...category.entries()]
      .map(([key, x]) => ({
        ...x,
        sharePercent: now.expense ? (x.amountBase / now.expense) * 100 : 0,
        momPercent: this.pct(x.amountBase, previousCategory.get(key) ?? 0),
      }))
      .sort((a, b) => b.amountBase - a.amountBase)
      .slice(0, 5);
    const days = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    const today = new Date();
    const elapsed = today.getUTCFullYear() === yy && today.getUTCMonth() + 1 === mm ? today.getUTCDate() : days;
    const snapshot = await this.snapshot();
    const accounts = await this.local.list<AccountResponse>('account');
    const cardsWithLimit = accounts.filter((x) => x.type === 'Credit' && Number(x.creditLimit || 0) > 0);
    // El cupo está en la moneda de la tarjeta y no hay tasa declarada para
    // convertirlo, así que una tarjeta en otra moneda queda fuera entera —cupo y
    // deuda— en vez de mezclar unidades. Cuántas quedan fuera se informa abajo.
    const eligibleCards = cardsWithLimit.filter((x) => x.currency === snapshot.baseCurrency);
    const cardBalances = eligibleCards.length
      ? await this.local.accountBalances<Record<string, AccountBalance>>(eligibleCards.map((x) => x.id))
      : {};
    const creditUsed = eligibleCards.reduce(
      (s, x) =>
        s +
        Number(
          cardBalances[x.id]?.outstandingDebtBase ??
            cardBalances[x.id]?.usedInCycleBase ??
            cardBalances[x.id]?.outstandingDebt ??
            cardBalances[x.id]?.usedInCycle ??
            0,
        ),
      0,
    );
    const creditLimit = eligibleCards.reduce((s, x) => s + Number(x.creditLimit || 0), 0);
    const installments = await this.local.list<InstallmentResponse>('installmentpurchase');
    const monthlyInstallments = installments
      .filter((x) => x.isActive)
      .reduce((s, x) => s + Number(x.monthlyAmount || 0) * Number(x.trmApplied || 1), 0);
    const loans = await this.local.list<LoanResponse>('loan');
    const monthlyLoans = loans
      .filter((x) => x.isActive && x.remainingMonths > 0 && x.outstandingPrincipal > 0)
      .reduce((s, x) => {
        const payment =
          buildAmortization(x.outstandingPrincipal, x.interestRateAnnual, x.remainingMonths, x.startDate, x.loanType)[0]
            ?.payment ?? 0;
        return s + payment * Number(x.trmApplied || 1);
      }, 0);
    const last3Expense = [-1, -2, -3].map((n) => this.totals(this.period(all, this.shift(ym, n))).expense);
    const average3 = last3Expense.reduce((a, b) => a + b, 0) / 3;
    const monthlyDebtService = monthlyInstallments + monthlyLoans;
    return {
      year: yy,
      month: mm,
      income: now.income,
      expense: now.expense,
      net: now.income - now.expense,
      incomeMomPercent: this.pct(now.income, prev.income),
      expenseMomPercent: this.pct(now.expense, prev.expense),
      incomeYoyPercent: this.pct(now.income, year.income),
      expenseYoyPercent: this.pct(now.expense, year.expense),
      savings,
      savingsRate: now.income ? (savings / now.income) * 100 : 0,
      topExpenseCategories,
      averageDailyExpense: now.expense / Math.max(1, elapsed),
      projectedMonthExpense: (now.expense / Math.max(1, elapsed)) * days,
      creditUtilizationPercent: creditLimit ? (creditUsed / creditLimit) * 100 : 0,
      creditCardsCounted: eligibleCards.length,
      creditCardsExcluded: cardsWithLimit.length - eligibleCards.length,
      totalDebt: snapshot.totalLiabilities,
      monthlyDebtService,
      financialBurdenPercent: now.income ? (monthlyDebtService / now.income) * 100 : 0,
      runwayMonths: average3 ? snapshot.liquidAssets / average3 : 0,
    };
  }
  private async portfolio(): Promise<PortfolioOverview> {
    const snap = await this.snapshot();
    const [accounts, loans, portfolioEntities, valuations] = await Promise.all([
      this.local.list<AccountResponse>('account'),
      this.local.list<LoanResponse>('loan'),
      this.local.list<PortfolioEntityDocument>('portfolioentity'),
      this.local.list<PortfolioValuationDocument>('portfoliovaluation'),
    ]);
    const items: PortfolioOverview['items'] = snap.accounts.map((x) => {
      const a = accounts.find((v) => v.id === x.accountId)!;
      const isOverdraft = a.type !== 'Credit' && x.positionBase < 0;
      return {
        id: a.id,
        kind: a.type === 'Credit' || isOverdraft ? 'Liability' : 'Asset',
        type: a.type === 'Cash' ? 'Cash' : a.type === 'Debit' ? 'BankAccount' : 'CreditCard',
        name: a.name,
        currency: a.currency,
        institution: a.bank,
        valueBase: a.type === 'Credit' ? Math.max(0, -x.positionBase) : Math.abs(x.positionBase),
        valuationDate: new Date().toISOString().slice(0, 10),
        valuationSource: 'LocalMovements',
        legacyAccountId: a.id,
        legacyLoanId: null,
      };
    });
    for (const l of loans)
      items.push({
        id: l.id,
        kind: 'Liability',
        type: 'Loan',
        name: l.description,
        currency: l.currency,
        institution: l.party,
        valueBase: l.outstandingPrincipal * l.trmApplied,
        valuationDate: new Date().toISOString().slice(0, 10),
        valuationSource: 'LocalAmortization',
        legacyAccountId: null,
        legacyLoanId: l.id,
      });
    for (const entity of portfolioEntities.filter((item) => this.isStandalonePortfolioEntity(item))) {
      const latest = this.latestValuation(entity.id, valuations);
      items.push({
        id: entity.id,
        kind: this.entityKind(entity),
        type: this.entityType(entity),
        name: entity.name,
        currency: entity.currency,
        institution: entity.institution ?? null,
        valueBase: this.valuationAmount(latest),
        valuationDate: latest ? String(latest.date).slice(0, 10) : null,
        valuationSource: latest ? this.valuationSource(latest) : null,
        legacyAccountId: null,
        legacyLoanId: null,
      });
    }
    return {
      baseCurrency: snap.baseCurrency,
      totalAssets: snap.totalAssets,
      totalLiabilities: snap.totalLiabilities,
      netWorth: snap.netWorth,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
  private async analytics(inflation: number): Promise<PortfolioAnalytics> {
    const overview = await this.portfolio();
    const assetItems = overview.items.filter((x) => x.kind === 'Asset' && Number(x.valueBase || 0) > 0);
    const assetTotal = assetItems.reduce((s, x) => s + Number(x.valueBase || 0), 0);
    const composition = [...new Set(assetItems.map((x) => x.type))].map((type) => {
      const valueBase = assetItems.filter((x) => x.type === type).reduce((s, x) => s + Number(x.valueBase || 0), 0);
      return { type, valueBase, percentOfAssets: assetTotal ? (valueBase / assetTotal) * 100 : 0 };
    });
    const [all, accounts, loans, portfolioEntities, valuations, transactions] = await Promise.all([
      this.movements(),
      this.local.list<AccountResponse>('account'),
      this.local.list<LoanResponse>('loan'),
      this.local.list<PortfolioEntityDocument>('portfolioentity'),
      this.local.list<PortfolioValuationDocument>('portfoliovaluation'),
      this.local.list<InvestmentTransactionDocument>('investmenttransaction'),
    ]);
    const current = new Date();
    const evolution = Array.from({ length: 12 }, (_, i) => {
      const ym = this.shift(
        `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}`,
        i - 11,
      );
      const end = this.monthEnd(ym);
      const position = this.positionFromDocuments(accounts, loans, all, portfolioEntities, valuations, end);
      return {
        date: end,
        assets: position.totalAssets,
        liabilities: position.totalLiabilities,
        netWorth: position.netWorth,
      };
    });
    const movementById = new Map(all.map((movement) => [movement.id, movement]));
    const investments = portfolioEntities
      .filter((entity) => entity.isActive !== false && this.entityType(entity) === 'Investment')
      .map((entity) => {
        const latest = this.latestValuation(entity.id, valuations);
        const currentValueBase = this.valuationAmount(latest);
        const entityTransactions = transactions.filter((transaction) => transaction.portfolioEntityId === entity.id);
        let contributions = 0;
        let withdrawals = 0;
        let feesBase = 0;
        let missingMovements = 0;
        for (const transaction of entityTransactions) {
          const movement = movementById.get(transaction.movementId);
          const amountBase = Number(movement?.amountBase);
          if (!movement || !Number.isFinite(amountBase)) {
            missingMovements++;
            continue;
          }
          const type = this.transactionType(transaction);
          if (type === 'Contribution' || type === 'Buy') contributions += amountBase;
          if (type === 'Withdrawal' || type === 'Sell') withdrawals += amountBase;
          const explicitFee = Number(transaction.feeAmountBase);
          if (Number.isFinite(explicitFee) && explicitFee >= 0) feesBase += explicitFee;
          if (type === 'Fee') feesBase += amountBase;
        }
        const netContributionsBase = roundMoney(contributions - withdrawals);
        const nominalReturnPercent =
          contributions > 0 && currentValueBase !== null
            ? roundMoney(((currentValueBase + withdrawals - contributions - feesBase) / contributions) * 100)
            : null;
        const validInflation = Number.isFinite(inflation) && inflation > -100;
        const realReturnPercent =
          nominalReturnPercent !== null && validInflation
            ? roundMoney(((1 + nominalReturnPercent / 100) / (1 + inflation / 100) - 1) * 100)
            : null;
        const missingData: string[] = [];
        if (currentValueBase === null) missingData.push('current_valuation');
        if (contributions <= 0) missingData.push('contributions');
        if (!validInflation) missingData.push('inflation_for_period');
        if (missingMovements > 0) missingData.push('transaction_movements');
        return {
          entityId: entity.id,
          name: entity.name,
          currentValueBase,
          netContributionsBase,
          feesBase: roundMoney(feesBase),
          nominalReturnPercent,
          realReturnPercent,
          concentrationPercent:
            overview.totalAssets > 0 && currentValueBase !== null
              ? roundMoney((currentValueBase / overview.totalAssets) * 100)
              : 0,
          missingData,
        };
      });
    return { baseCurrency: overview.baseCurrency, composition, evolution, investments };
  }
  private async reconciliation(): Promise<AccountingVerification> {
    const s = await this.snapshot();
    const [accounts, loans, movements, portfolioEntities, valuations, transactions] = await Promise.all([
      this.local.list<AccountResponse>('account'),
      this.local.list<LoanResponse>('loan'),
      this.movements(),
      this.local.list<PortfolioEntityDocument>('portfolioentity'),
      this.local.list<PortfolioValuationDocument>('portfoliovaluation'),
      this.local.list<InvestmentTransactionDocument>('investmenttransaction'),
    ]);
    const recalculated = this.positionFromDocuments(accounts, loans, movements, portfolioEntities, valuations);
    const servedOverdraft = s.accounts
      .filter((account) => account.type !== 'Credit')
      .reduce((sum, account) => sum + Math.max(0, -account.positionBase), 0);
    const servedPortfolioAssets = Math.max(0, s.totalAssets - s.liquidAssets);
    const servedPortfolioLiabilities = Math.max(
      0,
      s.totalLiabilities - servedOverdraft - s.creditCardDebt - s.loanDebt,
    );
    let unverifiableMovementCount = 0;
    const amountBaseError = movements.reduce((sum, movement) => {
      const amount = Number(movement.amount);
      const rate = Number(movement.trmApplied);
      const stored = Number(movement.amountBase);
      if (![amount, rate, stored].every(Number.isFinite)) {
        unverifiableMovementCount++;
        return sum;
      }
      return sum + Math.abs(stored - amount * rate);
    }, 0);
    const standaloneEntities = portfolioEntities.filter((entity) => this.isStandalonePortfolioEntity(entity));
    const activePortfolioIds = new Set(standaloneEntities.map((entity) => entity.id));
    const relevantValuations = valuations.filter((valuation) => activePortfolioIds.has(valuation.portfolioEntityId));
    let unverifiableValuationCount = 0;
    const portfolioAmountBaseError = relevantValuations.reduce((sum, valuation) => {
      const amount = Number(valuation.amount);
      const rate = Number(valuation.trmApplied);
      const stored = Number(valuation.amountBase);
      if (![amount, rate, stored].every(Number.isFinite) || amount < 0 || rate <= 0 || stored < 0) {
        unverifiableValuationCount++;
        return sum;
      }
      return sum + Math.abs(stored - amount * rate);
    }, 0);
    const unvaluedPortfolioEntities = standaloneEntities.filter(
      (entity) => this.valuationAmount(this.latestValuation(entity.id, valuations)) === null,
    ).length;
    const movementById = new Map(movements.map((movement) => [movement.id, movement]));
    const investmentIds = new Set(
      portfolioEntities
        .filter((entity) => entity.isActive !== false && this.entityType(entity) === 'Investment')
        .map((entity) => entity.id),
    );
    const seenTransactionMovements = new Set<string>();
    let investmentTransactionIssues = 0;
    for (const transaction of transactions) {
      const movement = movementById.get(transaction.movementId);
      const type = this.transactionType(transaction);
      const expectedDirection = ['Contribution', 'Buy', 'Fee'].includes(type) ? 'Expense' : 'Income';
      if (
        !investmentIds.has(transaction.portfolioEntityId) ||
        !movement ||
        movement.portfolioEntityId !== transaction.portfolioEntityId ||
        movement.investmentTransactionType !== type ||
        movement.type !== expectedDirection ||
        seenTransactionMovements.has(transaction.movementId)
      )
        investmentTransactionIssues++;
      seenTransactionMovements.add(transaction.movementId);
    }
    const tolerance = 0.01;
    const check = (metric: string, served: number, expected: number) => {
      const difference = served - expected;
      return { metric, served, recalculated: expected, difference, matches: Math.abs(difference) <= tolerance };
    };
    const checks = [
      check('liquidAssets', s.liquidAssets, recalculated.liquidAssets),
      check('overdraftDebt', servedOverdraft, recalculated.overdraftDebt),
      check('creditCardDebt', s.creditCardDebt, recalculated.creditCardDebt),
      check('loanDebt', s.loanDebt, recalculated.loanDebt),
      check('portfolioAssets', servedPortfolioAssets, recalculated.portfolioAssets),
      check('portfolioLiabilities', servedPortfolioLiabilities, recalculated.portfolioLiabilities),
      check('totalAssets', s.totalAssets, recalculated.totalAssets),
      check('totalLiabilities', s.totalLiabilities, recalculated.totalLiabilities),
      check('netWorth', s.netWorth, recalculated.netWorth),
      check('amountBaseInvariant', 0, amountBaseError),
      check('unverifiableMovementAmountBase', 0, unverifiableMovementCount),
      check('portfolioValuationCoverage', 0, unvaluedPortfolioEntities),
      check('portfolioAmountBaseInvariant', 0, portfolioAmountBaseError),
      check('unverifiablePortfolioValuation', 0, unverifiableValuationCount),
      check('investmentTransactionCoverage', 0, investmentTransactionIssues),
    ];
    return {
      generatedAt: new Date().toISOString(),
      baseCurrency: s.baseCurrency,
      tolerance,
      isReconciled: checks.every((x) => x.matches),
      checks,
    };
  }

  private monthEnd(ym: string): string {
    const [year, month] = ym.split('-').map(Number);
    const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${ym}-${String(day).padStart(2, '0')}`;
  }

  private positionFromDocuments(
    accounts: AccountResponse[],
    loans: LoanResponse[],
    movements: MovementResponse[],
    portfolioEntities: PortfolioEntityDocument[] = [],
    valuations: PortfolioValuationDocument[] = [],
    through?: string,
  ) {
    const rows = through ? movements.filter((x) => String(x.date).slice(0, 10) <= through) : movements;
    let liquidAssets = 0;
    let overdraftDebt = 0;
    let creditCardDebt = 0;

    for (const account of accounts) {
      const balance = rows
        .filter((x) => x.accountId === account.id)
        .reduce(
          (sum, movement) => sum + (movement.type === 'Income' ? 1 : -1) * this.finiteMoney(movement.amountBase),
          0,
        );
      if (account.type === 'Credit') creditCardDebt += Math.max(0, -balance);
      else if (balance >= 0) liquidAssets += balance;
      else overdraftDebt += -balance;
    }

    const loanDebt = loans.reduce((sum, loan) => {
      if (through && String(loan.startDate).slice(0, 10) > through) return sum;
      const paidPrincipalBase = rows
        .filter((x) => x.loanId === loan.id && x.type === 'Expense')
        .reduce(
          (paid, movement) =>
            paid + this.finiteMoney(movement.principalComponent) * this.positiveRateOrOne(movement.trmApplied),
          0,
        );
      const principalBase = this.finiteMoney(loan.principal) * this.positiveRateOrOne(loan.trmApplied);
      return sum + Math.max(0, principalBase - paidPrincipalBase);
    }, 0);
    const portfolio = this.valuedPortfolioPosition(portfolioEntities, valuations, through);
    const totalAssets = liquidAssets + portfolio.assets;
    const totalLiabilities = overdraftDebt + creditCardDebt + loanDebt + portfolio.liabilities;
    return {
      liquidAssets,
      overdraftDebt,
      creditCardDebt,
      loanDebt,
      portfolioAssets: portfolio.assets,
      portfolioLiabilities: portfolio.liabilities,
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
    };
  }

  private valuedPortfolioPosition(
    entities: PortfolioEntityDocument[],
    valuations: PortfolioValuationDocument[],
    through?: string,
  ): { assets: number; liabilities: number } {
    let assets = 0;
    let liabilities = 0;
    for (const entity of entities.filter((item) => this.isStandalonePortfolioEntity(item))) {
      const value = this.valuationAmount(this.latestValuation(entity.id, valuations, through));
      if (value === null) continue;
      if (this.entityKind(entity) === 'Liability') liabilities += value;
      else assets += value;
    }
    return { assets: roundMoney(assets), liabilities: roundMoney(liabilities) };
  }

  private isStandalonePortfolioEntity(entity: PortfolioEntityDocument): boolean {
    return entity.isActive !== false && !entity.legacyAccountId && !entity.legacyLoanId;
  }

  private entityKind(entity: PortfolioEntityDocument): PortfolioEntityKind {
    if (entity.kind === 1 || String(entity.kind).toLowerCase() === 'liability') return 'Liability';
    return 'Asset';
  }

  private entityType(entity: PortfolioEntityDocument): PortfolioEntityType {
    const values: PortfolioEntityType[] = [
      'Cash',
      'BankAccount',
      'CreditCard',
      'Loan',
      'Investment',
      'OtherAsset',
      'OtherLiability',
    ];
    if (typeof entity.type === 'number') return values[entity.type] ?? 'OtherAsset';
    const exact = values.find((value) => value.toLowerCase() === String(entity.type).toLowerCase());
    return exact ?? (this.entityKind(entity) === 'Liability' ? 'OtherLiability' : 'OtherAsset');
  }

  private valuationSource(valuation: PortfolioValuationDocument): PortfolioValuationSource {
    const values: PortfolioValuationSource[] = ['MovementLedger', 'ContractBalance', 'MarketPrice', 'Manual'];
    if (typeof valuation.source === 'number') return values[valuation.source] ?? 'Manual';
    return values.find((value) => value.toLowerCase() === String(valuation.source).toLowerCase()) ?? 'Manual';
  }

  private transactionType(transaction: InvestmentTransactionDocument): InvestmentTransactionType {
    const values: InvestmentTransactionType[] = ['Contribution', 'Withdrawal', 'Buy', 'Sell', 'Fee'];
    if (typeof transaction.type === 'number') return values[transaction.type] ?? 'Contribution';
    return values.find((value) => value.toLowerCase() === String(transaction.type).toLowerCase()) ?? 'Contribution';
  }

  private latestValuation(
    entityId: string,
    valuations: PortfolioValuationDocument[],
    through = new Date().toISOString().slice(0, 10),
  ): PortfolioValuationDocument | null {
    return (
      valuations
        .filter((valuation) => {
          const date = String(valuation.date).slice(0, 10);
          return valuation.portfolioEntityId === entityId && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= through;
        })
        .sort(
          (a, b) =>
            String(b.date).slice(0, 10).localeCompare(String(a.date).slice(0, 10)) ||
            String(b.createdAt).localeCompare(String(a.createdAt)),
        )[0] ?? null
    );
  }

  private valuationAmount(valuation: PortfolioValuationDocument | null): number | null {
    if (!valuation) return null;
    const value = Number(valuation.amountBase);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  private finiteMoney(value: unknown): number {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  private positiveRateOrOne(value: unknown): number {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 1;
  }
}
