import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PortfolioApiService } from '../../shared/services/api/portfolio-api.service';
import type { PortfolioItem, PortfolioOverview } from '../../shared/models/portfolio.model';
import { DataTableComponent, type ColumnDef } from '../../shared/ui/organisms/data-table/data-table.component';
import {
  InspectorPanelComponent,
  type InspectorSection,
} from '../../shared/ui/organisms/inspector-panel/inspector-panel.component';
import { ModalComponent } from '../../shared/ui/organisms/modal/modal.component';
@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DataTableComponent, InspectorPanelComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.css',
})
export class PortfolioComponent {
  private api = inject(PortfolioApiService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  data = signal<PortfolioOverview | null>(null);
  loading = signal(true);
  error = signal('');
  actionError = signal('');
  saving = signal(false);
  showCreate = signal(false);
  showValuation = signal(false);
  selected = signal<PortfolioItem | null>(null);
  filter = signal<'All' | 'Asset' | 'Liability'>('All');
  trackById = (x: PortfolioItem) => x.id;
  columns: ColumnDef<PortfolioItem>[] = [
    { key: 'name', header: 'Entidad', sortable: true },
    { key: 'kind', header: 'Clase', sortable: true },
    { key: 'type', header: 'Tipo', sortable: true },
    { key: 'institution', header: 'Institución' },
    {
      key: 'valueBase',
      header: 'Valor base',
      numeric: true,
      sortable: true,
      format: (v) => (v == null ? 'Sin valoración' : Number(v).toLocaleString()),
    },
  ];
  items = computed(() => this.data()?.items.filter((x) => this.filter() === 'All' || x.kind === this.filter()) ?? []);
  canValueSelected = computed(() => this.selected()?.type === 'Investment');
  investmentForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    currency: ['COP', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    institution: ['', Validators.maxLength(120)],
  });
  valuationForm = this.fb.nonNullable.group({
    date: [this.today(), Validators.required],
    amount: [0, [Validators.required, Validators.min(0.000001)]],
    currency: ['COP', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    trmApplied: [1, [Validators.required, Validators.min(0.000001)]],
    source: ['Manual' as 'Manual' | 'MarketPrice', Validators.required],
    externalReference: ['', Validators.maxLength(160)],
  });
  sections = computed<InspectorSection[]>(() => {
    const x = this.selected();
    return x
      ? [
          {
            title: 'Identidad',
            rows: [
              { label: 'Clase', value: x.kind },
              { label: 'Tipo', value: x.type },
              { label: 'Institución', value: x.institution ?? '—' },
            ],
          },
          {
            title: 'Valoración',
            rows: [
              {
                label: 'Valor base',
                value:
                  x.valueBase == null ? 'Sin datos' : `${x.valueBase.toLocaleString()} ${this.data()?.baseCurrency}`,
              },
              { label: 'Fecha', value: x.valuationDate ?? 'Sin datos' },
              { label: 'Fuente', value: x.valuationSource ?? 'Sin datos' },
            ],
          },
        ]
      : [];
  });
  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getOverview()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (x) => {
          this.data.set(x);
          const selectedId = this.selected()?.id;
          if (selectedId) this.selected.set(x.items.find((item) => item.id === selectedId) ?? null);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No fue posible cargar el patrimonio.');
          this.loading.set(false);
        },
      });
  }

  openCreateInvestment(): void {
    this.actionError.set('');
    this.investmentForm.reset({
      name: '',
      currency: this.data()?.baseCurrency ?? 'COP',
      institution: '',
    });
    this.showCreate.set(true);
  }

  saveInvestment(): void {
    this.investmentForm.markAllAsTouched();
    if (this.investmentForm.invalid || this.saving()) return;
    this.saving.set(true);
    this.actionError.set('');
    const value = this.investmentForm.getRawValue();
    this.api
      .createInvestment(value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showCreate.set(false);
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.actionError.set('No fue posible crear la inversión. Revisa los datos.');
        },
      });
  }

  openSelectedValuation(): void {
    const item = this.selected();
    if (!item || item.type !== 'Investment') return;
    this.actionError.set('');
    this.valuationForm.reset({
      date: this.today(),
      amount: 0,
      currency: item.currency,
      trmApplied: item.currency === this.data()?.baseCurrency ? 1 : 0,
      source: 'Manual',
      externalReference: '',
    });
    this.showValuation.set(true);
  }

  saveValuation(): void {
    const item = this.selected();
    this.valuationForm.markAllAsTouched();
    if (!item || item.type !== 'Investment' || this.valuationForm.invalid || this.saving()) return;
    this.saving.set(true);
    this.actionError.set('');
    this.api
      .addValuation(item.id, this.valuationForm.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showValuation.set(false);
          this.load();
        },
        error: () => {
          this.saving.set(false);
          this.actionError.set('No fue posible registrar la valoración. Revisa monto, moneda y TRM.');
        },
      });
  }

  private today(): string {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
