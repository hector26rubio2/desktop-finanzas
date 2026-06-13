import { Component, OnInit, inject, signal, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '@shared/services/auth/auth.service';
import { ThemeService } from '@shared/services/theme.service';
import { I18nService } from '@shared/i18n/i18n.service';
import { LangPickerComponent } from '@shared/lang-picker';
import { ThemePickerComponent } from '@shared/theme-picker';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [RouterModule, LangPickerComponent, ThemePickerComponent],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  private destroyRef = inject(DestroyRef);
  formatThemeLabel = (id: string) => this.i18n.t('theme.' + id);

  status = signal<'verifying' | 'success' | 'error' | 'check'>('check');
  resent = signal(false);
  resending = signal(false);
  email: string | null = null;

  ngOnInit() {
    const nav = this.router.getCurrentNavigation();
    this.email =
      (nav?.extras?.state as Record<string, string> | null)?.['email'] ??
      this.route.snapshot.queryParamMap.get('email');
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.router.navigate([], { queryParams: { token: null }, queryParamsHandling: 'merge', replaceUrl: true });
      this.status.set('verifying');
      this.auth
        .verifyEmail(token)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.status.set('success');
            setTimeout(() => this.router.navigate(['/login']), 3000);
          },
          error: () => {
            this.status.set('error');
          },
        });
    }
  }

  resend() {
    if (!this.email) return;
    this.resending.set(true);
    this.auth
      .resendVerification(this.email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.resent.set(true);
          this.resending.set(false);
        },
        error: () => {
          this.resending.set(false);
        },
      });
  }
}
