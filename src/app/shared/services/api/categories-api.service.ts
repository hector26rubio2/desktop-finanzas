import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import type { CategoryResponse, CategoryTranslations } from '../../models/category.model';

export interface CategoryCreateRequest {
  name: string;
  color: string;
  icon: string;
  type: 'Income' | 'Expense';
  translations?: CategoryTranslations;
}

@Injectable({ providedIn: 'root' })
export class CategoriesApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getCategories(): Observable<CategoryResponse[]> {
    return this.http.get<CategoryResponse[]>(`${this.base}/categories`);
  }

  createCategory(req: CategoryCreateRequest): Observable<CategoryResponse> {
    return this.http.post<CategoryResponse>(`${this.base}/categories`, req);
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/categories/${id}`);
  }

  updateCategory(id: string, req: CategoryCreateRequest): Observable<CategoryResponse> {
    return this.http.put<CategoryResponse>(`${this.base}/categories/${id}`, req);
  }
}