import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ApiService, AccountResponse, AccountBalance } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';

interface CardWithBalance extends AccountResponse {
  balance: AccountBalance;
}

@Component({
  selector: 'app-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './cards.component.html',
  styleUrl: './cards.component.css',
})
export class CardsComponent implements OnInit {
  cards = signal<CardWithBalance[]>([]);
  loading = signal(true);
  selectedId = signal<string | null>(null);
  today = new Date();

  private api = inject(ApiService);
  public i18n = inject(I18nService);

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
            this.loading.set(false);
          },
          error: () => {
            // fallback: show cards without live balance
            this.cards.set(creditCards.map((c) => ({ ...c, balance: { balance: 0, usedInCycle: 0 } })));
            this.loading.set(false);
          },
        });
      },
      error: () => this.loading.set(false),
    });
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

  totalUsed() {
    return this.cards().reduce((s, c) => s + c.balance.usedInCycle, 0);
  }
  totalLimit() {
    return this.cards().reduce((s, c) => s + (c.creditLimit ?? 0), 0);
  }
  globalUsePct() {
    const limit = this.totalLimit();
    return limit > 0 ? Math.min(100, Math.round((this.totalUsed() / limit) * 100)) : 0;
  }
}
