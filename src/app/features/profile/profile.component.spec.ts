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
    authService.verifyPhoneOtp.mockReturnValueOnce(throwError(() => ({ error: { detail: 'Bad OTP' } })));
    component.verifyPhoneOtp();
    expect(component.errorMsg()).toBe('Bad OTP');
  });

  it('blocks invalid or duplicate profile saves', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.profileForm.controls.full_name.setValue('');
    component.saveProfile();
    expect(authService.updateProfile).not.toHaveBeenCalled();

    component.profileForm.setValue({ full_name: 'Alex Doe', phone: '+91 90000 00001' });
    component.saving.set(true);
    component.saveProfile();
    expect(authService.updateProfile).not.toHaveBeenCalled();
  });

  it('changes the password successfully and handles errors', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.passwordForm.setValue({ current_password: 'oldpass123', new_password: 'newpass1234' });

    authService.changePassword.mockReturnValueOnce(of({}));
    component.changePassword();
    expect(component.pwSuccessMsg()).toBe('Password changed successfully.');
    expect(component.passwordForm.getRawValue()).toEqual({ current_password: '', new_password: '' });
    expect(component.changingPw()).toBe(false);

    component.passwordForm.setValue({ current_password: 'oldpass123', new_password: 'newpass1234' });
    authService.changePassword.mockReturnValueOnce(throwError(() => ({ error: { detail: 'Wrong password' } })));
    component.changePassword();
    expect(component.pwErrorMsg()).toBe('Wrong password');

    authService.changePassword.mockReturnValueOnce(throwError(() => ({ error: {} })));
    component.changePassword();
    expect(component.pwErrorMsg()).toBe('Password change failed.');
  });

  it('blocks invalid or duplicate password changes', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    component.changePassword();
    expect(authService.changePassword).not.toHaveBeenCalled();

    component.passwordForm.setValue({ current_password: 'oldpass123', new_password: 'newpass1234' });
    component.changingPw.set(true);
    component.changePassword();
    expect(authService.changePassword).not.toHaveBeenCalled();
  });
});
