import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
  Pipe,
  PipeTransform,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  ApiService,
  AccountResponse,
  AccountBalance,
  MovementResponse,
  PagedResult,
} from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { CatIconComponent } from '../../shared/ui/cat-icon/cat-icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';

@Pipe({ standalone: true, name: 'cardDate' })
export class CardDatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  }
}

interface CardWithBalance extends AccountResponse {
  balance: AccountBalance;
}

@Component({
  selector: 'app-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CatIconComponent, CardDatePipe, ModalComponent],
  templateUrl: './cards.component.html',
  styleUrl: './cards.component.css',
})
export class CardsComponent implements OnInit {
  cards = signal<CardWithBalance[]>([]);
  loading = signal(true);
  filterCcy = signal('');
  filterBank = signal('');
  searchQuery = signal('');
  selectedId = signal<string | null>(null);
  selectedMovement = signal<MovementResponse | null>(null);
  cardMovements = signal<PagedResult<MovementResponse> | null>(null);
  currentPage = signal(1);
  pageSize = signal(10);
  today = new Date();

  private api = inject(ApiService);
  public i18n = inject(I18nService);

  uniqueCurrencies = computed(() => {
    const ccySet = new Set(this.cards().map((c) => c.currency));
    return Array.from(ccySet).sort();
  });

  uniqueBanks = computed(() => {
    const bankSet = new Set(this.cards().map((c) => c.bank).filter((b): b is string => !!b));
    return Array.from(bankSet).sort();
  });

  filteredCards = computed(() => {
    let result = this.cards();
    const ccy = this.filterCcy();
    const bank = this.filterBank();
    if (ccy) result = result.filter((c) => c.currency === ccy);
    if (bank) result = result.filter((c) => c.bank === bank);
    return result;
  });

