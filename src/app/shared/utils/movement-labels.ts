import { I18nService } from '../i18n/i18n.service';

export function sourceLabel(st: string | null, i18n: I18nService): string {
  if (!st) return '—';
  const map: Record<string, string> = {
    Cash: i18n.t('transactions.cash'),
    OwnAccount: i18n.t('transactions.own_account'),
    CreditCard: i18n.t('transactions.credit_card'),
    Loan: i18n.t('transactions.loan'),
  };
  return map[st] ?? st;
}

export function subTypeLabel(st: string | null, i18n: I18nService): string {
  if (!st) return '—';
  const map: Record<string, string> = {
    Income: i18n.t('transactions.income'),
    Expense: i18n.t('transactions.expense'),
    LoanReceived: i18n.t('transactions.loan_received'),
    LoanGiven: i18n.t('transactions.loan_given'),
    Saving: i18n.t('transactions.saving'),
  };
  return map[st] ?? st;
}
