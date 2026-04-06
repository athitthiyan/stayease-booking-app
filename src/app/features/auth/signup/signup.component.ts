import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';

function passwordStrengthValidator(ctrl: AbstractControl): ValidationErrors | null {
  const value: string = ctrl.value ?? '';
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /\d/.test(value);
  if (value.length >= 10 && hasUpper && hasLower && hasDigit) return null;
  return { weakPassword: true };
}

function passwordMatchValidator(ctrl: AbstractControl): ValidationErrors | null {
  const pw = ctrl.get('password')?.value as string | undefined;
  const confirm = ctrl.get('confirmPassword')?.value as string | undefined;
  return pw === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <a routerLink="/" class="auth-logo">
          <span>🏨</span> Stay<span class="accent">Ease</span>
        </a>

        <h1 class="auth-title">Create your account</h1>
        <p class="auth-subtitle">Join thousands of happy travellers</p>

        @if (errorMsg()) {
          <div class="auth-error" role="alert">{{ errorMsg() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <div class="form-group">
            <label for="full_name">Full name</label>
            <input
              id="full_name"
              type="text"
              formControlName="full_name"
              placeholder="Jane Smith"
              autocomplete="name"
              [class.is-invalid]="isFieldInvalid('full_name')"
            />
            @if (isFieldInvalid('full_name')) {
              <span class="field-error">Full name is required</span>
            }
          </div>

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
            <label for="password">Password</label>
            <div class="input-password">
              <input
                id="password"
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="password"
                placeholder="Min 10 chars, upper + lower + digit"
                autocomplete="new-password"
                [class.is-invalid]="isFieldInvalid('password')"
              />
              <button type="button" class="toggle-pw" (click)="togglePassword()" aria-label="Toggle visibility">
                {{ showPassword() ? '🙈' : '👁' }}
              </button>
            </div>
            @if (isFieldInvalid('password')) {
              <span class="field-error">Min 10 characters, upper, lower &amp; digit required</span>
            }
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm password</label>
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
            @if (loading()) { Creating account… } @else { Create account }
          </button>
        </form>

        <p class="auth-switch">
          Already have an account?
          <a routerLink="/auth/login">Sign in</a>
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

    .btn--full { width: 100%; justify-content: center; margin-top: 4px; }

    .auth-switch {
      text-align: center;
      font-size: 14px;
      color: var(--color-text-muted);
      margin: 0;
    }
    .auth-switch a { color: var(--color-primary); font-weight: 500; }
  `],
})
export class SignupComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  errorMsg = signal('');
  showPassword = signal(false);

  form = this.fb.nonNullable.group(
    {
      full_name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator }
  );

  togglePassword(): void { this.showPassword.update(v => !v); }

  isFieldInvalid(field: 'full_name' | 'email' | 'password' | 'confirmPassword'): boolean {
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
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.errorMsg.set('');

    const { full_name, email, password } = this.form.getRawValue();

    this.authService.signup({ full_name, email, password }).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err: HttpErrorResponse) => {
        this.errorMsg.set(err.error?.detail ?? 'Signup failed. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
