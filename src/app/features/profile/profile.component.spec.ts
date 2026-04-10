import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/services/auth.service';
import { UserResponse } from '../../core/models/auth.model';
import { WishlistService } from '../../core/services/wishlist.service';

describe('ProfileComponent', () => {
  const user: UserResponse = {
    id: 1,
    full_name: 'Alex Doe',
    email: 'alex@example.com',
    phone: '+91 90000 00001',
    phone_verified: true,
    is_email_verified: true,
    created_at: '2024-01-01T00:00:00.000Z',
    avatar_url: null,
    is_admin: false,
    is_partner: false,
    is_active: true,
  };

  const authService = {
    currentUser: user,
    getMe: jest.fn(),
    updateProfile: jest.fn(),
    requestOtpChallenge: jest.fn(),
    verifyOtpChallenge: jest.fn(),
    changePassword: jest.fn(),
  };

  beforeEach(async () => {
    authService.getMe.mockReset();
    authService.updateProfile.mockReset();
    authService.requestOtpChallenge.mockReset();
    authService.verifyOtpChallenge.mockReset();
    authService.changePassword.mockReset();

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: WishlistService, useValue: { isSaved: jest.fn(() => false), toggle: jest.fn() } },
      ],
    }).compileComponents();
  });

  it('loads the user and derives display helpers', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.profileForm.getRawValue()).toEqual({
      full_name: 'Alex Doe',
      email: 'alex@example.com',
      phone: '+91 90000 00001',
    });
    expect(component.initials()).toBe('AD');
    expect(component.memberSince()).toContain('2024');
  });

  it('requests and verifies changed contact OTP state', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.requestOtpChallenge.mockReturnValue(of({
      challenge_id: 'phone-1',
      flow: 'profile',
      channel: 'phone',
      recipient: '+91 99999 99999',
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
      challenge_id: 'phone-1',
      flow: 'profile',
      channel: 'phone',
      recipient: '+91 99999 99999',
      message: 'OTP verified successfully.',
    }));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.profileForm.controls.phone.setValue('+91 99999 99999');

    component.requestOtp('phone');
    expect(authService.requestOtpChallenge).toHaveBeenCalledWith({
      flow: 'profile',
      channel: 'phone',
      recipient: '+91 99999 99999',
    });

    component.updateOtpValue('phone', '123456');
    component.verifyOtp('phone');
    expect(authService.verifyOtpChallenge).toHaveBeenCalledWith({ challenge_id: 'phone-1', otp: '123456' });
    expect(component.phoneOtp().verified).toBe(true);
  });

  it('saves profile only when changed contacts are verified', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.updateProfile.mockReturnValue(of({ ...user, phone: '+91 99999 99999' }));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.profileForm.controls.phone.setValue('+91 99999 99999');

    component.saveProfile();
    expect(authService.updateProfile).not.toHaveBeenCalled();

    component.phoneOtp.update(state => ({ ...state, verified: true, challengeId: 'phone-1' }));
    component.saveProfile();
    expect(authService.updateProfile).toHaveBeenCalledWith({
      full_name: 'Alex Doe',
      email: 'alex@example.com',
      phone: '+91 99999 99999',
      email_challenge_id: undefined,
      phone_challenge_id: 'phone-1',
    });
    expect(component.successMsg()).toBe('Profile updated successfully.');
  });

  it('changes password and handles update errors', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.passwordForm.setValue({ current_password: 'OldPassword1', new_password: 'NewPassword1' });
    authService.changePassword.mockReturnValueOnce(of({ message: 'ok' }));
    component.changePassword();
    expect(component.pwSuccessMsg()).toBe('Password changed successfully.');

    component.passwordForm.setValue({ current_password: 'OldPassword1', new_password: 'NewPassword1' });
    authService.updateProfile.mockReturnValueOnce(throwError(() => ({ error: { detail: 'Update failed badly' } })));
    authService.changePassword.mockReturnValueOnce(throwError(() => ({ error: { detail: 'Wrong password' } })));
    component.changePassword();
    expect(component.pwErrorMsg()).toBe('Wrong password');
  });

  it('handles OTP error with otp_temporarily_blocked code', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.requestOtpChallenge.mockReturnValue(throwError(() => ({
      error: {
        detail: {
          code: 'otp_temporarily_blocked',
          message: 'Too many failed attempts. Try again in 5 minutes.',
          resend_available_in_seconds: 300,
        },
      },
    })));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.profileForm.controls.email.setValue('newemail@example.com');

    component.requestOtp('email');

    expect(component.emailOtp().blockedMessage).toBe('Too many failed attempts. Try again in 5 minutes.');
    expect(component.emailOtp().error).toBe('Too many failed attempts. Try again in 5 minutes.');
    expect(component.emailOtp().resendRemainingSeconds).toBe(300);
  });

  it('extracts error message from string detail', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.requestOtpChallenge.mockReturnValue(throwError(() => ({
      error: { detail: 'Simple string error message' },
    })));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.profileForm.controls.email.setValue('newemail@example.com');

    component.requestOtp('email');

    expect(component.emailOtp().error).toBe('Simple string error message');
  });

  it('extracts error message from object detail with message property', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.requestOtpChallenge.mockReturnValue(throwError(() => ({
      error: {
        detail: {
          code: 'some_error',
          message: 'Detailed error from object',
        },
      },
    })));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.profileForm.controls.email.setValue('newemail@example.com');

    component.requestOtp('email');

    expect(component.emailOtp().error).toBe('Detailed error from object');
  });

  it('uses fallback message when error detail is missing or empty', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.requestOtpChallenge.mockReturnValue(throwError(() => ({
      error: {},
    })));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.profileForm.controls.email.setValue('newemail@example.com');

    component.requestOtp('email');

    expect(component.emailOtp().error).toBe('OTP request failed.');
  });

  // Email OTP flow tests
  it('requests OTP for email address change', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.requestOtpChallenge.mockReturnValue(of({
      challenge_id: 'email-1',
      flow: 'profile',
      channel: 'email',
      recipient: 'newemail@example.com',
      message: 'OTP sent successfully.',
      expires_in_seconds: 300,
      resend_available_in_seconds: 30,
      resends_remaining: 3,
      attempts_remaining: 5,
      max_resends: 3,
      max_attempts: 5,
      dev_code: '654321',
    }));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.profileForm.controls.email.setValue('newemail@example.com');

    component.requestOtp('email');

    expect(authService.requestOtpChallenge).toHaveBeenCalledWith({
      flow: 'profile',
      channel: 'email',
      recipient: 'newemail@example.com',
    });
    expect(component.emailOtp().sent).toBe(true);
    expect(component.emailOtp().challengeId).toBe('email-1');
    expect(component.emailOtp().devCode).toBe('654321');
    expect(component.emailOtp().sending).toBe(false);
  });

  it('verifies OTP for email address change', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.requestOtpChallenge.mockReturnValue(of({
      challenge_id: 'email-1',
      flow: 'profile',
      channel: 'email',
      recipient: 'newemail@example.com',
      message: 'OTP sent successfully.',
      expires_in_seconds: 300,
      resend_available_in_seconds: 30,
      resends_remaining: 3,
      attempts_remaining: 5,
      max_resends: 3,
      max_attempts: 5,
    }));
    authService.verifyOtpChallenge.mockReturnValue(of({
      challenge_id: 'email-1',
      flow: 'profile',
      channel: 'email',
      recipient: 'newemail@example.com',
      message: 'OTP verified successfully.',
    }));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.profileForm.controls.email.setValue('newemail@example.com');

    component.requestOtp('email');
    component.updateOtpValue('email', '123456');
    component.verifyOtp('email');

    expect(authService.verifyOtpChallenge).toHaveBeenCalledWith({
      challenge_id: 'email-1',
      otp: '123456',
    });
    expect(component.emailOtp().verified).toBe(true);
    expect(component.emailOtp().info).toBe('Email verified successfully.');
  });

  it('handles email OTP request error with string detail', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.requestOtpChallenge.mockReturnValue(throwError(() => ({
      error: { detail: 'Email already in use' },
    })));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.profileForm.controls.email.setValue('taken@example.com');

    component.requestOtp('email');

    expect(component.emailOtp().error).toBe('Email already in use');
    expect(component.emailOtp().sending).toBe(false);
  });

  it('handles email OTP verification error', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.requestOtpChallenge.mockReturnValue(of({
      challenge_id: 'email-1',
      flow: 'profile',
      channel: 'email',
      recipient: 'newemail@example.com',
      message: 'OTP sent successfully.',
      expires_in_seconds: 300,
      resend_available_in_seconds: 30,
      resends_remaining: 3,
      attempts_remaining: 5,
      max_resends: 3,
      max_attempts: 5,
    }));
    authService.verifyOtpChallenge.mockReturnValue(throwError(() => ({
      error: { detail: 'Invalid OTP' },
    })));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.profileForm.controls.email.setValue('newemail@example.com');

    component.requestOtp('email');
    component.updateOtpValue('email', '000000');
    component.verifyOtp('email');

    expect(component.emailOtp().error).toBe('Invalid OTP');
    expect(component.emailOtp().verifying).toBe(false);
    expect(component.emailOtp().verified).toBe(false);
  });

  // canSaveProfile tests
  it('prevents save when email changed but not verified', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.canSaveProfile()).toBe(true);

    component.profileForm.controls.email.setValue('newemail@example.com');
    expect(component.canSaveProfile()).toBe(false);
  });

  it('prevents save when phone changed but not verified', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.canSaveProfile()).toBe(true);

    component.profileForm.controls.phone.setValue('+91 98765 43210');
    expect(component.canSaveProfile()).toBe(false);
  });

  it('allows save when form is invalid', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.profileForm.controls.email.setValue('invalid-email');
    expect(component.canSaveProfile()).toBe(false);
  });

  it('allows save when both changed contacts are verified', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.profileForm.controls.email.setValue('newemail@example.com');
    component.profileForm.controls.phone.setValue('+91 98765 43210');
    component.emailOtp.update(state => ({ ...state, verified: true }));
    component.phoneOtp.update(state => ({ ...state, verified: true }));

    expect(component.canSaveProfile()).toBe(true);
  });

  // saveProfile tests
  it('saves profile with email and phone challenge IDs when both changed', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.updateProfile.mockReturnValue(of({
      ...user,
      email: 'newemail@example.com',
      phone: '+91 98765 43210',
    }));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.profileForm.controls.email.setValue('newemail@example.com');
    component.profileForm.controls.phone.setValue('+91 98765 43210');
    component.emailOtp.update(state => ({ ...state, verified: true, challengeId: 'email-1' }));
    component.phoneOtp.update(state => ({ ...state, verified: true, challengeId: 'phone-1' }));

    component.saveProfile();

    expect(authService.updateProfile).toHaveBeenCalledWith({
      full_name: 'Alex Doe',
      email: 'newemail@example.com',
      phone: '+91 98765 43210',
      email_challenge_id: 'email-1',
      phone_challenge_id: 'phone-1',
    });
    expect(component.successMsg()).toBe('Profile updated successfully.');
  });

  it('saves profile with only email changed', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.updateProfile.mockReturnValue(of({ ...user, email: 'newemail@example.com' }));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.profileForm.controls.email.setValue('newemail@example.com');
    component.emailOtp.update(state => ({ ...state, verified: true, challengeId: 'email-1' }));

    component.saveProfile();

    expect(authService.updateProfile).toHaveBeenCalledWith({
      full_name: 'Alex Doe',
      email: 'newemail@example.com',
      phone: '+91 90000 00001',
      email_challenge_id: 'email-1',
      phone_challenge_id: undefined,
    });
  });

  it('resets OTP state on successful profile save', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.updateProfile.mockReturnValue(of({
      ...user,
      email: 'newemail@example.com',
    }));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.profileForm.controls.email.setValue('newemail@example.com');
    component.emailOtp.update(state => ({
      ...state,
      verified: true,
      challengeId: 'email-1',
      sent: true,
      otp: '123456',
    }));

    component.saveProfile();

    expect(component.emailOtp().verified).toBe(false);
    expect(component.emailOtp().challengeId).toBe('');
    expect(component.emailOtp().sent).toBe(false);
    expect(component.emailOtp().otp).toBe('');
  });

  it('handles profile save error with string detail', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.updateProfile.mockReturnValue(throwError(() => ({
      error: { detail: 'Email already exists' },
    })));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.profileForm.controls.email.setValue('newemail@example.com');
    component.emailOtp.update(state => ({ ...state, verified: true, challengeId: 'email-1' }));

    component.saveProfile();

    expect(component.errorMsg()).toBe('Email already exists');
    expect(component.saving()).toBe(false);
  });

  it('handles profile save error with object detail', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.updateProfile.mockReturnValue(throwError(() => ({
      error: {
        detail: {
          message: 'Database error occurred',
        },
      },
    })));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.saveProfile();

    expect(component.errorMsg()).toBe('Database error occurred');
  });

  it('prevents double save when already saving', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.updateProfile.mockReturnValue(of(user));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.saving.set(true);
    component.saveProfile();

    expect(authService.updateProfile).not.toHaveBeenCalled();
  });

  // changePassword tests
  it('changes password successfully and resets form', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.changePassword.mockReturnValue(of({ message: 'ok' }));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.passwordForm.setValue({
      current_password: 'OldPassword1',
      new_password: 'NewPassword1234',
    });

    component.changePassword();

    expect(authService.changePassword).toHaveBeenCalledWith({
      current_password: 'OldPassword1',
      new_password: 'NewPassword1234',
    });
    expect(component.pwSuccessMsg()).toBe('Password changed successfully.');
    expect(component.passwordForm.get('current_password')?.value).toBe('');
    expect(component.passwordForm.get('new_password')?.value).toBe('');
    expect(component.changingPw()).toBe(false);
  });

  it('handles password change error with object detail containing message', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.changePassword.mockReturnValue(throwError(() => ({
      error: {
        detail: {
          message: 'Current password is incorrect',
        },
      },
    })));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.passwordForm.setValue({
      current_password: 'WrongPassword',
      new_password: 'NewPassword1234',
    });

    component.changePassword();

    expect(component.pwErrorMsg()).toBe('Current password is incorrect');
    expect(component.changingPw()).toBe(false);
  });

  it('uses fallback message for password change error', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.changePassword.mockReturnValue(throwError(() => ({
      error: {},
    })));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.passwordForm.setValue({
      current_password: 'OldPassword1',
      new_password: 'NewPassword1234',
    });

    component.changePassword();

    expect(component.pwErrorMsg()).toBe('Password change failed.');
  });

  it('prevents double password change when already changing', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.changingPw.set(true);
    component.passwordForm.setValue({
      current_password: 'OldPassword1',
      new_password: 'NewPassword1234',
    });

    component.changePassword();

    expect(authService.changePassword).not.toHaveBeenCalled();
  });

  // verifyOtp guards tests
  it('prevents verify OTP when OTP length is not 6', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.requestOtpChallenge.mockReturnValue(of({
      challenge_id: 'phone-1',
      flow: 'profile',
      channel: 'phone',
      recipient: '+91 99999 99999',
      message: 'OTP sent successfully.',
      expires_in_seconds: 300,
      resend_available_in_seconds: 30,
      resends_remaining: 3,
      attempts_remaining: 5,
      max_resends: 3,
      max_attempts: 5,
    }));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.profileForm.controls.phone.setValue('+91 99999 99999');
    component.requestOtp('phone');
    component.updateOtpValue('phone', '12345'); // Only 5 digits

    component.verifyOtp('phone');

    expect(authService.verifyOtpChallenge).not.toHaveBeenCalled();
  });

  it('prevents verify OTP when challengeId is missing', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.phoneOtp.update(state => ({
      ...state,
      otp: '123456',
      challengeId: '', // Empty challenge ID
    }));

    component.verifyOtp('phone');

    expect(authService.verifyOtpChallenge).not.toHaveBeenCalled();
  });

  // requestOtp guards tests
  it('prevents request OTP when control is invalid', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.profileForm.controls.email.setValue('invalid-email');
    component.requestOtp('email');

    expect(authService.requestOtpChallenge).not.toHaveBeenCalled();
  });

  it('marks control as touched when requesting OTP with invalid control', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.profileForm.controls.email.setValue('invalid-email');
    expect(component.profileForm.controls.email.touched).toBe(false);

    component.requestOtp('email');

    expect(component.profileForm.controls.email.touched).toBe(true);
  });

  // updateOtpValue tests
  it('filters non-digit characters from OTP input', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.updateOtpValue('phone', 'a1b2c3d4e5f6'); // Input with letters

    expect(component.phoneOtp().otp).toBe('123456');
  });

  it('limits OTP to 6 digits on updateOtpValue', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.updateOtpValue('phone', '123456789'); // 9 digits

    expect(component.phoneOtp().otp).toBe('123456');
    expect(component.phoneOtp().otp.length).toBe(6);
  });

  it('clears error when updating OTP value', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.emailOtp.update(state => ({ ...state, error: 'Previous error' }));
    expect(component.emailOtp().error).toBe('Previous error');

    component.updateOtpValue('email', '123456');

    expect(component.emailOtp().error).toBe('');
  });

  // hasEmailChanged/hasPhoneChanged tests
  it('detects when email has changed', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.hasEmailChanged()).toBe(false);

    component.profileForm.controls.email.setValue('different@example.com');

    expect(component.hasEmailChanged()).toBe(true);
  });

  it('ignores whitespace and case when checking email change', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.profileForm.controls.email.setValue('  ALEX@EXAMPLE.COM  ');

    expect(component.hasEmailChanged()).toBe(false);
  });

  it('detects when phone has changed', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.hasPhoneChanged()).toBe(false);

    component.profileForm.controls.phone.setValue('+91 98765 43210');

    expect(component.hasPhoneChanged()).toBe(true);
  });

  it('ignores extra spaces when checking phone change', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.profileForm.controls.phone.setValue('+91  90000  00001'); // Extra spaces

    expect(component.hasPhoneChanged()).toBe(false);
  });

  // normalizePhone tests
  it('normalizes phone by collapsing multiple spaces', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    // Directly test via hasPhoneChanged which uses normalizePhone
    component.profileForm.controls.phone.setValue('+91    90000    00001');

    expect(component.hasPhoneChanged()).toBe(false);
  });

  // applyChallengeResponse tests
  it('applies challenge response with dev_code', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.requestOtpChallenge.mockReturnValue(of({
      challenge_id: 'challenge-123',
      flow: 'profile',
      channel: 'phone',
      recipient: '+91 99999 99999',
      message: 'OTP sent to your phone.',
      expires_in_seconds: 300,
      resend_available_in_seconds: 60,
      resends_remaining: 3,
      attempts_remaining: 5,
      max_resends: 3,
      max_attempts: 5,
      dev_code: '999888',
    }));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.profileForm.controls.phone.setValue('+91 99999 99999');
    component.requestOtp('phone');

    expect(component.phoneOtp().devCode).toBe('999888');
    expect(component.phoneOtp().challengeId).toBe('challenge-123');
    expect(component.phoneOtp().info).toBe('OTP sent to your phone.');
  });

  it('applies challenge response with blocked_until', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.requestOtpChallenge.mockReturnValue(of({
      challenge_id: 'challenge-456',
      flow: 'profile',
      channel: 'email',
      recipient: 'test@example.com',
      message: 'OTP sent to your email.',
      expires_in_seconds: 300,
      resend_available_in_seconds: 600,
      resends_remaining: 0,
      attempts_remaining: 0,
      max_resends: 3,
      max_attempts: 5,
      blocked_until: '2026-04-10T10:30:00Z',
    }));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.profileForm.controls.email.setValue('test@example.com');
    component.requestOtp('email');

    expect(component.emailOtp().blockedMessage).toBe('OTP requests are temporarily blocked. Please try again later.');
    expect(component.emailOtp().resendRemainingSeconds).toBe(600);
  });

  // tickCountdown tests
  it('decrements countdown when resendRemainingSeconds > 0', (done) => {
    jest.useFakeTimers();
    authService.getMe.mockReturnValue(of(user));
    authService.requestOtpChallenge.mockReturnValue(of({
      challenge_id: 'phone-1',
      flow: 'profile',
      channel: 'phone',
      recipient: '+91 99999 99999',
      message: 'OTP sent successfully.',
      expires_in_seconds: 300,
      resend_available_in_seconds: 3,
      resends_remaining: 3,
      attempts_remaining: 5,
      max_resends: 3,
      max_attempts: 5,
    }));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.profileForm.controls.phone.setValue('+91 99999 99999');
    component.requestOtp('phone');

    const initialSeconds = component.phoneOtp().resendRemainingSeconds;
    expect(initialSeconds).toBe(3);

    jest.runOnlyPendingTimers();

    expect(component.phoneOtp().resendRemainingSeconds).toBeLessThan(initialSeconds);

    jest.useRealTimers();
    done();
  });

  it('does not decrement countdown when resendRemainingSeconds is 0', (done) => {
    jest.useFakeTimers();
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.phoneOtp.update(state => ({ ...state, resendRemainingSeconds: 0 }));
    const initialSeconds = component.phoneOtp().resendRemainingSeconds;

    jest.runOnlyPendingTimers();

    expect(component.phoneOtp().resendRemainingSeconds).toBe(initialSeconds);

    jest.useRealTimers();
    done();
  });

  // Cleanup test for interval
  it('clears interval on component destroy', () => {
    const clearIntervalSpy = jest.spyOn(window, 'clearInterval');
    authService.getMe.mockReturnValue(of(user));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    fixture.destroy();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('handles OTP error with blocked_until in payload', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.requestOtpChallenge.mockReturnValue(throwError(() => ({
      error: {
        detail: {
          code: 'otp_temporarily_blocked',
          message: 'Rate limited',
          resend_available_in_seconds: 120,
          blocked_until: '2026-04-10T12:00:00Z',
        },
      },
    })));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.profileForm.controls.phone.setValue('+91 99999 99999');
    component.requestOtp('phone');

    expect(component.phoneOtp().blockedMessage).toBe('Rate limited');
    expect(component.phoneOtp().resendRemainingSeconds).toBe(120);
  });

  it('saves profile without challenge IDs when no contacts changed', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.updateProfile.mockReturnValue(of({
      ...user,
      full_name: 'Alex Doe Jr',
    }));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.profileForm.controls.full_name.setValue('Alex Doe Jr');

    component.saveProfile();

    expect(authService.updateProfile).toHaveBeenCalledWith({
      full_name: 'Alex Doe Jr',
      email: 'alex@example.com',
      phone: '+91 90000 00001',
      email_challenge_id: undefined,
      phone_challenge_id: undefined,
    });
  });

  it('resets OTP state when contact changes', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.emailOtp.update(state => ({
      ...state,
      sent: true,
      verified: true,
      otp: '123456',
      error: 'Some error',
    }));

    component.profileForm.controls.email.setValue('newemail@example.com');

    expect(component.emailOtp().sent).toBe(false);
    expect(component.emailOtp().verified).toBe(false);
    expect(component.emailOtp().otp).toBe('');
    expect(component.emailOtp().error).toBe('');
  });

  it('handles password form validation before submit', () => {
    authService.getMe.mockReturnValue(of(user));
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.passwordForm.setValue({
      current_password: 'Valid1',
      new_password: 'short', // Less than 10 characters
    });

    component.changePassword();

    expect(authService.changePassword).not.toHaveBeenCalled();
  });

  it('clears password success message when starting new password change', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.changePassword.mockReturnValue(of({ message: 'ok' }));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.passwordForm.setValue({
      current_password: 'OldPassword1',
      new_password: 'NewPassword1234',
    });

    component.changePassword();
    expect(component.pwSuccessMsg()).toBe('Password changed successfully.');

    // Start another password change
    authService.changePassword.mockReturnValueOnce(of({ message: 'ok' }));
    component.passwordForm.setValue({
      current_password: 'OldPassword1',
      new_password: 'DifferentPassword123',
    });

    component.changePassword();
    expect(component.pwSuccessMsg()).toBe('Password changed successfully.');
  });

  it('clears error message when starting new profile save', () => {
    authService.getMe.mockReturnValue(of(user));
    authService.updateProfile.mockReturnValueOnce(
      throwError(() => ({ error: { detail: 'Initial error' } }))
    );

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    component.saveProfile();
    expect(component.errorMsg()).toBe('Initial error');

    authService.updateProfile.mockReturnValueOnce(of(user));
    component.saveProfile();

    expect(component.errorMsg()).toBe('');
  });
});
