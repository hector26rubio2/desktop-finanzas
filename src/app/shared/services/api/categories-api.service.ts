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
    return from(this.update(id, req));
  }

  setActive(id: string, isActive: boolean): Observable<CategoryResponse> {
    return from(this.setActiveImpl(id, isActive));
  }

  private async update(id: string, req: CategoryCreateRequest): Promise<CategoryResponse> {
    const existing = await this.local.get<CategoryResponse>('category', id);
    const merged: CategoryResponse = {
      ...(existing ?? this.localCategory(req, id)),
      id,
      name: req.name,
      color: req.color,
      icon: req.icon,
      type: req.type,
      translations: req.translations ?? null,
    };
    return this.local.put('category', merged, 'update');
  }

  private async setActiveImpl(id: string, isActive: boolean): Promise<CategoryResponse> {
    const existing = await this.local.get<CategoryResponse>('category', id);
    if (!existing) throw new Error('category_not_found');
    return this.local.put('category', { ...existing, isActive }, 'update');
  }

  private localCategory(req: CategoryCreateRequest, id: string = crypto.randomUUID()): CategoryResponse {
    return {
      id,
      ...req,
      translations: req.translations ?? null,
      isDefault: false,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
  }
}
