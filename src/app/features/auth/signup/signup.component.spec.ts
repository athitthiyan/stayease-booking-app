import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { SignupComponent } from './signup.component';
import { AuthService } from '../../../core/services/auth.service';
import { BookingSearchStore } from '../../../core/services/booking-search.store';

describe('SignupComponent', () => {
  const authService = {
    signup: jest.fn(),
    requestOtpChallenge: jest.fn(),
    verifyOtpChallenge: jest.fn(),
    loginWithMicrosoft: jest.fn().mockResolvedValue(undefined),
    loginWithGoogle: jest.fn().mockResolvedValue(undefined),
  };
  const bookingSearchStore = {
    getAndClearRedirectIntent: jest.fn((): string | null => null),
  };

  beforeEach(async () => {
    Object.values(authService).forEach(value => typeof value === 'function' && (value as jest.Mock).mockReset?.());
    authService.loginWithMicrosoft.mockResolvedValue(undefined);
    authService.loginWithGoogle.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [SignupComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: BookingSearchStore, useValue: bookingSearchStore },
      ],
    }).compileComponents();
  });

  function setValidForm(component: SignupComponent) {
    component.form.setValue({
      full_name: 'Alex Doe',
      email: 'alex@example.com',
      phone: '+91 90000 00001',
      password: 'StrongPass1',
      confirmPassword: 'StrongPass1',
    });
  }

  it('requires both OTP channels before submitting signup', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    component.onSubmit();

    expect(authService.signup).not.toHaveBeenCalled();
    expect(component.canSubmit()).toBe(false);
  });

  it('requests and verifies email OTP', () => {
    authService.requestOtpChallenge.mockReturnValue(of({
      challenge_id: 'email-1',
      flow: 'signup',
      channel: 'email',
      recipient: 'alex@example.com',
      message: 'OTP sent successfully.',
      expires_in_seconds: 300,
      resend_available_in_seconds: 30,
      resends_remaining: 3,
      attempts_remaining: 5,
      max_resends: 3,
      max_attempts: 5,
      dev_code: '123456',
    }));
    authService.verifyOtpChallenge.mockReturnValue(of({
      challenge_id: 'email-1',
      flow: 'signup',
      channel: 'email',
      recipient: 'alex@example.com',
      message: 'OTP verified successfully.',
    }));

    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    component.requestOtp('email');
    expect(authService.requestOtpChallenge).toHaveBeenCalledWith({
      flow: 'signup',
      channel: 'email',
      recipient: 'alex@example.com',
    });
    expect(component.emailOtp().challengeId).toBe('email-1');

    component.updateOtpValue('email', '123456');
    component.verifyOtp('email');
    expect(authService.verifyOtpChallenge).toHaveBeenCalledWith({ challenge_id: 'email-1', otp: '123456' });
    expect(component.emailOtp().verified).toBe(true);
  });

  it('submits signup after both verifications succeed', () => {
    authService.signup.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    setValidForm(component);

    component.emailOtp.update(state => ({ ...state, verified: true, challengeId: 'email-1' }));
    component.phoneOtp.update(state => ({ ...state, verified: true, challengeId: 'phone-1' }));
    component.onSubmit();

    expect(authService.signup).toHaveBeenCalledWith({
      full_name: 'Alex Doe',
      email: 'alex@example.com',
      phone: '+91 90000 00001',
      password: 'StrongPass1',
      email_challenge_id: 'email-1',
      phone_challenge_id: 'phone-1',
    });
    expect(navigateSpy).toHaveBeenCalledWith('/');
  });

  it('surfaces OTP and signup errors', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    authService.requestOtpChallenge.mockReturnValueOnce(throwError(() => ({ error: { detail: { message: 'Temporarily blocked' } } })));
    component.requestOtp('phone');
    expect(component.phoneOtp().error).toBe('Temporarily blocked');

    component.emailOtp.update(state => ({ ...state, verified: true, challengeId: 'email-1' }));
    component.phoneOtp.update(state => ({ ...state, verified: true, challengeId: 'phone-1' }));
    authService.signup.mockReturnValueOnce(throwError(() => ({ error: { detail: 'Signup failed now' } })));
    component.onSubmit();
    expect(component.errorMsg()).toBe('Signup failed now');
  });

  it('tickCountdown decrements the countdown for a given channel', fakeAsync(() => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.emailOtp.update(state => ({ ...state, resendRemainingSeconds: 5 }));

    tick(1000);
    expect(component.emailOtp().resendRemainingSeconds).toBe(4);

    tick(1000);
    expect(component.emailOtp().resendRemainingSeconds).toBe(3);

    tick(3000);
    expect(component.emailOtp().resendRemainingSeconds).toBe(0);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('tickCountdown does nothing when resendRemainingSeconds is 0', fakeAsync(() => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.phoneOtp.update(state => ({ ...state, resendRemainingSeconds: 0 }));

    tick(1000);
    expect(component.phoneOtp().resendRemainingSeconds).toBe(0);

    tick(1000);
    expect(component.phoneOtp().resendRemainingSeconds).toBe(0);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('extractErrorMessage handles nested detail.message format in errors', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    authService.signup.mockReturnValueOnce(throwError(() => ({ error: { detail: { message: 'Account already exists' } } })));
    component.emailOtp.update(state => ({ ...state, verified: true, challengeId: 'email-1' }));
    component.phoneOtp.update(state => ({ ...state, verified: true, challengeId: 'phone-1' }));
    component.onSubmit();

    expect(component.errorMsg()).toBe('Account already exists');
  });

  it('extractErrorMessage returns fallback when detail has no message', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    authService.signup.mockReturnValueOnce(throwError(() => ({ error: { detail: { code: 'unknown' } } })));
    component.emailOtp.update(state => ({ ...state, verified: true, challengeId: 'email-1' }));
    component.phoneOtp.update(state => ({ ...state, verified: true, challengeId: 'phone-1' }));
    component.onSubmit();

    expect(component.errorMsg()).toBe('Signup failed. Please try again.');
  });

  it('handleOtpError sets blockedMessage when code is otp_temporarily_blocked', () => {
    authService.requestOtpChallenge.mockReturnValue(
      throwError(() => ({
        error: {
          detail: {
            code: 'otp_temporarily_blocked',
            message: 'Too many OTP requests',
            resend_available_in_seconds: 120,
            attempts_remaining: 0
          }
        }
      }))
    );

    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    component.requestOtp('email');

    expect(component.emailOtp().blockedMessage).toBe('Too many OTP requests');
    expect(component.emailOtp().error).toBe('Too many OTP requests');
    expect(component.emailOtp().resendRemainingSeconds).toBe(120);
  });

  it('extractErrorMessage with object detail that has no message returns fallback', () => {
    authService.requestOtpChallenge.mockReturnValue(
      throwError(() => ({
        error: { detail: { code: 'unknown_error', timestamp: 1234567890 } }
      }))
    );

    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    component.requestOtp('phone');

    expect(component.phoneOtp().error).toBe('OTP request failed.');
  });

  it('tickCountdown does nothing when resendRemainingSeconds is already 0', fakeAsync(() => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.emailOtp.update(state => ({ ...state, resendRemainingSeconds: 0 }));

    tick(5000);

    expect(component.emailOtp().resendRemainingSeconds).toBe(0);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('togglePassword toggles password visibility', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    expect(component.showPassword()).toBe(false);
    component.togglePassword();
    expect(component.showPassword()).toBe(true);
    component.togglePassword();
    expect(component.showPassword()).toBe(false);
  });

  it('isFieldInvalid returns false for valid untouched field', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    expect(component.isFieldInvalid('full_name')).toBe(false);
    expect(component.isFieldInvalid('email')).toBe(false);
    expect(component.isFieldInvalid('password')).toBe(false);
  });

  it('isFieldInvalid returns false for valid touched field', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);
    component.form.get('full_name')?.markAsTouched();

    expect(component.isFieldInvalid('full_name')).toBe(false);
  });

  it('isFieldInvalid returns true for invalid touched field', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    const fullNameCtrl = component.form.get('full_name');
    fullNameCtrl?.markAsTouched();
    expect(component.isFieldInvalid('full_name')).toBe(true);
  });

  it('isFieldInvalid returns false for invalid untouched field', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    const emailCtrl = component.form.get('email');
    emailCtrl?.setValue('invalid-email');
    expect(component.isFieldInvalid('email')).toBe(false);
  });

  it('isConfirmInvalid returns false when passwords match and field is untouched', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    expect(component.isConfirmInvalid()).toBe(false);
  });

  it('isConfirmInvalid returns true when passwords do not match and field is touched', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.form.setValue({
      full_name: 'Alex Doe',
      email: 'alex@example.com',
      phone: '+91 90000 00001',
      password: 'StrongPass1',
      confirmPassword: 'DifferentPass2',
    });
    component.form.get('confirmPassword')?.markAsTouched();

    expect(component.isConfirmInvalid()).toBe(true);
  });

  it('isConfirmInvalid returns false when passwords match and field is touched', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);
    component.form.get('confirmPassword')?.markAsTouched();

    expect(component.isConfirmInvalid()).toBe(false);
  });

  it('requestOtp early returns when control is invalid', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.form.get('email')?.setValue('invalid-email');
    component.requestOtp('email');

    expect(authService.requestOtpChallenge).not.toHaveBeenCalled();
  });

  it('requestOtp trims recipient before sending', () => {
    authService.requestOtpChallenge.mockReturnValue(of({
      challenge_id: 'phone-1',
      flow: 'signup',
      channel: 'phone',
      recipient: '+91 90000 00001',
      message: 'OTP sent successfully.',
      expires_in_seconds: 300,
      resend_available_in_seconds: 30,
      resends_remaining: 3,
      attempts_remaining: 5,
      max_resends: 3,
      max_attempts: 5,
      dev_code: '123456',
    }));

    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    component.form.get('phone')?.setValue('  +91 90000 00001  ');
    component.requestOtp('phone');

    expect(authService.requestOtpChallenge).toHaveBeenCalledWith({
      flow: 'signup',
      channel: 'phone',
      recipient: '+91 90000 00001',
    });
  });

  it('verifyOtp early returns when OTP length is not 6', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.emailOtp.update(state => ({ ...state, otp: '12345', challengeId: 'email-1' }));
    component.verifyOtp('email');

    expect(authService.verifyOtpChallenge).not.toHaveBeenCalled();
  });

  it('verifyOtp early returns when challengeId is empty', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.emailOtp.update(state => ({ ...state, otp: '123456', challengeId: '' }));
    component.verifyOtp('email');

    expect(authService.verifyOtpChallenge).not.toHaveBeenCalled();
  });

  it('verifyOtp clears error and blockedMessage on success', () => {
    authService.verifyOtpChallenge.mockReturnValue(of({
      challenge_id: 'email-1',
      flow: 'signup',
      channel: 'email',
      recipient: 'alex@example.com',
      message: 'OTP verified successfully.',
    }));

    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.emailOtp.update(state => ({
      ...state,
      otp: '123456',
      challengeId: 'email-1',
      error: 'Previous error',
      blockedMessage: 'Previous block',
    }));
    component.verifyOtp('email');

    expect(component.emailOtp().error).toBe('');
    expect(component.emailOtp().blockedMessage).toBe('');
  });

  it('signInWithGoogle calls authService.loginWithGoogle', fakeAsync(() => {
    authService.loginWithGoogle.mockResolvedValue(undefined);
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.signInWithGoogle();
    tick();

    expect(authService.loginWithGoogle).toHaveBeenCalled();
    expect(component.socialLoading()).toBe(true);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('signInWithGoogle handles error and shows error message', fakeAsync(() => {
    authService.loginWithGoogle.mockRejectedValue(new Error('Google auth failed'));
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.signInWithGoogle();
    tick();

    expect(component.errorMsg()).toBe('Google auth failed');
    expect(component.socialLoading()).toBe(false);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('signInWithGoogle sets error message to default when error has no message', fakeAsync(() => {
    authService.loginWithGoogle.mockRejectedValue(new Error(''));
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.signInWithGoogle();
    tick();

    expect(component.errorMsg()).toBe('Google Sign-In failed. Please try again.');
    expect(component.socialLoading()).toBe(false);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('signInWithMicrosoft calls authService.loginWithMicrosoft', fakeAsync(async () => {
    authService.loginWithMicrosoft.mockResolvedValue(undefined);
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.signInWithMicrosoft();
    tick();

    expect(authService.loginWithMicrosoft).toHaveBeenCalled();
    expect(component.socialLoading()).toBe(true);
    component.ngOnDestroy();
    discardPeriodicTasks();
  }));

  it('signInWithMicrosoft handles error and shows error message', async () => {
    authService.loginWithMicrosoft.mockRejectedValue(new Error('Microsoft auth failed'));
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    await component.signInWithMicrosoft();

    expect(component.errorMsg()).toBe('Microsoft Sign-In failed. Please try again.');
    expect(component.socialLoading()).toBe(false);
  });

  it('onSubmit early returns when form is invalid', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.form.setValue({
      full_name: '',
      email: 'alex@example.com',
      phone: '+91 90000 00001',
      password: 'StrongPass1',
      confirmPassword: 'StrongPass1',
    });

    component.onSubmit();

    expect(authService.signup).not.toHaveBeenCalled();
  });

  it('onSubmit early returns when OTP verifications are not complete', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    component.emailOtp.update(state => ({ ...state, verified: true, challengeId: 'email-1' }));
    component.phoneOtp.update(state => ({ ...state, verified: false, challengeId: '' }));

    component.onSubmit();

    expect(authService.signup).not.toHaveBeenCalled();
  });

  it('onSubmit early returns when already loading', () => {
    authService.signup.mockReturnValue(of({}));
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    component.emailOtp.update(state => ({ ...state, verified: true, challengeId: 'email-1' }));
    component.phoneOtp.update(state => ({ ...state, verified: true, challengeId: 'phone-1' }));
    component.loading.set(true);

    component.onSubmit();

    expect(authService.signup).not.toHaveBeenCalled();
  });

  it('onSubmit marks all fields as touched before validation', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    component.onSubmit();

    expect(component.form.get('full_name')?.touched).toBe(true);
    expect(component.form.get('email')?.touched).toBe(true);
    expect(component.form.get('phone')?.touched).toBe(true);
    expect(component.form.get('password')?.touched).toBe(true);
    expect(component.form.get('confirmPassword')?.touched).toBe(true);
  });

  it('onSubmit clears previous error message', () => {
    authService.signup.mockReturnValue(of({}));
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    component.errorMsg.set('Previous error');
    component.emailOtp.update(state => ({ ...state, verified: true, challengeId: 'email-1' }));
    component.phoneOtp.update(state => ({ ...state, verified: true, challengeId: 'phone-1' }));

    component.onSubmit();

    expect(component.errorMsg()).toBe('');
  });

  it('onSubmit navigates to intended route when redirect intent exists', () => {
    authService.signup.mockReturnValue(of({}));
    bookingSearchStore.getAndClearRedirectIntent.mockReturnValue('/search-results');

    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    setValidForm(component);
    component.emailOtp.update(state => ({ ...state, verified: true, challengeId: 'email-1' }));
    component.phoneOtp.update(state => ({ ...state, verified: true, challengeId: 'phone-1' }));

    component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith('/search-results');
  });

  it('onSubmit handles signup error and resets loading state', () => {
    authService.signup.mockReturnValue(throwError(() => ({ error: { detail: 'Signup error message' } })));
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    component.emailOtp.update(state => ({ ...state, verified: true, challengeId: 'email-1' }));
    component.phoneOtp.update(state => ({ ...state, verified: true, challengeId: 'phone-1' }));

    component.onSubmit();

    expect(component.errorMsg()).toBe('Signup error message');
    expect(component.loading()).toBe(false);
  });

  it('verifyOtp handles error and resets verifying state', () => {
    authService.verifyOtpChallenge.mockReturnValue(
      throwError(() => ({
        error: { detail: { message: 'Invalid OTP' } }
      }))
    );

    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.emailOtp.update(state => ({ ...state, otp: '123456', challengeId: 'email-1' }));
    component.verifyOtp('email');

    expect(component.emailOtp().verifying).toBe(false);
    expect(component.emailOtp().error).toBe('Invalid OTP');
  });

  it('requestOtp handles error and resets sending state', () => {
    authService.requestOtpChallenge.mockReturnValue(
      throwError(() => ({
        error: { detail: 'Request failed' }
      }))
    );

    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    component.requestOtp('phone');

    expect(component.phoneOtp().sending).toBe(false);
    expect(component.phoneOtp().error).toBe('Request failed');
  });

  it('updateOtpValue sanitizes input to only digits and limits to 6 characters', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.updateOtpValue('email', 'abc123def456ghi');
    expect(component.emailOtp().otp).toBe('123456');

    component.updateOtpValue('email', '12abc34');
    expect(component.emailOtp().otp).toBe('1234');
  });

  it('updateOtpValue clears error message', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.emailOtp.update(state => ({ ...state, error: 'Previous error' }));
    component.updateOtpValue('email', '123456');

    expect(component.emailOtp().error).toBe('');
  });

  it('canSubmit returns false when form is invalid', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.form.setValue({
      full_name: '',
      email: 'alex@example.com',
      phone: '+91 90000 00001',
      password: 'StrongPass1',
      confirmPassword: 'StrongPass1',
    });

    expect(component.canSubmit()).toBe(false);
  });

  it('canSubmit returns false when email OTP is not verified', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    component.emailOtp.update(state => ({ ...state, verified: false }));
    component.phoneOtp.update(state => ({ ...state, verified: true, challengeId: 'phone-1' }));

    expect(component.canSubmit()).toBe(false);
  });

  it('canSubmit returns true when all conditions are met', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;
    setValidForm(component);

    component.emailOtp.update(state => ({ ...state, verified: true, challengeId: 'email-1' }));
    component.phoneOtp.update(state => ({ ...state, verified: true, challengeId: 'phone-1' }));

    expect(component.canSubmit()).toBe(true);
  });

  it('form resets email OTP state when email changes', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.emailOtp.update(state => ({
      ...state,
      verified: true,
      challengeId: 'email-1',
      otp: '123456',
      sent: true,
    }));

    component.form.get('email')?.setValue('newemail@example.com');

    expect(component.emailOtp().verified).toBe(false);
    expect(component.emailOtp().challengeId).toBe('');
    expect(component.emailOtp().otp).toBe('');
  });

  it('form resets phone OTP state when phone changes', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    const component = fixture.componentInstance;

    component.phoneOtp.update(state => ({
      ...state,
      verified: true,
      challengeId: 'phone-1',
      otp: '123456',
      sent: true,
    }));

    component.form.get('phone')?.setValue('+91 99999 99999');

    expect(component.phoneOtp().verified).toBe(false);
    expect(component.phoneOtp().challengeId).toBe('');
    expect(component.phoneOtp().otp).toBe('');
  });
});
