import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService, CategoryResponse } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="view">
      <div class="row-flex">
        <h3 class="serif" style="font-size:22px;font-weight:400;flex:1">{{ i18n.t('categorias.title') }}</h3>
        <button class="btn btn--primary" (click)="showForm = !showForm">{{ i18n.t('categorias.nueva') }}</button>
      </div>

      @if (showForm) {
        <div class="card" style="padding:var(--pad-x)">
          <form [formGroup]="form" (ngSubmit)="save()">
            <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
              <label style="flex:2;min-width:160px">
                {{ i18n.t('categorias.nombre') }}
                <input formControlName="name" placeholder="{{ i18n.t('categorias.nombre_placeholder') }}" />
              </label>
              <label style="flex:1;min-width:80px">
                {{ i18n.t('categorias.color') }}
                <input type="color" formControlName="color" style="height:38px;padding:4px" />
              </label>
              <label style="flex:1;min-width:120px">
                {{ i18n.t('categorias.presupuesto') }}
                <input
                  type="number"
                  formControlName="budget"
                  min="0"
                  placeholder="{{ i18n.t('categorias.presupuesto_placeholder') }}"
                />
              </label>
              <div style="display:flex;gap:6px">
                <button type="button" class="btn btn--ghost" (click)="showForm = false">
                  {{ i18n.t('common.cancel') }}
                </button>
                <button type="submit" class="btn btn--primary" [disabled]="form.invalid || saving()">
                  {{ saving() ? '…' : i18n.t('common.save') }}
                </button>
              </div>
            </div>
          </form>
        </div>
      }

      @if (loading()) {
        <div class="empty-state">
          <p>{{ i18n.t('categorias.cargando') }}</p>
        </div>
      } @else if (categories().length === 0) {
        <div class="empty-state">
          <div class="serif">{{ i18n.t('categorias.sin_categorias') }}</div>
          <p>{{ i18n.t('categorias.sin_categorias_desc') }}</p>
        </div>
      } @else {
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--gutter)">
          @for (c of categories(); track c.id) {
            <div class="card" style="padding:14px;display:flex;align-items:center;gap:12px">
              <span style="width:32px;height:32px;border-radius:50%;flex-shrink:0" [style.background]="c.color"></span>
              <div style="flex:1;min-width:0">
                <div style="font-weight:500;color:var(--fg-0)">{{ c.name }}</div>
                <div class="mono subtle" style="font-size:10px;margin-top:2px">id: {{ c.id.slice(0, 8) }}</div>
              </div>
              <button class="btn btn--ghost btn--icon" style="color:var(--negative)">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                >
                  <path d="M1 1l14 14M15 1L1 15" />
                </svg>
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CategoriasComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public i18n = inject(I18nService);

  categories = signal<CategoryResponse[]>([]);
  loading = signal(true);
  saving = signal(false);
  showForm = false;

  form = this.fb.group({
    name: ['', Validators.required],
    color: ['#6366f1'],
    budget: [null as number | null],
  });

  ngOnInit() {
    this.api.getCategories().subscribe({
      next: (list) => {
        this.categories.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.value;
    this.api.createCategory({ name: v.name!, color: v.color! }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm = false;
        this.form.reset({ color: '#6366f1' });
        this.api.getCategories().subscribe((list) => this.categories.set(list));
      },
      error: () => this.saving.set(false),
    });
  }
}
