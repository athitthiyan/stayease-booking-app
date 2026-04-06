import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/services/auth.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { UserResponse } from '../../core/models/auth.model';

describe('ProfileComponent', () => {
  const authService = {
    isLoggedIn: true,
    currentUser: {
      full_name: 'Alex Doe',
      email: 'alex@example.com',
      phone: '+91 90000 00001',
      phone_verified: true,
      created_at: '2024-01-01T00:00:00.000Z',
      avatar_url: null,
    },
    getMe: jest.fn(),
    updateProfile: jest.fn(),
    requestPhoneOtp: jest.fn(),
    verifyPhoneOtp: jest.fn(),
    changePassword: jest.fn(),
    logout: jest.fn(),
  };
  const wishlistService = {
    isSaved: jest.fn(() => false),
  };

  const user: UserResponse = {
    id: 1,
    full_name: 'Alex Doe',
    email: 'alex@example.com',
    phone: '+91 90000 00001',
    phone_verified: true,
    created_at: '2024-01-01T00:00:00.000Z',
    avatar_url: null,
    is_admin: false,
    is_active: true,
  };

  beforeEach(async () => {
    authService.getMe.mockReset();
    authService.updateProfile.mockReset();
    authService.requestPhoneOtp.mockReset();
    authService.verifyPhoneOtp.mockReset();
    authService.changePassword.mockReset();

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: WishlistService, useValue: wishlistService },
      ],
    }).compileComponents();
  });

  it('loads the user and derives display helpers', () => {
    authService.getMe.mockReturnValue(of(user));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.user()).toEqual(user);
    expect(component.profileForm.getRawValue()).toEqual({ full_name: 'Alex Doe', phone: '+91 90000 00001' });
    expect(component.initials()).toBe('AD');
    expect(component.memberSince()).toContain('2024');
  });

  it('patches an empty phone number when the profile has none', () => {
    authService.getMe.mockReturnValue(of({ ...user, phone: undefined }));

    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();

    expect(component.profileForm.getRawValue()).toEqual({ full_name: 'Alex Doe', phone: '' });
  });

  it('returns empty memberSince when user has no date', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.user.set(null);

    expect(component.memberSince()).toBe('');
  });

  it('returns empty initials when the user has no name', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.user.set({ ...user, full_name: undefined as unknown as string });

    expect(component.initials()).toBe('');
  });

  it('validates password fields', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.passwordForm.controls.current_password.markAsTouched();
    component.passwordForm.controls.new_password.markAsTouched();

    expect(component.isPasswordFieldInvalid('current_password')).toBe(true);
    expect(component.isPasswordFieldInvalid('new_password')).toBe(true);
  });

  it('saves the profile successfully and handles errors', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.user.set({ ...user, full_name: 'Updated Name', phone: '+91 99999 99999', phone_verified: true });
    component.profileForm.setValue({ full_name: 'Updated Name', phone: '+91 99999 99999' });

    authService.updateProfile.mockReturnValueOnce(of({ ...user, full_name: 'Updated Name', phone: '+91 99999 99999', phone_verified: true }));
    component.saveProfile();
    expect(component.user()?.full_name).toBe('Updated Name');
    expect(component.successMsg()).toBe('Profile updated successfully.');
    expect(component.saving()).toBe(false);

    authService.updateProfile.mockReturnValueOnce(throwError(() => ({ error: { detail: 'Update broken' } })));
    component.saveProfile();
    expect(component.errorMsg()).toBe('Update broken');

    authService.updateProfile.mockReturnValueOnce(throwError(() => ({ error: {} })));
    component.saveProfile();
    expect(component.errorMsg()).toBe('Update failed.');
  });

  it('requires phone OTP verification before saving changed numbers', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.user.set(user);
    component.profileForm.setValue({ full_name: 'Alex Doe', phone: '+91 99999 99999' });

    component.saveProfile();
    expect(component.errorMsg()).toContain('Verify your phone');
    expect(authService.updateProfile).not.toHaveBeenCalled();

    authService.requestPhoneOtp.mockReturnValueOnce(of({
      message: 'sent',
      phone: '+91 99999 99999',
      expires_in_seconds: 300,
      dev_code: '123456',
    }));
    component.requestPhoneOtp();
    expect(component.otpSent()).toBe(true);
    expect(component.phoneOtpDevCode()).toBe('123456');

    component.otpForm.setValue({ otp: '123456' });
    authService.verifyPhoneOtp.mockReturnValueOnce(of({ ...user, phone: '+91 99999 99999', phone_verified: true }));
    component.verifyPhoneOtp();
    expect(component.user()?.phone).toBe('+91 99999 99999');
    expect(component.isPhoneVerifiedForCurrentForm()).toBe(true);
  });

  it('handles phone OTP request and verification failures', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.profileForm.setValue({ full_name: 'Alex Doe', phone: '+91 99999 99999' });

    authService.requestPhoneOtp.mockReturnValueOnce(throwError(() => ({ error: { detail: 'SMS failed' } })));
    component.requestPhoneOtp();
    expect(component.errorMsg()).toBe('SMS failed');

    component.otpForm.setValue({ otp: '123456' });
    authService.verifyPhoneOtp.mockReturnValueOnce(throwError(() => ({ error: { detail: 'Invalid OTP' } })));
    component.verifyPhoneOtp();
    expect(component.errorMsg()).toBe('Invalid OTP');

    authService.verifyPhoneOtp.mockReturnValueOnce(throwError(() => ({ error: {} })));
    component.verifyPhoneOtp();
    expect(component.errorMsg()).toBe('Phone verification failed.');
  });

  it('isPhoneVerifiedForCurrentForm returns false when phone is empty', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.profileForm.controls.phone.setValue('');
    expect(component.isPhoneVerifiedForCurrentForm()).toBe(false);
  });

  it('does not request OTP when phone is invalid or already requesting', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.profileForm.controls.phone.setValue('');

    component.requestPhoneOtp();
    expect(authService.requestPhoneOtp).not.toHaveBeenCalled();

    component.profileForm.controls.phone.setValue('+91 99999 99999');
    component.requestingOtp.set(true);
    component.requestPhoneOtp();
    expect(authService.requestPhoneOtp).not.toHaveBeenCalled();
  });

  it('does not verify OTP when form is invalid or already verifying', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;

    component.verifyPhoneOtp();
    expect(authService.verifyPhoneOtp).not.toHaveBeenCalled();

    component.otpForm.setValue({ otp: '123456' });
    component.verifyingPhone.set(true);
    component.verifyPhoneOtp();
    expect(authService.verifyPhoneOtp).not.toHaveBeenCalled();
  });

  it('does not save profile when form is invalid or already saving', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.profileForm.controls.full_name.setValue('');

    component.saveProfile();
    expect(authService.updateProfile).not.toHaveBeenCalled();

    component.profileForm.controls.full_name.setValue('Alex');
    component.user.set({ ...user, phone: '+91 99999 99999', phone_verified: true });
    component.profileForm.controls.phone.setValue('+91 99999 99999');
    component.saving.set(true);
    component.saveProfile();
    expect(authService.updateProfile).not.toHaveBeenCalled();
  });

  it('does not change password when form is invalid', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.passwordForm.controls.new_password.setValue('short');

    component.changePassword();
    expect(authService.changePassword).not.toHaveBeenCalled();
  });

  it('requestPhoneOtp shows fallback error when detail is missing', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.profileForm.setValue({ full_name: 'Alex Doe', phone: '+91 99999 99999' });

    authService.requestPhoneOtp.mockReturnValueOnce(throwError(() => ({ error: {} })));
    component.requestPhoneOtp();
    expect(component.errorMsg()).toBe('Could not send OTP.');
  });

  it('verifyPhoneOtp handles user with null phone', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.profileForm.setValue({ full_name: 'Alex Doe', phone: '+91 99999 99999' });

    component.otpForm.setValue({ otp: '123456' });
    authService.verifyPhoneOtp.mockReturnValueOnce(of({ ...user, phone: null }));
    component.verifyPhoneOtp();
    expect(component.profileForm.controls.phone.value).toBe('');
  });

  it('isPhoneVerifiedForCurrentForm checks all conditions', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;

    // Matching phone, verified
    component.user.set({ ...user, phone: '+91 90000 00001', phone_verified: true });
    component.profileForm.controls.phone.setValue('+91 90000 00001');
    expect(component.isPhoneVerifiedForCurrentForm()).toBe(true);

    // Phone doesn't match
    component.profileForm.controls.phone.setValue('+91 99999 99999');
    expect(component.isPhoneVerifiedForCurrentForm()).toBe(false);

    // Phone matches but not verified
    component.user.set({ ...user, phone: '+91 99999 99999', phone_verified: false });
    expect(component.isPhoneVerifiedForCurrentForm()).toBe(false);

    // Phone matches but phone_verified is undefined (uses ?? false)
    component.user.set({ ...user, phone: '+91 99999 99999', phone_verified: undefined });
    expect(component.isPhoneVerifiedForCurrentForm()).toBe(false);
  });

  it('requestPhoneOtp handles response without dev_code', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.profileForm.setValue({ full_name: 'Alex Doe', phone: '+91 99999 99999' });

    authService.requestPhoneOtp.mockReturnValueOnce(of({ message: 'sent', otp_id: 'otp-1' }));
    component.requestPhoneOtp();
    expect(component.phoneOtpDevCode()).toBe('');
    expect(component.otpSent()).toBe(true);
  });

  it('checks profile field validity for touched invalid fields', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;

    expect(component.isProfileFieldInvalid('full_name')).toBe(false);
    component.profileForm.controls.full_name.setValue('');
    component.profileForm.controls.full_name.markAsTouched();
    expect(component.isProfileFieldInvalid('full_name')).toBe(true);
  });

  it('changes password successfully and handles errors', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;

    component.passwordForm.setValue({ current_password: 'OldPassword1', new_password: 'NewPassword1' });

    authService.changePassword.mockReturnValueOnce(of({ message: 'ok' }));
    component.changePassword();
    expect(component.pwSuccessMsg()).toBe('Password changed successfully.');
    expect(component.changingPw()).toBe(false);

    component.passwordForm.setValue({ current_password: 'OldPassword1', new_password: 'NewPassword1' });
    authService.changePassword.mockReturnValueOnce(throwError(() => ({ error: { detail: 'Wrong password' } })));
    component.changePassword();
    expect(component.pwErrorMsg()).toBe('Wrong password');

    component.passwordForm.setValue({ current_password: 'OldPassword1', new_password: 'NewPassword1' });
    authService.changePassword.mockReturnValueOnce(throwError(() => ({ error: {} })));
    component.changePassword();
    expect(component.pwErrorMsg()).toBe('Password change failed.');
  });
});