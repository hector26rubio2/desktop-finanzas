import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
  viewChild,
  TemplateRef,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService, CategoryResponse } from '../../shared/services/api.service';
import { I18nService } from '../../shared/i18n/i18n.service';
import { IconPickerComponent } from '@ui/atoms/icon-picker/icon-picker.component';
import { CatIconComponent } from '@ui/atoms/cat-icon/cat-icon.component';
import { ModalComponent } from '@ui/organisms/modal/modal.component';
import { ConfirmDialogComponent } from '@ui/molecules/confirm-dialog/confirm-dialog.component';
import { DataTableComponent, type ColumnDef } from '@ui/organisms/data-table/data-table.component';
import type { CategoryTranslations } from '../../shared/models/category.model';

type CatTpl = TemplateRef<{ $implicit: CategoryResponse; row: CategoryResponse }>;

@Component({
  selector: 'app-categories',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IconPickerComponent,
    CatIconComponent,
    ModalComponent,
    ConfirmDialogComponent,
    DataTableComponent,
  ],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.css',
})
export class CategoriesComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);

  categories = signal<CategoryResponse[]>([]);
  loading = signal(true);
  saving = signal(false);
  showModal = signal(false);
  showConfirm = signal(false);
  deletingId = signal<string | null>(null);
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
  pageSizes = [10, 20, 50];
  totalPages = computed(() => Math.ceil(this.filtered().length / this.pageSize()) || 1);
  paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

  rowCount = computed(() => this.filtered().length);

  iconCell = viewChild<CatTpl>('iconCell');
  nameCell = viewChild<CatTpl>('nameCell');
  typeCell = viewChild<CatTpl>('typeCell');
  actionsCell = viewChild<CatTpl>('actionsCell');

  trackById = (c: CategoryResponse) => c.id;

  cols = computed<ColumnDef<CategoryResponse>[]>(() => [
    { key: 'icon', header: '', width: '36px', cellTpl: this.iconCell() },
    { key: 'name', header: this.i18n.t('categories.nombre'), cellTpl: this.nameCell() },
    { key: 'type', header: this.i18n.t('categories.tipo'), width: '80px', cellTpl: this.typeCell() },
    { key: 'id', header: '', width: '60px', cellTpl: this.actionsCell() },
  ]);

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

  onPageChange(p: number) {
    this.page.set(p);
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
  }

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.api
      .getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.editing.set(null);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  askDelete(id: string) {
    this.deletingId.set(id);
    this.showConfirm.set(true);
  }

  confirmDelete() {
    const id = this.deletingId();
    if (!id) return;
    this.showConfirm.set(false);
    this.api
      .deleteCategory(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: () => this.load() });
  }

  cancelDelete() {
    this.showConfirm.set(false);
    this.deletingId.set(null);
  }
}
