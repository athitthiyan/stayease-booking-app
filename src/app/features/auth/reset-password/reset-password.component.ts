import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';

function passwordStrengthValidator(ctrl: AbstractControl): ValidationErrors | null {
  const value: string = ctrl.value ?? '';
  const ok = value.length >= 10 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
  return ok ? null : { weakPassword: true };
}

function passwordMatchValidator(ctrl: AbstractControl): ValidationErrors | null {
  const pw = ctrl.get('new_password')?.value as string | undefined;
  const confirm = ctrl.get('confirmPassword')?.value as string | undefined;
  return pw === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <a routerLink="/" class="auth-logo">Stay<span class="accent">vora</span></a>

        @if (!success()) {
          <h1 class="auth-title">Set new password</h1>
          <p class="auth-subtitle">Your OTP has been verified. Choose a strong new password.</p>

          @if (errorMsg()) {
            <div class="auth-error" role="alert">{{ errorMsg() }}</div>
          }

          @if (!resetToken()) {
            <div class="auth-error" role="alert">Missing or expired reset session.</div>
          } @else {
            <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
              <div class="form-group">
                <label for="new_password">New password</label>
                <input id="new_password" [type]="showPassword() ? 'text' : 'password'" formControlName="new_password" />
                @if (isFieldInvalid('new_password')) {
                  <span class="field-error">Min 10 chars, upper, lower and digit required</span>
                }
              </div>

              <div class="form-group">
                <label for="confirmPassword">Confirm new password</label>
                <input id="confirmPassword" type="password" formControlName="confirmPassword" />
                @if (isConfirmInvalid()) {
                  <span class="field-error">Passwords do not match</span>
                }
              </div>

              <button type="button" class="toggle-link" (click)="togglePassword()">
                {{ showPassword() ? 'Hide password' : 'Show password' }}
              </button>

              <button type="submit" class="btn btn--primary btn--full" [disabled]="loading()">
                @if (loading()) { Resetting... } @else { Reset password }
              </button>
            </form>
          }
        } @else {
          <div class="success-state">
            <h2 class="auth-title">Password reset complete</h2>
            <p class="auth-subtitle">All previous sessions were invalidated. Please sign in again.</p>
            <a routerLink="/auth/login" class="btn btn--primary">Sign in</a>
          </div>
        }
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
      display: grid;
      gap: var(--space-lg);
    }
    .auth-logo { text-align: center; font-family: var(--font-serif); font-size: 1.4rem; font-weight: 700; color: var(--color-text); }
    .accent { color: var(--color-primary); }
    .auth-title, .auth-subtitle { text-align: center; margin: 0; }
    .auth-subtitle { color: var(--color-text-muted); font-size: 14px; }
    .form-group { display: grid; gap: 6px; }
    input {
      width: 100%;
      padding: 12px 16px;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      color: var(--color-text);
      font-size: 15px;
      box-sizing: border-box;
    }
    .field-error { color: #f87171; font-size: 12px; }
    .auth-error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 12px 16px;
      border-radius: var(--radius-md);
      font-size: 14px;
    }
    .toggle-link {
      justify-self: start;
      background: transparent;
      color: var(--color-primary);
      font-weight: 600;
      padding: 0;
    }
    .btn--full { width: 100%; justify-content: center; }
    .success-state { display: grid; gap: var(--space-md); justify-items: center; }
  `],
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  success = signal(false);
  errorMsg = signal('');
  showPassword = signal(false);
  resetToken = signal('');

  form = this.fb.nonNullable.group(
    {
      new_password: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator }
  );

  ngOnInit(): void {
    this.resetToken.set(this.route.snapshot.queryParamMap.get('reset_token') ?? '');
  }

  togglePassword(): void {
    this.showPassword.update(value => !value);
  }

  isFieldInvalid(field: 'new_password' | 'confirmPassword'): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  isConfirmInvalid(): boolean {
    const ctrl = this.form.get('confirmPassword');
    return !!(ctrl?.touched && (ctrl.invalid || this.form.errors?.['passwordMismatch']));
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading() || !this.resetToken()) return;

    this.loading.set(true);
    this.errorMsg.set('');

    this.authService.resetPassword({
      reset_token: this.resetToken(),
      new_password: this.form.getRawValue().new_password,
    }).subscribe({
      next: () => {
        this.success.set(true);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const detail = err.error?.detail;
        this.errorMsg.set(typeof detail === 'string' ? detail : detail?.message ?? 'Reset failed. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
