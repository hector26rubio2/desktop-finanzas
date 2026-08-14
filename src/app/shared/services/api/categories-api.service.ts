import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import type { CategoryResponse, CategoryTranslations } from '../../models/category.model';
import { LocalDataRepository } from '../local/local-data.repository';

export interface CategoryCreateRequest {
  name: string;
  color: string;
  icon: string;
  type: 'Income' | 'Expense';
  translations?: CategoryTranslations;
}

@Injectable({ providedIn: 'root' })
export class CategoriesApiService {
  private local = inject(LocalDataRepository);

  getCategories(): Observable<CategoryResponse[]> {
    return from(this.local.list<CategoryResponse>('category'));
  }

  createCategory(req: CategoryCreateRequest): Observable<CategoryResponse> {
    return from(this.local.put('category', this.localCategory(req), 'create'));
  }

  deleteCategory(id: string): Observable<void> {
    return from(this.local.remove('category', id));
  }

  updateCategory(id: string, req: CategoryCreateRequest): Observable<CategoryResponse> {
    return from(this.local.put('category', this.localCategory(req, id), 'update'));
  }

  private localCategory(req: CategoryCreateRequest, id: string = crypto.randomUUID()): CategoryResponse {
    return {
      id,
      ...req,
      translations: req.translations ?? null,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
  }
}
