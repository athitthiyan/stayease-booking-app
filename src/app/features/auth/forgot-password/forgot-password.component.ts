import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { OtpChallengeResponse } from '../../../core/models/auth.model';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <a routerLink="/" class="auth-logo">Stay<span class="accent">vora</span></a>

        <h1 class="auth-title">Reset your password</h1>
        <p class="auth-subtitle">Verify with OTP sent to your registered email or phone.</p>

        @if (errorMsg()) {
          <div class="auth-error" role="alert">{{ errorMsg() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="requestOtp()" novalidate>
          <div class="form-group">
            <label for="channel">Recovery method</label>
            <select id="channel" formControlName="channel">
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>
          </div>

          <div class="form-group">
            <label for="recipient">{{ form.controls.channel.value === 'email' ? 'Email address' : 'Phone number' }}</label>
            <input
              id="recipient"
              [type]="form.controls.channel.value === 'email' ? 'email' : 'tel'"
              formControlName="recipient"
              [placeholder]="form.controls.channel.value === 'email' ? 'you@example.com' : '+91 98765 43210'"
            />
          </div>

          <button type="submit" class="btn btn--primary btn--full" [disabled]="loading()">
            @if (loading()) { Sending OTP... } @else { Send OTP }
          </button>
        </form>

        @if (challenge().sent && !challenge().verified) {
          <div class="otp-panel">
            <div class="otp-panel__header">
              <span>Verify OTP</span>
            </div>
            <div class="otp-inline">
              <input
                type="text"
                inputmode="numeric"
                maxlength="6"
                [value]="challenge().otp"
                (input)="updateOtpValue($any($event.target).value)"
                placeholder="Enter 6-digit OTP"
              />
              <button type="button" class="btn btn--secondary" (click)="verifyOtp()" [disabled]="verifying() || challenge().otp.length !== 6">
                @if (verifying()) { Verifying... } @else { Verify OTP }
              </button>
            </div>
            @if (challenge().resendRemainingSeconds > 0) {
              <span class="field-hint">Resend OTP in {{ challenge().resendRemainingSeconds }}s</span>
            }
            @if (challenge().info) {
              <span class="field-success">{{ challenge().info }}</span>
            }
            @if (challenge().error) {
              <span class="field-error">{{ challenge().error }}</span>
            }
            @if (challenge().blockedMessage) {
              <span class="field-error">{{ challenge().blockedMessage }}</span>
            }
            @if (challenge().devCode) {
              <span class="otp-dev">Dev OTP: {{ challenge().devCode }}</span>
            }
          </div>
        }

        <p class="auth-switch">
          <a routerLink="/auth/login">Back to sign in</a>
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
      max-width: 460px;
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
    input, select {
      width: 100%;
      padding: 12px 16px;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      color: var(--color-text);
      font-size: 15px;
      box-sizing: border-box;
    }
    .auth-error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 12px 16px;
      border-radius: var(--radius-md);
      font-size: 14px;
    }
    .otp-panel {
      display: grid;
      gap: 10px;
      padding: 12px;
      border: 1px solid rgba(94, 170, 255, 0.22);
      border-radius: var(--radius-md);
      background: rgba(94, 170, 255, 0.06);
    }
    .otp-panel__header { font-size: 13px; font-weight: 600; }
    .otp-inline { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
    .field-error { color: #f87171; font-size: 12px; }
    .field-success { color: #86efac; font-size: 12px; }
    .field-hint { color: var(--color-text-muted); font-size: 12px; }
    .otp-dev { color: var(--color-primary); font-size: 12px; font-weight: 700; }
    .btn--full { width: 100%; justify-content: center; }
    .auth-switch { text-align: center; margin: 0; }
    .auth-switch a { color: var(--color-primary); }
  `],
})
export class ForgotPasswordComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  verifying = signal(false);
  errorMsg = signal('');
  challenge = signal({
    sent: false,
    verified: false,
    challengeId: '',
    otp: '',
    devCode: '',
    info: '',
    error: '',
    resendRemainingSeconds: 0,
    blockedMessage: '',
  });

  form = this.fb.nonNullable.group({
    channel: ['email' as 'email' | 'phone', Validators.required],
    recipient: ['', Validators.required],
  });

  private countdownId = window.setInterval(() => {
    const seconds = this.challenge().resendRemainingSeconds;
    if (seconds > 0) {
      this.challenge.update(state => ({ ...state, resendRemainingSeconds: seconds - 1 }));
    }
  }, 1000);

  ngOnDestroy(): void {
    window.clearInterval(this.countdownId);
  }

  requestOtp(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.errorMsg.set('');

    this.authService.forgotPassword(this.form.getRawValue()).subscribe({
      next: response => {
        this.applyChallengeResponse(response);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMsg.set(this.extractErrorMessage(err, 'Request failed. Please try again.'));
        this.loading.set(false);
      },
    });
  }

  verifyOtp(): void {
    if (this.challenge().otp.length !== 6 || !this.challenge().challengeId) return;

    this.verifying.set(true);
    this.errorMsg.set('');
    this.authService.verifyOtpChallenge({
      challenge_id: this.challenge().challengeId,
      otp: this.challenge().otp,
    }).subscribe({
      next: response => {
        this.challenge.update(state => ({ ...state, verified: true, info: response.message, error: '' }));
        this.verifying.set(false);
        this.router.navigate(['/auth/reset-password'], {
          queryParams: { reset_token: response.reset_token ?? '' },
        });
      },
      error: (err: HttpErrorResponse) => {
        const detail = err.error?.detail;
        const message = typeof detail === 'object' && detail?.message ? detail.message : this.extractErrorMessage(err, 'OTP verification failed.');
        this.challenge.update(state => ({ ...state, error: message }));
        this.verifying.set(false);
      },
    });
  }

  updateOtpValue(raw: string): void {
    this.challenge.update(state => ({
      ...state,
      otp: raw.replace(/\D/g, '').slice(0, 6),
      error: '',
    }));
  }

  private applyChallengeResponse(response: OtpChallengeResponse): void {
    this.challenge.set({
      sent: true,
      verified: false,
      challengeId: response.challenge_id,
      otp: '',
      devCode: response.dev_code ?? '',
      info: response.message,
      error: '',
      resendRemainingSeconds: response.resend_available_in_seconds,
      blockedMessage: response.blocked_until ? 'OTP requests are temporarily blocked. Please try again later.' : '',
    });
  }

  private extractErrorMessage(err: HttpErrorResponse, fallback: string): string {
    const detail = err.error?.detail;
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail.message === 'string') return detail.message;
    return fallback;
  }
}
