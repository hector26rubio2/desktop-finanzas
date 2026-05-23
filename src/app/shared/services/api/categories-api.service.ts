import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import type { CategoryResponse } from '../../models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoriesApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getCategories(): Observable<CategoryResponse[]> {
    return this.http.get<CategoryResponse[]>(`${this.base}/categories`);
  }

  createCategory(req: { name: string; color: string; icon: string; type: 'Income' | 'Expense' }): Observable<CategoryResponse> {
    return this.http.post<CategoryResponse>(`${this.base}/categories`, req);
  }
}