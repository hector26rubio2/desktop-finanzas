import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import type { LocalAuthEnrollment, LocalAuthSession, LocalAuthStatus, UserInfo } from '../../models/auth.model';

interface AuthBridge {
  status(): Promise<LocalAuthStatus>;
  register(payload: {
    name: string;
    email: string;
    password: string;
    baseCurrency: string;
  }): Promise<LocalAuthEnrollment>;
  login(payload: { password: string; remember: boolean }): Promise<LocalAuthSession>;
  resume(resumeToken: string): Promise<LocalAuthSession | null>;
  logout(): Promise<{ ok: boolean }>;
  changePassword(payload: { currentPassword: string; newPassword: string }): Promise<{ ok: boolean }>;
  recover(payload: { recoveryCode: string; newPassword: string }): Promise<LocalAuthEnrollment>;
  updateProfile(patch: Partial<Pick<UserInfo, 'name' | 'email' | 'baseCurrency'>>): Promise<{ user: UserInfo }>;
}

function bridge(): AuthBridge | null {
  const electron = (window as unknown as { electronAPI?: { auth?: AuthBridge } }).electronAPI;
  return electron?.auth ?? null;
}

@Injectable({ providedIn: 'root' })
export class LocalAuthService {
  get available(): boolean {
    return bridge() !== null;
  }

  status(): Promise<LocalAuthStatus> {
    const api = bridge();

    if (!api)
      return Promise.resolve({
        hasProfile: false,
        suggestedName: '',
        unlocked: false,
        lockedUntil: 0,
        orphanOwners: [],
      });
    return api.status();
  }

  register(name: string, email: string, password: string, baseCurrency: string): Observable<LocalAuthEnrollment> {
    return from(this.required().register({ name, email, password, baseCurrency }));
  }

  login(password: string, remember: boolean): Observable<LocalAuthSession> {
    return from(this.required().login({ password, remember }));
  }

  resume(resumeToken: string): Promise<LocalAuthSession | null> {
    const api = bridge();
    return api ? api.resume(resumeToken) : Promise.resolve(null);
  }

  logout(): Promise<{ ok: boolean }> {
    const api = bridge();
    return api ? api.logout() : Promise.resolve({ ok: true });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ ok: boolean }> {
    return from(this.required().changePassword({ currentPassword, newPassword }));
  }

  recover(recoveryCode: string, newPassword: string): Observable<LocalAuthEnrollment> {
    return from(this.required().recover({ recoveryCode, newPassword }));
  }

  updateProfile(patch: Partial<Pick<UserInfo, 'name' | 'email' | 'baseCurrency'>>): Observable<{ user: UserInfo }> {
    return from(this.required().updateProfile(patch));
  }

  private required(): AuthBridge {
    const api = bridge();
    if (!api) throw new Error('Local authentication is only available inside the desktop application');
    return api;
  }
}
