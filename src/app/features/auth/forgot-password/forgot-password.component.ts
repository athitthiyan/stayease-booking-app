import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <a routerLink="/" class="auth-logo">
          <span>🏨</span> Stay<span class="accent">Ease</span>
        </a>

        @if (!submitted()) {
          <h1 class="auth-title">Reset your password</h1>
          <p class="auth-subtitle">We'll send a reset link to your email</p>

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
                [class.is-invalid]="isEmailInvalid()"
              />
              @if (isEmailInvalid()) {
                <span class="field-error">Enter a valid email address</span>
              }
            </div>

            <button type="submit" class="btn btn--primary btn--full" [disabled]="loading()">
              @if (loading()) { Sending… } @else { Send reset link }
            </button>
          </form>
        } @else {
          <div class="success-state">
            <div class="success-icon">📧</div>
            <h2 class="auth-title">Check your inbox</h2>
            <p class="auth-subtitle">
              If that email exists in our system, you'll receive a reset link shortly.
            </p>
          </div>
        }

        <p class="auth-switch">
          <a routerLink="/auth/login">← Back to sign in</a>
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

    .form-group { display: flex; flex-direction: column; gap: 6px; }

    .form-group label {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text);
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

    .field-error { font-size: 12px; color: #f87171; }

    .btn--full { width: 100%; justify-content: center; }

    .success-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-md);
      padding: var(--space-lg) 0;
    }

    .success-icon { font-size: 3rem; }

    .auth-switch {
      text-align: center;
      font-size: 14px;
      color: var(--color-text-muted);
      margin: 0;
    }
    .auth-switch a { color: var(--color-primary); font-weight: 500; }
  `],
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  loading = signal(false);
  submitted = signal(false);
  errorMsg = signal('');

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  isEmailInvalid(): boolean {
    const ctrl = this.form.get('email');
    return !!(ctrl?.invalid && ctrl.touched);
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.errorMsg.set('');

    this.authService
      .forgotPassword({ email: this.form.getRawValue().email })
      .subscribe({
        next: () => this.submitted.set(true),
        error: (err: HttpErrorResponse) => {
          this.errorMsg.set(err.error?.detail ?? 'Request failed. Please try again.');
          this.loading.set(false);
        },
      });
  }
}
