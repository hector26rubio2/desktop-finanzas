import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import type { MovementResponse, MovementRequest, MovementSummary, PagedResult } from '../../models/movement.model';

@Injectable({ providedIn: 'root' })
export class MovementsApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getMovements(
    yearMonth: string,
    page = 1,
    pageSize = 20,
    filters?: { currency?: string; categoryId?: string; accountId?: string },
  ): Observable<PagedResult<MovementResponse>> {
    const [year, month] = yearMonth.split('-').map(Number);
    let params = new HttpParams().set('year', year).set('month', month).set('page', page).set('pageSize', pageSize);
    if (filters?.currency) params = params.set('currency', filters.currency);
    if (filters?.categoryId) params = params.set('categoryId', filters.categoryId);
    if (filters?.accountId) params = params.set('accountId', filters.accountId);
    return this.http.get<PagedResult<MovementResponse>>(`${this.base}/movements`, { params });
  }

  getMovementSummary(yearMonth: string): Observable<MovementSummary> {
    const [year, month] = yearMonth.split('-').map(Number);
    return this.http.get<MovementSummary>(`${this.base}/movements/summary`, {
      params: new HttpParams().set('year', year).set('month', month),
    });
  }

  createMovement(req: MovementRequest): Observable<MovementResponse> {
    return this.http.post<MovementResponse>(`${this.base}/movements`, req);
  }

  deleteMovement(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/movements/${id}`);
  }

  updateMovement(id: string, req: MovementRequest): Observable<MovementResponse> {
    return this.http.put<MovementResponse>(`${this.base}/movements/${id}`, req);
  }
}