  selectedCard = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.cards().find((c) => c.id === id) ?? null;
  });

  totalPages = computed(() => {
    const p = this.cardMovements();
    if (!p) return 1;
    return Math.ceil(p.total / p.pageSize) || 1;
  });

  movementItems = computed(() => {
    const items = this.cardMovements()?.items ?? [];
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (m) =>
        (m.description ?? '').toLowerCase().includes(q) ||
        (m.categoryName ?? '').toLowerCase().includes(q) ||
        (m.accountName ?? '').toLowerCase().includes(q) ||
        m.amount.toString().includes(q) ||
        m.currency.toLowerCase().includes(q),
    );
  });

  totalUsed = computed(() => this.filteredCards().reduce((s, c) => s + c.balance.usedInCycle, 0));
  totalLimit = computed(() => this.filteredCards().reduce((s, c) => s + (c.creditLimit ?? 0), 0));
  totalAvailable = computed(() => this.filteredCards().reduce((s, c) => s + this.available(c), 0));
  globalUsePct = computed(() => {
    const limit = this.totalLimit();
    return limit > 0 ? Math.min(100, Math.round((this.totalUsed() / limit) * 100)) : 0;
  });

  selectedExpenses = computed(() => {
    const items = this.cardMovements()?.items ?? [];
    return items.filter((m) => m.type === 'Expense');
  });

  selectedTotalExpenses = computed(() =>
    this.selectedExpenses().reduce((s, m) => s + (m.currency === 'ARS' ? m.amount : m.amount * m.trmApplied), 0),
  );

  selectedTotalInterest = computed(() => {
    const card = this.selectedCard();
    if (!card || !card.interestRate) return 0;
    return Math.round(this.selectedTotalExpenses() * (card.interestRate / 100));
  });

  selectedTotalToPay = computed(() => this.selectedTotalExpenses() + this.selectedTotalInterest());

  currentMonth(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  }

  ngOnInit() {
    this.api.getAccounts().subscribe({
      next: (accounts) => {
        const creditCards = accounts.filter((a) => a.type === 'Credit' && a.isActive);
        if (creditCards.length === 0) {
          this.loading.set(false);
          return;
        }
        forkJoin(creditCards.map((c) => this.api.getAccountBalance(c.id))).subscribe({
          next: (balances) => {
            const combined = creditCards.map((c, i) => ({ ...c, balance: balances[i] }));
            this.cards.set(combined);
            if (combined.length) {
              this.selectedId.set(combined[0].id);
              this.loadMovements(combined[0].id);
            }
            this.loading.set(false);
          },
          error: () => {
            this.cards.set(creditCards.map((c) => ({ ...c, balance: { balance: 0, usedInCycle: 0 } })));
            this.loading.set(false);
          },
        });
      },
      error: () => this.loading.set(false),
    });
  }

  selectCard(id: string) {
    this.selectedId.set(id);
    this.currentPage.set(1);
    this.loadMovements(id);
  }

  loadMovements(accountId: string) {
    this.api.getMovements(this.currentMonth(), this.currentPage(), this.pageSize(), { accountId }).subscribe({
      next: (r) => this.cardMovements.set(r),
    });
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update((p) => p - 1);
      const id = this.selectedId();
      if (id) this.loadMovements(id);
    }
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update((p) => p + 1);
      const id = this.selectedId();
      if (id) this.loadMovements(id);
    }
  }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    const id = this.selectedId();
    if (id) this.loadMovements(id);
  }

  rowCount(): number {
    return this.cardMovements()?.total ?? 0;
  }

  available(card: CardWithBalance): number {
    return Math.max(0, (card.creditLimit ?? 0) - card.balance.usedInCycle);
  }

  usePct(card: CardWithBalance): number {
    if (!card.creditLimit) return 0;
    return Math.min(100, Math.round((card.balance.usedInCycle / card.creditLimit) * 100));
  }

  cyclePct(card: CardWithBalance): number {
    const day = this.today.getDate();
    const close = card.billingDay ?? 1;
    const dayInCycle = day > close ? day - close : 30 - close + day;
    return Math.min(100, Math.max(0, Math.round((dayInCycle / 30) * 100)));
  }

  useColor(pct: number): string {
    if (pct > 70) return 'var(--negative)';
    if (pct > 40) return 'var(--warning)';
    return 'var(--positive)';
  }

  cardBrand(card: CardWithBalance): string {
    const n = (card.name ?? '').toLowerCase();
    if (n.includes('visa')) return 'VISA';
    if (n.includes('master') || n.includes('mastercard')) return 'MASTERCARD';
    if (n.includes('amex') || n.includes('american')) return 'AMEX';
    if (n.includes('naranja')) return 'NARANJA';
    if (n.includes('cabal')) return 'CABAL';
    if (n.includes('argentina')) return 'ARGENTINA';
    return '';
  }

  subTypeLabel(st: string | null): string {
    if (!st) return '—';
    const map: Record<string, string> = {
      Income: this.i18n.t('transactions.income'),
      Expense: this.i18n.t('transactions.expense'),
      LoanReceived: this.i18n.t('transactions.loan_received'),
      LoanGiven: this.i18n.t('transactions.loan_given'),
      Saving: this.i18n.t('transactions.saving'),
    };
    return map[st] ?? st;
  }

  sourceLabel(st: string | null): string {
    if (!st) return '—';
    const map: Record<string, string> = {
      Cash: this.i18n.t('transactions.cash'),
      OwnAccount: this.i18n.t('transactions.own_account'),
      CreditCard: this.i18n.t('transactions.credit_card'),
      Loan: this.i18n.t('transactions.loan'),
    };
    return map[st] ?? st;
  }

  openDetail(m: MovementResponse) {
    this.selectedMovement.set(m);
  }

  closeDetail() {
    this.selectedMovement.set(null);
  }

  cuotaLabel(m: MovementResponse): string {
    if (!m.loanInstallments) return '';
    return `1/${m.loanInstallments}`;
  }

  hasInstallment(m: MovementResponse): boolean {
    return m.loanInstallments !== null && m.loanInstallments !== undefined && m.loanInstallments > 1;
  }
}