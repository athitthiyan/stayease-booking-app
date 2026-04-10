import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { BookingSearchStore } from '../../../core/services/booking-search.store';
import { AuthService } from '../../../core/services/auth.service';
import { OtpChallengeResponse } from '../../../core/models/auth.model';

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

type ContactChannel = 'email' | 'phone';

interface OtpUiState {
  sending: boolean;
  verifying: boolean;
  sent: boolean;
  verified: boolean;
  challengeId: string;
  recipient: string;
  otp: string;
  devCode: string;
  info: string;
  error: string;
  resendRemainingSeconds: number;
  resendsRemaining: number;
  attemptsRemaining: number;
  blockedMessage: string;
}

function createOtpState(): OtpUiState {
  return {
    sending: false,
    verifying: false,
    sent: false,
    verified: false,
    challengeId: '',
    recipient: '',
    otp: '',
    devCode: '',
    info: '',
    error: '',
    resendRemainingSeconds: 0,
    resendsRemaining: 3,
    attemptsRemaining: 5,
    blockedMessage: '',
  };
}

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <a routerLink="/" class="auth-logo">Stay<span class="accent">vora</span></a>

        <h1 class="auth-title">Create your account</h1>
        <p class="auth-subtitle">Verify both your email and phone before we create your account.</p>

        @if (errorMsg()) {
          <div class="auth-error" role="alert">{{ errorMsg() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <div class="form-group">
            <label for="full_name">Full name</label>
            <input id="full_name" type="text" formControlName="full_name" autocomplete="name" />
            @if (isFieldInvalid('full_name')) {
              <span class="field-error">Full name is required</span>
            }
          </div>

          <div class="form-group">
            <label for="email">Email address</label>
            <input id="email" type="email" formControlName="email" autocomplete="email" />
            @if (isFieldInvalid('email')) {
              <span class="field-error">Enter a valid email address</span>
            }
            <div class="otp-panel">
              <div class="otp-panel__header">
                <span>Email verification</span>
                @if (emailOtp().verified) {
                  <span class="badge badge--verified">Verified</span>
                }
              </div>
              <button
                type="button"
                class="btn btn--secondary btn--full"
                (click)="requestOtp('email')"
                [disabled]="emailOtp().sending || !form.controls.email.valid || emailOtp().verified"
              >
                @if (emailOtp().sending) { Sending OTP... } @else if (emailOtp().sent) { Resend OTP } @else { Send OTP }
              </button>
              @if (emailOtp().sent && !emailOtp().verified) {
                <div class="otp-inline">
                  <input
                    type="text"
                    inputmode="numeric"
                    maxlength="6"
                    [value]="emailOtp().otp"
                    (input)="updateOtpValue('email', $any($event.target).value)"
                    placeholder="Enter 6-digit OTP"
                  />
                  <button
                    type="button"
                    class="btn btn--secondary"
                    (click)="verifyOtp('email')"
                    [disabled]="emailOtp().verifying || emailOtp().otp.length !== 6"
                  >
                    @if (emailOtp().verifying) { Verifying... } @else { Verify OTP }
                  </button>
                </div>
              }
              @if (emailOtp().resendRemainingSeconds > 0) {
                <span class="field-hint">Resend OTP in {{ emailOtp().resendRemainingSeconds }}s</span>
              }
              @if (emailOtp().info) {
                <span class="field-success">{{ emailOtp().info }}</span>
              }
              @if (emailOtp().error) {
                <span class="field-error">{{ emailOtp().error }}</span>
              }
              @if (emailOtp().blockedMessage) {
                <span class="field-error">{{ emailOtp().blockedMessage }}</span>
              }
              @if (emailOtp().devCode) {
                <span class="otp-dev">Dev OTP: {{ emailOtp().devCode }}</span>
              }
            </div>
          </div>

          <div class="form-group">
            <label for="phone">Phone number</label>
            <input id="phone" type="tel" formControlName="phone" autocomplete="tel" placeholder="+91 98765 43210" />
            @if (isFieldInvalid('phone')) {
              <span class="field-error">Enter a valid phone number</span>
            }
            <div class="otp-panel">
              <div class="otp-panel__header">
                <span>Phone verification</span>
                @if (phoneOtp().verified) {
                  <span class="badge badge--verified">Verified</span>
                }
              </div>
              <button
                type="button"
                class="btn btn--secondary btn--full"
                (click)="requestOtp('phone')"
                [disabled]="phoneOtp().sending || !form.controls.phone.valid || phoneOtp().verified"
              >
                @if (phoneOtp().sending) { Sending OTP... } @else if (phoneOtp().sent) { Resend OTP } @else { Send OTP }
              </button>
              @if (phoneOtp().sent && !phoneOtp().verified) {
                <div class="otp-inline">
                  <input
                    type="text"
                    inputmode="numeric"
                    maxlength="6"
                    [value]="phoneOtp().otp"
                    (input)="updateOtpValue('phone', $any($event.target).value)"
                    placeholder="Enter 6-digit OTP"
                  />
                  <button
                    type="button"
                    class="btn btn--secondary"
                    (click)="verifyOtp('phone')"
                    [disabled]="phoneOtp().verifying || phoneOtp().otp.length !== 6"
                  >
                    @if (phoneOtp().verifying) { Verifying... } @else { Verify OTP }
                  </button>
                </div>
              }
              @if (phoneOtp().resendRemainingSeconds > 0) {
                <span class="field-hint">Resend OTP in {{ phoneOtp().resendRemainingSeconds }}s</span>
              }
              @if (phoneOtp().info) {
                <span class="field-success">{{ phoneOtp().info }}</span>
              }
              @if (phoneOtp().error) {
                <span class="field-error">{{ phoneOtp().error }}</span>
              }
              @if (phoneOtp().blockedMessage) {
                <span class="field-error">{{ phoneOtp().blockedMessage }}</span>
              }
              @if (phoneOtp().devCode) {
                <span class="otp-dev">Dev OTP: {{ phoneOtp().devCode }}</span>
              }
            </div>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <div class="input-password">
              <input
                id="password"
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="password"
                autocomplete="new-password"
                placeholder="Min 10 chars, upper + lower + digit"
              />
              <button type="button" class="toggle-pw" (click)="togglePassword()" aria-label="Toggle visibility">
                {{ showPassword() ? 'Hide' : 'Show' }}
              </button>
            </div>
            @if (isFieldInvalid('password')) {
              <span class="field-error">Min 10 characters, upper, lower and digit required</span>
            }
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm password</label>
            <input id="confirmPassword" type="password" formControlName="confirmPassword" autocomplete="new-password" />
            @if (isConfirmInvalid()) {
              <span class="field-error">Passwords do not match</span>
            }
          </div>

          <button type="submit" class="btn btn--primary btn--full" [disabled]="loading() || !canSubmit()">
            @if (loading()) { Creating account... } @else { Create account }
          </button>
        </form>

        <div class="divider"><span>Or continue with</span></div>

        <div class="social-buttons">
          <button type="button" class="social-btn social-btn--google" (click)="signInWithGoogle()" [disabled]="loading() || socialLoading()">
            Google
          </button>
          <button type="button" class="social-btn social-btn--microsoft" (click)="signInWithMicrosoft()" [disabled]="loading() || socialLoading()">
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
      max-width: 520px;
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
    .accent { color: var(--color-primary); }
    .auth-title, .auth-subtitle { text-align: center; margin: 0; }
    .auth-subtitle { color: var(--color-text-muted); font-size: 14px; }
    .auth-error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 12px 16px;
      border-radius: var(--radius-md);
      font-size: 14px;
    }
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
    .input-password { position: relative; }
    .input-password input { padding-right: 72px; }
    .toggle-pw {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      color: var(--color-primary);
      font-size: 12px;
      font-weight: 700;
    }
    .otp-panel {
      display: grid;
      gap: 10px;
      padding: 12px;
      border: 1px solid rgba(94, 170, 255, 0.22);
      border-radius: var(--radius-md);
      background: rgba(94, 170, 255, 0.06);
    }
    .otp-panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 13px;
      font-weight: 600;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
    }
    .badge--verified {
      background: rgba(34, 197, 94, 0.18);
      color: #86efac;
    }
    .otp-inline {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
    }
    .field-error { color: #f87171; font-size: 12px; }
    .field-success { color: #86efac; font-size: 12px; }
    .field-hint { color: var(--color-text-muted); font-size: 12px; }
    .otp-dev { color: var(--color-primary); font-size: 12px; font-weight: 700; }
    .btn--full { width: 100%; justify-content: center; }
    .auth-switch { text-align: center; font-size: 14px; color: var(--color-text-muted); margin: 0; }
    .auth-switch a { color: var(--color-primary); font-weight: 600; }
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
    }
    .divider span {
      position: relative;
      z-index: 1;
      background: var(--color-surface);
      padding: 0 8px;
    }
    .social-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .social-btn {
      padding: 12px 16px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-bg);
      color: var(--color-text);
      cursor: pointer;
    }
  `],
})
export class SignupComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private searchStore = inject(BookingSearchStore);
  private subscriptions = new Subscription();

  loading = signal(false);
  socialLoading = signal(false);
  errorMsg = signal('');
  showPassword = signal(false);
  emailOtp = signal<OtpUiState>(createOtpState());
  phoneOtp = signal<OtpUiState>(createOtpState());

  form = this.fb.nonNullable.group(
    {
      full_name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s()]{7,30}$/)]],
      password: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator }
  );

  private countdownId = window.setInterval(() => {
    this.tickCountdown('email');
    this.tickCountdown('phone');
  }, 1000);

  constructor() {
    this.subscriptions.add(
      this.form.controls.email.valueChanges.subscribe(() => this.resetOtpState('email'))
    );
    this.subscriptions.add(
      this.form.controls.phone.valueChanges.subscribe(() => this.resetOtpState('phone'))
    );
  }

  ngOnDestroy(): void {
    window.clearInterval(this.countdownId);
    this.subscriptions.unsubscribe();
  }

  togglePassword(): void {
    this.showPassword.update(value => !value);
  }

  isFieldInvalid(field: 'full_name' | 'email' | 'phone' | 'password'): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  isConfirmInvalid(): boolean {
    const ctrl = this.form.get('confirmPassword');
    return !!(ctrl?.touched && (ctrl.invalid || this.form.errors?.['passwordMismatch']));
  }

  canSubmit(): boolean {
    return this.form.valid && this.emailOtp().verified && this.phoneOtp().verified;
  }

  updateOtpValue(channel: ContactChannel, raw: string): void {
    const sanitized = raw.replace(/\D/g, '').slice(0, 6);
    this.patchOtpState(channel, { otp: sanitized, error: '' });
  }

  requestOtp(channel: ContactChannel): void {
    const control = channel === 'email' ? this.form.controls.email : this.form.controls.phone;
    control.markAsTouched();
    if (control.invalid) return;

    this.errorMsg.set('');
    this.patchOtpState(channel, { sending: true, error: '', blockedMessage: '' });

    this.authService.requestOtpChallenge({
      flow: 'signup',
      channel,
      recipient: control.value.trim(),
    }).subscribe({
      next: response => {
        this.applyChallengeResponse(channel, response, 'OTP sent successfully.');
        this.patchOtpState(channel, { sending: false, sent: true });
      },
      error: (err: HttpErrorResponse) => {
        this.handleOtpError(channel, err);
        this.patchOtpState(channel, { sending: false });
      },
    });
  }

  verifyOtp(channel: ContactChannel): void {
    const state = this.getOtpState(channel);
    if (state.otp.length !== 6 || !state.challengeId) return;

    this.patchOtpState(channel, { verifying: true, error: '', blockedMessage: '' });
    this.authService.verifyOtpChallenge({
      challenge_id: state.challengeId,
      otp: state.otp,
    }).subscribe({
      next: () => {
        this.patchOtpState(channel, {
          verifying: false,
          verified: true,
          info: `${channel === 'email' ? 'Email' : 'Phone'} verified successfully.`,
          error: '',
          sent: false,
        });
      },
      error: (err: HttpErrorResponse) => {
        this.handleOtpError(channel, err);
        this.patchOtpState(channel, { verifying: false });
      },
    });
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (!this.canSubmit() || this.loading()) return;

    this.loading.set(true);
    this.errorMsg.set('');

    const { full_name, email, phone, password } = this.form.getRawValue();
    this.authService.signup({
      full_name,
      email,
      phone,
      password,
      email_challenge_id: this.emailOtp().challengeId,
      phone_challenge_id: this.phoneOtp().challengeId,
    }).subscribe({
      next: () => {
        const intended = this.searchStore.getAndClearRedirectIntent();
        this.router.navigateByUrl(intended || '/');
      },
      error: (err: HttpErrorResponse) => {
        this.errorMsg.set(this.extractErrorMessage(err, 'Signup failed. Please try again.'));
        this.loading.set(false);
      },
    });
  }

  signInWithGoogle(): void {
    this.socialLoading.set(true);
    this.errorMsg.set('');
    this.authService.loginWithGoogle().catch((err: Error) => {
      this.errorMsg.set(err.message || 'Google Sign-In failed. Please try again.');
      this.socialLoading.set(false);
    });
  }

  async signInWithMicrosoft(): Promise<void> {
    this.socialLoading.set(true);
    this.errorMsg.set('');
    try {
      await this.authService.loginWithMicrosoft();
    } catch {
      this.errorMsg.set('Microsoft Sign-In failed. Please try again.');
      this.socialLoading.set(false);
    }
  }

  private getOtpSignal(channel: ContactChannel) {
    return channel === 'email' ? this.emailOtp : this.phoneOtp;
  }

  private getOtpState(channel: ContactChannel): OtpUiState {
    return this.getOtpSignal(channel)();
  }

  private patchOtpState(channel: ContactChannel, patch: Partial<OtpUiState>): void {
    this.getOtpSignal(channel).update(state => ({ ...state, ...patch }));
  }

  private resetOtpState(channel: ContactChannel): void {
    this.getOtpSignal(channel).set(createOtpState());
  }

  private tickCountdown(channel: ContactChannel): void {
    const state = this.getOtpState(channel);
    if (state.resendRemainingSeconds <= 0) return;
    this.patchOtpState(channel, { resendRemainingSeconds: state.resendRemainingSeconds - 1 });
  }

  private applyChallengeResponse(channel: ContactChannel, response: OtpChallengeResponse, successMessage: string): void {
    this.patchOtpState(channel, {
      challengeId: response.challenge_id,
      recipient: response.recipient,
      otp: '',
      sent: true,
      verified: false,
      devCode: response.dev_code ?? '',
      info: response.message || successMessage,
      error: '',
      resendRemainingSeconds: response.resend_available_in_seconds,
      resendsRemaining: response.resends_remaining,
      attemptsRemaining: response.attempts_remaining,
      blockedMessage: response.blocked_until ? 'OTP requests are temporarily blocked. Please try again later.' : '',
    });
  }

  private handleOtpError(channel: ContactChannel, err: HttpErrorResponse): void {
    const detail = err.error?.detail;
    const payload = typeof detail === 'object' && detail ? detail : null;
    this.patchOtpState(channel, {
      error: payload?.message ?? this.extractErrorMessage(err, 'OTP request failed.'),
      blockedMessage: payload?.code === 'otp_temporarily_blocked' ? payload.message : '',
      resendRemainingSeconds: payload?.resend_available_in_seconds ?? this.getOtpState(channel).resendRemainingSeconds,
      attemptsRemaining: payload?.attempts_remaining ?? this.getOtpState(channel).attemptsRemaining,
    });
  }

  private extractErrorMessage(err: HttpErrorResponse, fallback: string): string {
    const detail = err.error?.detail;
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail.message === 'string') return detail.message;
    return fallback;
  }
}
