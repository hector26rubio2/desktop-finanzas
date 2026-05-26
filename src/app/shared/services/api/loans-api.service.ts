import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import type { LoanResponse, LoanRequest } from '../../models/loan.model';

@Injectable({ providedIn: 'root' })
export class LoansApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getLoans(): Observable<LoanResponse[]> {
    return this.http.get<LoanResponse[]>(`${this.base}/loans`);
  }

  createLoan(req: LoanRequest): Observable<LoanResponse> {
    return this.http.post<LoanResponse>(`${this.base}/loans`, req);
  }

  updateLoan(id: string, req: LoanRequest): Observable<LoanResponse> {
    return this.http.put<LoanResponse>(`${this.base}/loans/${id}`, req);
  }

  deleteLoan(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/loans/${id}`);
  }
}
