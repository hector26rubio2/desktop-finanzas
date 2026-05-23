import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import type { InstallmentResponse, InstallmentRequest } from '../../models/installment.model';

@Injectable({ providedIn: 'root' })
export class InstallmentsApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getInstallments(): Observable<InstallmentResponse[]> {
    return this.http.get<InstallmentResponse[]>(`${this.base}/installments`);
  }

  createInstallment(req: InstallmentRequest): Observable<InstallmentResponse> {
    return this.http.post<InstallmentResponse>(`${this.base}/installments`, req);
  }

  updateInstallmentPaid(id: string, paidCount: number): Observable<InstallmentResponse> {
    return this.http.patch<InstallmentResponse>(`${this.base}/installments/${id}/paid`, { paidCount });
  }

  deleteInstallment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/installments/${id}`);
  }
}