import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../shared/services/auth.service';
import { I18nService } from '../shared/i18n/i18n.service';
import { environment } from '../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  public i18n = inject(I18nService);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  loading = false;
  error: string | null = null;
  googleClientId = environment.googleClientId;

  ngOnInit() {
    if (this.auth.isAuthenticated) {
      this.router.navigate(['/dashboard']);
      return;
    }
    if (this.googleClientId) this.loadGoogleScript();
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading = true;
    this.error = null;
    const { email, password } = this.form.value;
    this.auth.login(email!, password!).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error = err.error?.message ?? this.i18n.t('auth.login_error');
        this.loading = false;
      },
    });
  }

  private loadGoogleScript() {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      google.accounts.id.initialize({
        client_id: this.googleClientId,
        callback: (r: { credential: string }) => this.handleGoogleCallback(r),
      });
      google.accounts.id.renderButton(document.getElementById('google-btn'), {
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
      });
    };
    document.head.appendChild(script);
  }

  private handleGoogleCallback(response: { credential: string }) {
    this.loading = true;
    this.auth.loginWithGoogle(response.credential).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => {
        this.error = this.i18n.t('auth.google_error');
        this.loading = false;
      },
    });
  }
}

