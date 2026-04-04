import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';

function passwordStrengthValidator(ctrl: AbstractControl): ValidationErrors | null {
  const value: string = ctrl.value ?? '';
  const ok =
    value.length >= 10 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value);
  return ok ? null : { weakPassword: true };
}

function passwordMatchValidator(ctrl: AbstractControl): ValidationErrors | null {
  const pw = ctrl.get('new_password')?.value;
  const confirm = ctrl.get('confirmPassword')?.value;
  return pw === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <a routerLink="/" class="auth-logo">
          <span>🏨</span> Stay<span class="accent">Ease</span>
        </a>

        @if (!success()) {
          <h1 class="auth-title">Set new password</h1>
          <p class="auth-subtitle">Choose a strong password for your account</p>

          @if (errorMsg()) {
            <div class="auth-error" role="alert">{{ errorMsg() }}</div>
          }

          @if (!token()) {
            <div class="auth-error" role="alert">Invalid or missing reset token.</div>
          } @else {
            <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
              <div class="form-group">
                <label for="new_password">New password</label>
                <div class="input-password">
                  <input
                    id="new_password"
                    [type]="showPassword() ? 'text' : 'password'"
                    formControlName="new_password"
                    placeholder="Min 10 chars, upper + lower + digit"
                    autocomplete="new-password"
                    [class.is-invalid]="isFieldInvalid('new_password')"
                  />
                  <button type="button" class="toggle-pw" (click)="togglePassword()" aria-label="Toggle">
                    {{ showPassword() ? '🙈' : '👁' }}
                  </button>
                </div>
                @if (isFieldInvalid('new_password')) {
                  <span class="field-error">Min 10 chars, upper, lower &amp; digit required</span>
                }
              </div>

              <div class="form-group">
                <label for="confirmPassword">Confirm new password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  formControlName="confirmPassword"
                  placeholder="••••••••••"
                  autocomplete="new-password"
                  [class.is-invalid]="isConfirmInvalid()"
                />
                @if (isConfirmInvalid()) {
                  <span class="field-error">Passwords do not match</span>
                }
              </div>

              <button type="submit" class="btn btn--primary btn--full" [disabled]="loading()">
                @if (loading()) { Resetting… } @else { Reset password }
              </button>
            </form>
          }
        } @else {
          <div class="success-state">
            <div class="success-icon">✅</div>
            <h2 class="auth-title">Password reset!</h2>
            <p class="auth-subtitle">Your password has been updated successfully.</p>
            <a routerLink="/auth/login" class="btn btn--primary">Sign in now</a>
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

    .input-password { position: relative; }
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
  `],
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loading = signal(false);
  success = signal(false);
  errorMsg = signal('');
  showPassword = signal(false);
  token = signal('');

  form = this.fb.nonNullable.group(
    {
      new_password: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator }
  );

  ngOnInit(): void {
    const t = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.token.set(t);
  }

  togglePassword(): void { this.showPassword.update(v => !v); }

  isFieldInvalid(field: 'new_password' | 'confirmPassword'): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  isConfirmInvalid(): boolean {
    const ctrl = this.form.get('confirmPassword');
    return !!(
      ctrl?.touched &&
      (ctrl.invalid || this.form.errors?.['passwordMismatch'])
    );
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading() || !this.token()) return;

    this.loading.set(true);
    this.errorMsg.set('');

    this.authService
      .resetPassword({
        token: this.token(),
        new_password: this.form.getRawValue().new_password,
      })
      .subscribe({
        next: () => this.success.set(true),
        error: (err: HttpErrorResponse) => {
          this.errorMsg.set(err.error?.detail ?? 'Reset failed. The link may have expired.');
          this.loading.set(false);
        },
      });
  }
}
