import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../../core/services/auth.service';

describe('ForgotPasswordComponent', () => {
  const authService = {
    forgotPassword: jest.fn(),
    verifyOtpChallenge: jest.fn(),
  };

  beforeEach(async () => {
    authService.forgotPassword.mockReset();
    authService.verifyOtpChallenge.mockReset();

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
  });

  it('requests forgot-password OTP and stores challenge state', () => {
    authService.forgotPassword.mockReturnValue(of({
      challenge_id: 'reset-1',
      flow: 'password_reset',
      channel: 'email',
      recipient: 'test@example.com',
      message: 'If the account exists, an OTP has been sent.',
      expires_in_seconds: 300,
      resend_available_in_seconds: 30,
      resends_remaining: 3,
      attempts_remaining: 5,
      max_resends: 3,
      max_attempts: 5,
      dev_code: '123456',
    }));

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ channel: 'email', recipient: 'test@example.com' });

    component.requestOtp();

    expect(authService.forgotPassword).toHaveBeenCalledWith({ channel: 'email', recipient: 'test@example.com' });
    expect(component.challenge().challengeId).toBe('reset-1');
    expect(component.challenge().devCode).toBe('123456');
  });

  it('verifies OTP and routes to reset-password with reset token', () => {
    authService.verifyOtpChallenge.mockReturnValue(of({
      challenge_id: 'reset-1',
      flow: 'password_reset',
      channel: 'email',
      recipient: 'test@example.com',
      message: 'OTP verified successfully.',
      reset_token: 'session-token',
    }));

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    component.challenge.set({
      sent: true,
      verified: false,
      challengeId: 'reset-1',
      otp: '123456',
      devCode: '',
      info: '',
      error: '',
      resendRemainingSeconds: 0,
      blockedMessage: '',
    });

    component.verifyOtp();

    expect(authService.verifyOtpChallenge).toHaveBeenCalledWith({ challenge_id: 'reset-1', otp: '123456' });
    expect(navigateSpy).toHaveBeenCalledWith(['/auth/reset-password'], { queryParams: { reset_token: 'session-token' } });
    expect(component.challenge().verified).toBe(true);
  });

  it('decrements countdown interval for resendRemainingSeconds', fakeAsync(() => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.challenge.set({
      sent: true,
      verified: false,
      challengeId: 'test-id',
      otp: '',
      devCode: '',
      info: '',
      error: '',
      resendRemainingSeconds: 5,
      blockedMessage: '',
    });

    tick(1000);
    expect(component.challenge().resendRemainingSeconds).toBe(4);

    tick(1000);
    expect(component.challenge().resendRemainingSeconds).toBe(3);

    tick(3000);
    expect(component.challenge().resendRemainingSeconds).toBe(0);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('updateOtpValue sanitizes input and clears error', () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.challenge.set({
      sent: true,
      verified: false,
      challengeId: 'test-id',
      otp: '',
      devCode: '',
      info: '',
      error: 'Previous error',
      resendRemainingSeconds: 0,
      blockedMessage: '',
    });

    component.updateOtpValue('12ab34cd56');
    expect(component.challenge().otp).toBe('123456');
    expect(component.challenge().error).toBe('');
  });

  it('updateOtpValue limits OTP to 6 characters', () => {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.updateOtpValue('123456789');
    expect(component.challenge().otp).toBe('123456');
  });

  it('extractErrorMessage handles nested detail.message format', () => {
    authService.verifyOtpChallenge.mockReturnValue(
      throwError(() => ({
        error: { detail: { message: 'OTP expired' } }
      }))
    );

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.challenge.set({
      sent: true,
      verified: false,
      challengeId: 'test-id',
      otp: '123456',
      devCode: '',
      info: '',
      error: '',
      resendRemainingSeconds: 0,
      blockedMessage: '',
    });

    component.verifyOtp();

    expect(component.challenge().error).toBe('OTP expired');
  });

  it('extractErrorMessage returns fallback when detail has no message property', () => {
    authService.verifyOtpChallenge.mockReturnValue(
      throwError(() => ({
        error: { detail: { code: 'invalid' } }
      }))
    );

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.challenge.set({
      sent: true,
      verified: false,
      challengeId: 'test-id',
      otp: '123456',
      devCode: '',
      info: '',
      error: '',
      resendRemainingSeconds: 0,
      blockedMessage: '',
    });

    component.verifyOtp();

    expect(component.challenge().error).toBe('OTP verification failed.');
  });

  it('applyChallengeResponse sets blockedMessage when response.blocked_until is present', () => {
    authService.forgotPassword.mockReturnValue(of({
      challenge_id: 'reset-1',
      flow: 'password_reset',
      channel: 'email',
      recipient: 'test@example.com',
      message: 'OTP sent, but requests will be blocked',
      expires_in_seconds: 300,
      resend_available_in_seconds: 30,
      resends_remaining: 3,
      attempts_remaining: 5,
      max_resends: 3,
      max_attempts: 5,
      dev_code: '123456',
      blocked_until: '2026-04-10T12:30:00Z',
    }));

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ channel: 'email', recipient: 'test@example.com' });

    component.requestOtp();

    expect(component.challenge().blockedMessage).toBe('OTP requests are temporarily blocked. Please try again later.');
    expect(component.challenge().sent).toBe(true);
  });

  it('verifyOtp handles error with object detail.message format', () => {
    authService.verifyOtpChallenge.mockReturnValue(
      throwError(() => ({
        error: { detail: { message: 'Code has expired' } }
      }))
    );

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.challenge.set({
      sent: true,
      verified: false,
      challengeId: 'test-id',
      otp: '123456',
      devCode: '',
      info: '',
      error: '',
      resendRemainingSeconds: 0,
      blockedMessage: '',
    });

    component.verifyOtp();

    expect(component.challenge().error).toBe('Code has expired');
  });

  it('extractErrorMessage fallback path returns default when detail has no message and is not a string', () => {
    authService.forgotPassword.mockReturnValue(
      throwError(() => ({
        error: { detail: { code: 'some_error', timestamp: 123 } }
      }))
    );

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ channel: 'email', recipient: 'test@example.com' });

    component.requestOtp();

    expect(component.errorMsg()).toBe('Request failed. Please try again.');
  });

  // ── Error message display tests ────────────────────────────────────────────

  it('displays errorMsg signal in the template when an error occurs', () => {
    authService.forgotPassword.mockReturnValue(
      throwError(() => ({
        error: { detail: 'Invalid email address' }
      }))
    );

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ channel: 'email', recipient: 'invalid' });
    fixture.detectChanges();

    component.requestOtp();
    fixture.detectChanges();

    const errorElement = fixture.nativeElement.querySelector('.auth-error');
    expect(errorElement).toBeTruthy();
    expect(errorElement.textContent).toContain('Invalid email address');
    expect(errorElement.getAttribute('role')).toBe('alert');
  });

  it('extracts string detail from error response', () => {
    authService.forgotPassword.mockReturnValue(
      throwError(() => ({
        error: { detail: 'Email not found in the system' }
      }))
    );

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ channel: 'email', recipient: 'test@example.com' });

    component.requestOtp();

    expect(component.errorMsg()).toBe('Email not found in the system');
  });

  it('extracts message from detail object when detail is an object with message property', () => {
    authService.forgotPassword.mockReturnValue(
      throwError(() => ({
        error: { detail: { message: 'Too many OTP requests, try again later' } }
      }))
    );

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ channel: 'email', recipient: 'test@example.com' });

    component.requestOtp();

    expect(component.errorMsg()).toBe('Too many OTP requests, try again later');
  });

  it('returns fallback error message when detail is missing or invalid', () => {
    authService.forgotPassword.mockReturnValue(
      throwError(() => ({
        error: {}
      }))
    );

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ channel: 'email', recipient: 'test@example.com' });

    component.requestOtp();

    expect(component.errorMsg()).toBe('Request failed. Please try again.');
  });

  it('returns fallback error message when error response has no error property', () => {
    authService.forgotPassword.mockReturnValue(
      throwError(() => ({
        message: 'Network error'
      }))
    );

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ channel: 'email', recipient: 'test@example.com' });

    component.requestOtp();

    expect(component.errorMsg()).toBe('Request failed. Please try again.');
  });

  it('clears errorMsg when requesting a new OTP', () => {
    authService.forgotPassword.mockReturnValue(
      throwError(() => ({
        error: { detail: 'First request failed' }
      }))
    );

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ channel: 'email', recipient: 'test@example.com' });

    component.requestOtp();
    expect(component.errorMsg()).toBe('First request failed');

    // Now mock a successful response
    authService.forgotPassword.mockReturnValue(of({
      challenge_id: 'reset-1',
      flow: 'password_reset',
      channel: 'email',
      recipient: 'test@example.com',
      message: 'OTP sent',
      expires_in_seconds: 300,
      resend_available_in_seconds: 30,
      resends_remaining: 3,
      attempts_remaining: 5,
      max_resends: 3,
      max_attempts: 5,
      dev_code: '',
    }));

    component.requestOtp();

    expect(component.errorMsg()).toBe('');
  });

  it('applyChallengeResponse handles dev_code being undefined by setting empty string', () => {
    authService.forgotPassword.mockReturnValue(of({
      challenge_id: 'reset-1',
      flow: 'password_reset',
      channel: 'email',
      recipient: 'test@example.com',
      message: 'OTP sent',
      expires_in_seconds: 300,
      resend_available_in_seconds: 30,
      resends_remaining: 3,
      attempts_remaining: 5,
      max_resends: 3,
      max_attempts: 5,
      dev_code: undefined, // No dev code provided
    }));

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ channel: 'email', recipient: 'test@example.com' });

    component.requestOtp();

    expect(component.challenge().devCode).toBe('');
    expect(component.challenge().sent).toBe(true);
  });
});