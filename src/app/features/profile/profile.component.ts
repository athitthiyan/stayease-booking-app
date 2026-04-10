import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { OtpChallengeResponse, UserResponse } from '../../core/models/auth.model';

type ContactChannel = 'email' | 'phone';

interface OtpUiState {
  sending: boolean;
  verifying: boolean;
  sent: boolean;
  verified: boolean;
  challengeId: string;
  otp: string;
  devCode: string;
  info: string;
  error: string;
  resendRemainingSeconds: number;
  blockedMessage: string;
}

function createOtpState(): OtpUiState {
  return {
    sending: false,
    verifying: false,
    sent: false,
    verified: false,
    challengeId: '',
    otp: '',
    devCode: '',
    info: '',
    error: '',
    resendRemainingSeconds: 0,
    blockedMessage: '',
  };
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, NavbarComponent],
  template: `
    <app-navbar />

    <main class="profile-page container">
      <div class="profile-header">
        <div class="avatar">
          @if (user()?.avatar_url) {
            <img [src]="user()!.avatar_url" [alt]="user()!.full_name" />
          } @else {
            <span class="avatar-initials">{{ initials() }}</span>
          }
        </div>
        <div class="profile-meta">
          <h1>{{ user()?.full_name }}</h1>
          <p class="email">{{ user()?.email }}</p>
          <p class="member-since">Member since {{ memberSince() }}</p>
        </div>
      </div>

      <div class="profile-grid">
        <section class="profile-card">
          <h2>Edit Profile</h2>

          @if (successMsg()) {
            <div class="alert alert--success">{{ successMsg() }}</div>
          }
          @if (errorMsg()) {
            <div class="alert alert--error">{{ errorMsg() }}</div>
          }

          <form [formGroup]="profileForm" (ngSubmit)="saveProfile()" novalidate>
            <div class="form-group">
              <label for="full_name">Full name</label>
              <input id="full_name" type="text" formControlName="full_name" />
            </div>

            <div class="form-group">
              <label for="email">Email address</label>
              <input id="email" type="email" formControlName="email" />
              <div class="otp-panel">
                <div class="otp-panel__header">
                  <span>Email verification</span>
                  @if (!hasEmailChanged() && user()?.is_email_verified) {
                    <span class="badge badge--verified">Verified</span>
                  } @else if (emailOtp().verified) {
                    <span class="badge badge--verified">Verified</span>
                  }
                </div>
                <button
                  type="button"
                  class="btn btn--secondary btn--full"
                  (click)="requestOtp('email')"
                  [disabled]="emailOtp().sending || !profileForm.controls.email.valid || (!hasEmailChanged() && !!user()?.is_email_verified)"
                >
                  @if (emailOtp().sending) { Sending OTP... } @else if (emailOtp().sent) { Resend OTP } @else { Send OTP }
                </button>
                @if (hasEmailChanged() && emailOtp().sent && !emailOtp().verified) {
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
              <input id="phone" type="tel" formControlName="phone" placeholder="+91 98765 43210" />
              <div class="otp-panel">
                <div class="otp-panel__header">
                  <span>Phone verification</span>
                  @if (!hasPhoneChanged() && user()?.phone_verified) {
                    <span class="badge badge--verified">Verified</span>
                  } @else if (phoneOtp().verified) {
                    <span class="badge badge--verified">Verified</span>
                  }
                </div>
                <button
                  type="button"
                  class="btn btn--secondary btn--full"
                  (click)="requestOtp('phone')"
                  [disabled]="phoneOtp().sending || !profileForm.controls.phone.valid || (!hasPhoneChanged() && !!user()?.phone_verified)"
                >
                  @if (phoneOtp().sending) { Sending OTP... } @else if (phoneOtp().sent) { Resend OTP } @else { Send OTP }
                </button>
                @if (hasPhoneChanged() && phoneOtp().sent && !phoneOtp().verified) {
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

            <button type="submit" class="btn btn--primary" [disabled]="saving() || !canSaveProfile()">
              @if (saving()) { Saving... } @else { Save changes }
            </button>
          </form>
        </section>

        <section class="profile-card">
          <h2>Change Password</h2>

          @if (pwSuccessMsg()) {
            <div class="alert alert--success">{{ pwSuccessMsg() }}</div>
          }
          @if (pwErrorMsg()) {
            <div class="alert alert--error">{{ pwErrorMsg() }}</div>
          }

          <form [formGroup]="passwordForm" (ngSubmit)="changePassword()" novalidate>
            <div class="form-group">
              <label for="current_password">Current password</label>
              <input id="current_password" type="password" formControlName="current_password" />
            </div>

            <div class="form-group">
              <label for="new_password">New password</label>
              <input id="new_password" type="password" formControlName="new_password" />
            </div>

            <button type="submit" class="btn btn--primary" [disabled]="changingPw()">
              @if (changingPw()) { Updating... } @else { Update password }
            </button>
          </form>
        </section>
      </div>

      <div class="quick-links">
        <a routerLink="/bookings" class="quick-link-card">
          <span>My Bookings</span>
        </a>
        <a routerLink="/wishlist" class="quick-link-card">
          <span>Saved Stays</span>
        </a>
      </div>
    </main>
  `,
  styles: [`
    .profile-page { padding-top: 120px; padding-bottom: var(--space-4xl); min-height: 100vh; }
    .profile-header { display: flex; align-items: center; gap: var(--space-xl); margin-bottom: var(--space-2xl); }
    .avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      overflow: hidden;
      background: var(--gradient-gold);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .avatar-initials { font-size: 1.8rem; font-weight: 700; color: #000; }
    .email, .member-since { color: var(--color-text-muted); margin: 0; }
    .profile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-xl); margin-bottom: var(--space-xl); }
    .profile-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      padding: var(--space-xl);
      display: grid;
      gap: var(--space-lg);
    }
    .alert { padding: 12px 16px; border-radius: var(--radius-md); font-size: 14px; }
    .alert--success { background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); color: #86efac; }
    .alert--error { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; }
    .form-group { display: grid; gap: 6px; }
    input {
      padding: 12px 16px;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      color: var(--color-text);
      font-size: 15px;
      box-sizing: border-box;
    }
    .otp-panel {
      display: grid;
      gap: 10px;
      padding: 12px;
      border: 1px solid rgba(94, 170, 255, 0.22);
      border-radius: var(--radius-md);
      background: rgba(94, 170, 255, 0.06);
    }
    .otp-panel__header { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 13px; font-weight: 600; }
    .otp-inline { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
    .badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .badge--verified { background: rgba(34, 197, 94, 0.18); color: #86efac; }
    .field-error { color: #f87171; font-size: 12px; }
    .field-success { color: #86efac; font-size: 12px; }
    .field-hint { color: var(--color-text-muted); font-size: 12px; }
    .otp-dev { color: var(--color-primary); font-size: 12px; font-weight: 700; }
    .btn--full { width: 100%; justify-content: center; }
    .quick-links { display: flex; gap: var(--space-lg); flex-wrap: wrap; }
    .quick-link-card {
      display: flex;
      align-items: center;
      padding: var(--space-lg) var(--space-xl);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      color: var(--color-text);
      font-weight: 500;
    }
  `],
})
export class ProfileComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private subscriptions = new Subscription();

  user = signal<UserResponse | null>(this.authService.currentUser);
  saving = signal(false);
  successMsg = signal('');
  errorMsg = signal('');
  changingPw = signal(false);
  pwSuccessMsg = signal('');
  pwErrorMsg = signal('');
  emailOtp = signal<OtpUiState>(createOtpState());
  phoneOtp = signal<OtpUiState>(createOtpState());

  profileForm = this.fb.nonNullable.group({
    full_name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s()]{7,30}$/)]],
  });

  passwordForm = this.fb.nonNullable.group({
    current_password: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(10)]],
  });

  private countdownId = window.setInterval(() => {
    this.tickCountdown('email');
    this.tickCountdown('phone');
  }, 1000);

  ngOnInit(): void {
    this.authService.getMe().subscribe(user => {
      this.setUser(user);
    });

    this.subscriptions.add(this.profileForm.controls.email.valueChanges.subscribe(() => this.onContactChanged('email')));
    this.subscriptions.add(this.profileForm.controls.phone.valueChanges.subscribe(() => this.onContactChanged('phone')));
  }

  ngOnDestroy(): void {
    window.clearInterval(this.countdownId);
    this.subscriptions.unsubscribe();
  }

  initials(): string {
    const name = this.user()?.full_name ?? '';
    return name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2);
  }

  memberSince(): string {
    const value = this.user()?.created_at;
    return value ? new Date(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
  }

  hasEmailChanged(): boolean {
    const current = (this.user()?.email ?? '').trim().toLowerCase();
    return this.profileForm.controls.email.value.trim().toLowerCase() !== current;
  }

  hasPhoneChanged(): boolean {
    const current = this.normalizePhone(this.user()?.phone ?? '');
    return this.normalizePhone(this.profileForm.controls.phone.value) !== current;
  }

  canSaveProfile(): boolean {
    if (!this.profileForm.valid) return false;
    if (this.hasEmailChanged() && !this.emailOtp().verified) return false;
    if (this.hasPhoneChanged() && !this.phoneOtp().verified) return false;
    return true;
  }

  updateOtpValue(channel: ContactChannel, raw: string): void {
    this.patchOtpState(channel, { otp: raw.replace(/\D/g, '').slice(0, 6), error: '' });
  }

  requestOtp(channel: ContactChannel): void {
    const control = channel === 'email' ? this.profileForm.controls.email : this.profileForm.controls.phone;
    control.markAsTouched();
    if (control.invalid) return;

    this.patchOtpState(channel, { sending: true, error: '', blockedMessage: '' });
    this.authService.requestOtpChallenge({
      flow: 'profile',
      channel,
      recipient: control.value.trim(),
    }).subscribe({
      next: response => {
        this.applyChallengeResponse(channel, response);
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

    this.patchOtpState(channel, { verifying: true, error: '' });
    this.authService.verifyOtpChallenge({
      challenge_id: state.challengeId,
      otp: state.otp,
    }).subscribe({
      next: () => {
        this.patchOtpState(channel, {
          verifying: false,
          verified: true,
          sent: false,
          info: `${channel === 'email' ? 'Email' : 'Phone'} verified successfully.`,
        });
      },
      error: (err: HttpErrorResponse) => {
        this.handleOtpError(channel, err);
        this.patchOtpState(channel, { verifying: false });
      },
    });
  }

  saveProfile(): void {
    this.profileForm.markAllAsTouched();
    if (!this.canSaveProfile() || this.saving()) return;

    this.saving.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    const payload = {
      full_name: this.profileForm.controls.full_name.value,
      email: this.profileForm.controls.email.value,
      phone: this.profileForm.controls.phone.value,
      email_challenge_id: this.hasEmailChanged() ? this.emailOtp().challengeId : undefined,
      phone_challenge_id: this.hasPhoneChanged() ? this.phoneOtp().challengeId : undefined,
    };

    this.authService.updateProfile(payload).subscribe({
      next: user => {
        this.setUser(user);
        this.emailOtp.set(createOtpState());
        this.phoneOtp.set(createOtpState());
        this.successMsg.set('Profile updated successfully.');
        this.saving.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMsg.set(this.extractErrorMessage(err, 'Update failed.'));
        this.saving.set(false);
      },
    });
  }

  changePassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.changingPw()) return;

    this.changingPw.set(true);
    this.pwSuccessMsg.set('');
    this.pwErrorMsg.set('');

    this.authService.changePassword(this.passwordForm.getRawValue()).subscribe({
      next: () => {
        this.pwSuccessMsg.set('Password changed successfully.');
        this.passwordForm.reset();
        this.changingPw.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.pwErrorMsg.set(this.extractErrorMessage(err, 'Password change failed.'));
        this.changingPw.set(false);
      },
    });
  }

  private setUser(user: UserResponse): void {
    this.user.set(user);
    this.profileForm.patchValue({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone ?? '',
    }, { emitEvent: false });
  }

  private normalizePhone(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
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

  private onContactChanged(channel: ContactChannel): void {
    this.getOtpSignal(channel).set(createOtpState());
  }

  private tickCountdown(channel: ContactChannel): void {
    const state = this.getOtpState(channel);
    if (state.resendRemainingSeconds <= 0) return;
    this.patchOtpState(channel, { resendRemainingSeconds: state.resendRemainingSeconds - 1 });
  }

  private applyChallengeResponse(channel: ContactChannel, response: OtpChallengeResponse): void {
    this.patchOtpState(channel, {
      challengeId: response.challenge_id,
      sent: true,
      verified: false,
      otp: '',
      devCode: response.dev_code ?? '',
      info: response.message,
      error: '',
      resendRemainingSeconds: response.resend_available_in_seconds,
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
    });
  }

  private extractErrorMessage(err: HttpErrorResponse, fallback: string): string {
    const detail = err.error?.detail;
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail.message === 'string') return detail.message;
    return fallback;
  }
}
