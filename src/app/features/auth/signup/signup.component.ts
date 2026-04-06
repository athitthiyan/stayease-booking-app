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

        <!-- Social Sign In Buttons -->
        <div class="divider">
          <span>Or continue with</span>
        </div>

        <div class="social-buttons">
          <!-- Apple Sign In -->
          <button type="button" class="social-btn social-btn--apple" (click)="signInWithApple()" [disabled]="loading()">
            <svg width="18" height="18" viewBox="0 0 814 1000"><path fill="currentColor" d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.3-155.8-97.2C156 390 140 250 140 200h-30c0 0-.7 200 68 400s200 350 420 350c0 0-100-150-100-350 0-200 148-350 148-350l142.1-209.1z"/></svg>
            Apple
          </button>

          <!-- Microsoft Sign In -->
          <button type="button" class="social-btn social-btn--microsoft" (click)="signInWithMicrosoft()" [disabled]="loading()">
            <svg width="18" height="18" viewBox="0 0 23 23"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#00a4ef" d="M12 1h10v10H12z"/><path fill="#7fba00" d="M1 12h10v10H1z"/><path fill="#ffb900" d="M12 12h10v10H12z"/></svg>
            Microsoft
          </button>
        </div>

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

    .social-btn--apple {
      background: #000;
      color: #fff;
      border: 1px solid #333;
    }
    .social-btn--apple:hover:not(:disabled) { background: #1a1a1a; }

    .social-btn--microsoft {
      background: #2f2f2f;
      color: #fff;
      border: 1px solid #444;
    }
    .social-btn--microsoft:hover:not(:disabled) { background: #3a3a3a; }

    svg { flex-shrink: 0; }
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

  signInWithApple(): void {
    this.errorMsg.set('Apple Sign-In is coming soon on web. Use the mobile app.');
  }

  signInWithMicrosoft(): void {
    this.authService.loginWithMicrosoft();
  }
}
