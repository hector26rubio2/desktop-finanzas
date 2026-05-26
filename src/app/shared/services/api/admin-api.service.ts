import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import type { AdminUserDto } from '../../models/admin.model';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getAdminUsers(): Observable<AdminUserDto[]> {
    return this.http.get<AdminUserDto[]>(`${this.base}/admin/users`);
  }

  setUserRole(id: string, role: string): Observable<void> {
    return this.http.put<void>(`${this.base}/admin/users/${id}/role`, { role });
  }

  setUserActive(id: string, isActive: boolean): Observable<void> {
    return this.http.put<void>(`${this.base}/admin/users/${id}/active`, { isActive });
  }
}
