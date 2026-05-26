import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import type { AuthResponse } from '../../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  loginWithGoogle(idToken: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/google`, { idToken });
  }

  register(name: string, email: string, password: string, baseCurrency: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/register`, { name, email, password, baseCurrency });
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/login`, { email, password });
  }

  refresh(refreshToken: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/refresh`, { refreshToken });
  }

  logout(refreshToken: string): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/logout`, { refreshToken });
  }

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/reset-password`, { token, password });
  }

  verifyEmail(token: string): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/verify-email`, { token });
  }

  resendVerification(email: string): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/resend-verification`, { email });
  }
}
