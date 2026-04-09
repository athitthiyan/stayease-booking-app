import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <a routerLink="/" class="auth-logo">
          <span>🏨</span> Stay<span class="accent">Ease</span>
        </a>

        <h1 class="auth-title">Welcome back</h1>
        <p class="auth-subtitle">Sign in to your account</p>

        @if (errorMsg()) {
          <div class="auth-error" role="alert">{{ errorMsg() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <div class="form-group">
            <label for="email">Email address</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="you@example.com"
              autocomplete="email"
              [class.is-invalid]="isFieldInvalid('email')"
            />
            @if (isFieldInvalid('email')) {
              <span class="field-error">Enter a valid email address</span>
            }
          </div>

          <div class="form-group">
            <label for="password">
              Password
              <a routerLink="/auth/forgot-password" class="forgot-link">Forgot?</a>
            </label>
            <div class="input-password">
              <input
                id="password"
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="password"
                placeholder="••••••••••"
                autocomplete="current-password"
                [class.is-invalid]="isFieldInvalid('password')"
              />
              <button type="button" class="toggle-pw" (click)="togglePassword()" aria-label="Toggle password visibility">
                {{ showPassword() ? '🙈' : '👁' }}
              </button>
            </div>
            @if (isFieldInvalid('password')) {
              <span class="field-error">Password is required</span>
            }
          </div>

          <button type="submit" class="btn btn--primary btn--full" [disabled]="loading()">
            @if (loading()) { Signing in… } @else { Sign in }
          </button>
        </form>

        <!-- Social Sign In Buttons -->
        <div class="divider">
          <span>Or continue with</span>
        </div>

        <div class="social-buttons">
          <!-- Google Sign In -->
          <button type="button" class="social-btn social-btn--google" (click)="signInWithGoogle()" [disabled]="loading() || socialLoading()">
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 0 0 0 24c0 3.77.9 7.35 2.56 10.52l7.97-5.93z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.93C6.51 42.62 14.62 48 24 48z"/></svg>
            Google
          </button>

          <!-- Microsoft Sign In -->
          <button type="button" class="social-btn social-btn--microsoft" (click)="signInWithMicrosoft()" [disabled]="loading() || socialLoading()">
            <svg width="18" height="18" viewBox="0 0 23 23"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#00a4ef" d="M12 1h10v10H12z"/><path fill="#7fba00" d="M1 12h10v10H1z"/><path fill="#ffb900" d="M12 12h10v10H12z"/></svg>
            Microsoft
          </button>
        </div>

        <p class="auth-switch">
          Don't have an account?
          <a routerLink="/auth/signup">Create one</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-xl);
      background: var(--color-bg);
    }

    .auth-card {
      width: 100%;
      max-width: 420px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      padding: var(--space-2xl);
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
    }

    .auth-logo {
      font-family: var(--font-serif);
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--color-text);
      text-align: center;
    }
    .auth-logo .accent { color: var(--color-primary); }

    .auth-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--color-text);
      text-align: center;
      margin: 0;
    }

    .auth-subtitle {
      color: var(--color-text-muted);
      text-align: center;
      margin: -8px 0 0;
      font-size: 14px;
    }

    .auth-error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 12px 16px;
      border-radius: var(--radius-md);
      font-size: 14px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group label {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .forgot-link {
      font-size: 13px;
      color: var(--color-primary);
    }

    input {
      width: 100%;
      padding: 12px 16px;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      color: var(--color-text);
      font-size: 15px;
      transition: border-color var(--transition-fast);
      box-sizing: border-box;
    }

    input:focus { outline: none; border-color: var(--color-primary); }
    input.is-invalid { border-color: #ef4444; }

    .input-password {
      position: relative;
    }
    .input-password input { padding-right: 46px; }

    .toggle-pw {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      padding: 2px;
    }

    .field-error {
      font-size: 12px;
      color: #f87171;
    }

    .btn--full { width: 100%; justify-content: center; margin-top: 4px; }

    .auth-switch {
      text-align: center;
      font-size: 14px;
      color: var(--color-text-muted);
      margin: 0;
    }
    .auth-switch a { color: var(--color-primary); font-weight: 500; }

    .divider {
      text-align: center;
      position: relative;
      margin: 8px 0;
      font-size: 12px;
      color: var(--color-text-muted);
    }
    .divider::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 1px;
      background: var(--color-border);
      z-index: 0;
    }
    .divider span {
      background: var(--color-surface);
      padding: 0 8px;
      position: relative;
      z-index: 1;
    }

    .social-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .social-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-bg);
      color: var(--color-text);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .social-btn:hover:not(:disabled) { background: var(--color-surface); }
    .social-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .social-btn--google {
      background: #fff;
      color: #1f1f1f;
      border: 1px solid #dadce0;
    }
    .social-btn--google:hover:not(:disabled) { background: #f7f8f8; }

    .social-btn--microsoft {
      background: #2f2f2f;
      color: #fff;
      border: 1px solid #444;
    }
    .social-btn--microsoft:hover:not(:disabled) { background: #3a3a3a; }

    svg { flex-shrink: 0; }
  `],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  socialLoading = signal(false);
  errorMsg = signal('');
  showPassword = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  togglePassword(): void { this.showPassword.update(v => !v); }

  isFieldInvalid(field: 'email' | 'password'): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.errorMsg.set('');

    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl')
          || sessionStorage.getItem('sv_redirect_after_login')
          || '/';
        sessionStorage.removeItem('sv_redirect_after_login');
        this.router.navigateByUrl(returnUrl);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMsg.set(err.error?.detail ?? 'Login failed. Please try again.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Persist the returnUrl query-param (if present) into sessionStorage
   * so that SSO flows (which leave the page or open popups) can redirect
   * back to the intended destination after authentication.
   */
  private saveReturnUrlForSso(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl) {
      sessionStorage.setItem('sv_redirect_after_login', returnUrl);
    }
  }

  signInWithGoogle(): void {
    this.socialLoading.set(true);
    this.errorMsg.set('');
    this.saveReturnUrlForSso();
    this.authService.loginWithGoogle().catch((err: Error) => {
      this.errorMsg.set(err.message || 'Google Sign-In failed. Please try again.');
      this.socialLoading.set(false);
    });
  }

  signInWithMicrosoft(): void {
    this.socialLoading.set(true);
    this.errorMsg.set('');
    this.saveReturnUrlForSso();
    this.authService.loginWithMicrosoft().catch((err: Error) => {
      this.errorMsg.set(err.message || 'Microsoft Sign-In failed. Please try again.');
      this.socialLoading.set(false);
    });
  }
}
