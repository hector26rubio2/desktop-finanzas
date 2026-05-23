import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService, CategoryResponse } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.css',
})
export class CategoriesComponent implements OnInit {
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
    icon: ['tag'],
    type: ['Expense' as 'Income' | 'Expense'],
  });

  ngOnInit() {
    this.api.getCategories().subscribe({
      next: (list) => {
        this.categories.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('[categories] load error:', err);
        this.loading.set(false);
      },
    });
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.value;
    this.api.createCategory({ name: v.name!, color: v.color!, icon: v.icon!, type: v.type! }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm = false;
        this.form.reset({ color: '#6366f1', icon: 'tag', type: 'Expense' as const });
        this.api.getCategories().subscribe((list) => this.categories.set(list));
      },
      error: () => this.saving.set(false),
    });
  }
}
