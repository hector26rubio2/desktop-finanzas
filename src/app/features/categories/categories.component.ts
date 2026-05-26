import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService, CategoryResponse } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { IconPickerComponent } from '../../shared/ui/icon-picker/icon-picker.component';
import { CatIconComponent } from '../../shared/ui/cat-icon/cat-icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import type { CategoryTranslations } from '../../shared/models/category.model';

@Component({
  selector: 'app-categories',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, IconPickerComponent, CatIconComponent, ModalComponent],
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
  showModal = signal(false);
  editing = signal<CategoryResponse | null>(null);
  filterType = signal<'' | 'Income' | 'Expense'>('');
  searchQuery = signal('');

  filtered = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const ft = this.filterType();
    return this.categories().filter((c) => {
      if (ft && c.type !== ft) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.icon.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  pageSize = signal(10);
  page = signal(1);
  pageSizes = [5, 10, 15];
  totalPages = computed(() => Math.ceil(this.filtered().length / this.pageSize()) || 1);
  paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

  form = this.fb.group({
    name: ['', Validators.required],
    color: ['#6366f1'],
    icon: ['tag'],
    type: ['Expense' as 'Income' | 'Expense'],
    nameEs: [''],
    nameEn: [''],
    namePt: [''],
  });

  catName(cat: CategoryResponse): string {
    return this.i18n.catName(cat.name, cat.translations);
  }

  setFilter(type: '' | 'Income' | 'Expense') {
    this.filterType.set(type);
    this.page.set(1);
  }

  onSearch(q: string) {
    this.searchQuery.set(q);
    this.page.set(1);
  }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
  }

  prevPage() {
    if (this.page() > 1) this.page.update((p) => p - 1);
  }

  nextPage() {
    if (this.page() < this.totalPages()) this.page.update((p) => p + 1);
  }

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.api.getCategories().subscribe({
      next: (list) => {
        this.categories.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate() {
    this.editing.set(null);
    this.form.reset({ color: '#6366f1', icon: 'tag', type: 'Expense' as const, nameEs: '', nameEn: '', namePt: '' });
    this.showModal.set(true);
  }

  openEdit(cat: CategoryResponse) {
    this.editing.set(cat);
    this.form.patchValue({
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      type: cat.type,
    });
    const t = cat.translations ?? {};
    this.form.patchValue({ nameEs: t['es-CO'] ?? '', nameEn: t['en-US'] ?? '', namePt: t['pt-BR'] ?? '' });
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editing.set(null);
  }

  onIconSelect(id: string) {
    this.form.patchValue({ icon: id });
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.value;
    const t: CategoryTranslations = {};
    if (v.nameEs) t['es-CO'] = v.nameEs;
    if (v.nameEn) t['en-US'] = v.nameEn;
    if (v.namePt) t['pt-BR'] = v.namePt;
    const req = {
      name: v.name!,
      color: v.color!,
      icon: v.icon ?? 'tag',
      type: v.type!,
      translations: Object.keys(t).length > 0 ? t : undefined,
    };
    const editingCat = this.editing();
    const op = editingCat ? this.api.updateCategory(editingCat.id, req) : this.api.createCategory(req);
    op.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.editing.set(null);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  deleteCat(id: string) {
    if (!confirm(this.i18n.t('transactions.delete_confirm'))) return;
    this.api.deleteCategory(id).subscribe({ next: () => this.load() });
  }

  rowCount(): number {
    return this.filtered().length;
  }

  showPagination(): boolean {
    return this.filtered().length > this.pageSize();
  }
}
