import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { TokenResponse, UserResponse } from '../models/auth.model';
import { environment } from '../../../environments/environment';

const mockUser: UserResponse = {
  id: 1,
  email: 'test@example.com',
  full_name: 'Test User',
  phone: null,
  avatar_url: null,
  is_admin: false,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
};

const mockTokenResponse: TokenResponse = {
  access_token: 'access-token-abc',
  refresh_token: 'refresh-token-xyz',
  user: mockUser,
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let routerSpy: { navigate: jest.Mock; navigateByUrl: jest.Mock };

  beforeEach(() => {
    localStorage.clear();
    routerSpy = { navigate: jest.fn(), navigateByUrl: jest.fn() };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  // ─── initial state ────────────────────────────────────────────────────────

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with null user when storage is empty', () => {
    expect(service.currentUser).toBeNull();
    expect(service.isLoggedIn).toBe(false);
    expect(service.isAdmin).toBe(false);
  });

  it('should restore user from localStorage on init', () => {
    localStorage.setItem('se_user', JSON.stringify(mockUser));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService, { provide: Router, useValue: routerSpy }],
    });
    const fresh = TestBed.inject(AuthService);
    expect(fresh.currentUser).toEqual(mockUser);
    expect(fresh.isLoggedIn).toBe(true);
  });

  it('should return null when localStorage contains invalid JSON', () => {
    localStorage.setItem('se_user', 'not-json');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService, { provide: Router, useValue: routerSpy }],
    });
    const s = TestBed.inject(AuthService);
    expect(s.currentUser).toBeNull();
  });

  // ─── login ────────────────────────────────────────────────────────────────

  it('should persist session and emit user on login', () => {
    let emitted: UserResponse | null = null;
    service.currentUser$.subscribe(u => (emitted = u));

    service.login({ email: 'test@example.com', password: 'Pass1234!' }).subscribe(res => {
      expect(res).toEqual(mockTokenResponse);
    });

    const req = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush(mockTokenResponse);

    expect(localStorage.getItem('se_access_token')).toBe('access-token-abc');
    expect(localStorage.getItem('se_refresh_token')).toBe('refresh-token-xyz');
    expect(service.isLoggedIn).toBe(true);
    expect(emitted).toEqual(mockUser);
  });

  // ─── signup ───────────────────────────────────────────────────────────────

  it('should persist session on signup', () => {
    service
      .signup({ email: 'new@example.com', full_name: 'New User', password: 'Pass1234!' })
      .subscribe();

    const req = http.expectOne(`${environment.apiUrl}/auth/signup`);
    expect(req.request.method).toBe('POST');
    req.flush(mockTokenResponse);

    expect(service.isLoggedIn).toBe(true);
  });

  // ─── social login ─────────────────────────────────────────────────────────

  it('should persist session on social login', () => {
    service
      .socialLogin({ provider: 'google', id_token: 'google-id-token' })
      .subscribe();

    const req = http.expectOne(`${environment.apiUrl}/auth/social-login`);
    expect(req.request.method).toBe('POST');
    req.flush(mockTokenResponse);

    expect(service.isLoggedIn).toBe(true);
  });

  // ─── refresh token ────────────────────────────────────────────────────────

  it('should refresh token and persist new session', () => {
    localStorage.setItem('se_refresh_token', 'old-refresh');
    service.refreshToken().subscribe();

    const req = http.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(req.request.body).toEqual({ refresh_token: 'old-refresh' });
    req.flush(mockTokenResponse);

    expect(localStorage.getItem('se_access_token')).toBe('access-token-abc');
  });

  // ─── get me ───────────────────────────────────────────────────────────────

  it('should update currentUser from getMe', () => {
    service.getMe().subscribe(u => expect(u).toEqual(mockUser));

    const req = http.expectOne(`${environment.apiUrl}/auth/me`);
    req.flush(mockUser);

    expect(service.currentUser).toEqual(mockUser);
  });

  // ─── update profile ───────────────────────────────────────────────────────

  it('should update profile and emit updated user', () => {
    const updated = { ...mockUser, full_name: 'Updated Name' };
    service.updateProfile({ full_name: 'Updated Name' }).subscribe(u =>
      expect(u.full_name).toBe('Updated Name')
    );

    const req = http.expectOne(`${environment.apiUrl}/auth/me`);
    expect(req.request.method).toBe('PUT');
    req.flush(updated);
  });

  // ─── change password ──────────────────────────────────────────────────────

  it('should call change-password endpoint', () => {
    service
      .changePassword({ current_password: 'old', new_password: 'NewPass123' })
      .subscribe();

    const req = http.expectOne(`${environment.apiUrl}/auth/change-password`);
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'Password changed successfully' });
  });

  // ─── forgot password ──────────────────────────────────────────────────────

  it('should call forgot-password endpoint', () => {
    service.forgotPassword({ email: 'test@example.com' }).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/auth/forgot-password`);
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'If that email exists...' });
  });

  // ─── reset password ───────────────────────────────────────────────────────

  it('should call reset-password endpoint', () => {
    service
      .resetPassword({ token: 'reset-token', new_password: 'NewPass123' })
      .subscribe();

    const req = http.expectOne(`${environment.apiUrl}/auth/reset-password`);
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'Password has been reset successfully' });
  });

  // ─── logout ───────────────────────────────────────────────────────────────

  it('should clear storage, reset user, and navigate on logout', () => {
    localStorage.setItem('se_access_token', 'tok');
    localStorage.setItem('se_refresh_token', 'ref');
    localStorage.setItem('se_user', JSON.stringify(mockUser));

    service.logout();

    expect(localStorage.getItem('se_access_token')).toBeNull();
    expect(localStorage.getItem('se_refresh_token')).toBeNull();
    expect(localStorage.getItem('se_user')).toBeNull();
    expect(service.isLoggedIn).toBe(false);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  // ─── token accessors ──────────────────────────────────────────────────────

  it('getAccessToken should return null when not set', () => {
    expect(service.getAccessToken()).toBeNull();
  });

  it('getRefreshToken should return null when not set', () => {
    expect(service.getRefreshToken()).toBeNull();
  });

  it('getAccessToken should return token after login', () => {
    service.login({ email: 'a@b.com', password: 'pw' }).subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(mockTokenResponse);
    expect(service.getAccessToken()).toBe('access-token-abc');
  });

  // ─── isAdmin ──────────────────────────────────────────────────────────────

  it('isAdmin should be false for non-admin user', () => {
    service.login({ email: 'a@b.com', password: 'pw' }).subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(mockTokenResponse);
    expect(service.isAdmin).toBe(false);
  });

  // ─── phone OTP ─────────────────────────────────────────────────────────

  it('should call the phone OTP request endpoint', () => {
    service.requestPhoneOtp({ phone: '+1234567890' }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/auth/phone/request-otp`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ phone: '+1234567890' });
    req.flush({ message: 'sent', otp_id: 'otp-1' });
  });

  it('should update user and localStorage on verifyPhoneOtp', () => {
    const verifiedUser = { ...mockUser, phone: '+1234567890', phone_verified: true };
    service.verifyPhoneOtp({ otp_id: 'otp-1', otp_code: '123456' }).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/auth/phone/verify`);
    expect(req.request.method).toBe('POST');
    req.flush(verifiedUser);

    expect(service.currentUser).toEqual(verifiedUser);
    expect(JSON.parse(localStorage.getItem('se_user')!)).toEqual(verifiedUser);
  });

  // ─── Microsoft + social login with token ──────────────────────────────

  it('should throw on loginWithApple', async () => {
    await expect(service.loginWithApple()).rejects.toThrow('Apple Sign-In requires native integration');
  });

  it('should redirect to Microsoft OAuth on loginWithMicrosoft', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: '', origin: 'http://localhost' },
    });

    await service.loginWithMicrosoft();

    expect(window.location.href).toContain('login.microsoftonline.com');
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('should post and persist session on socialLoginWithToken', () => {
    service.socialLoginWithToken('google', 'test-id-token').subscribe();

    const req = http.expectOne(`${environment.apiUrl}/auth/social-login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ provider: 'google', id_token: 'test-id-token' });
    req.flush(mockTokenResponse);

    expect(localStorage.getItem('se_access_token')).toBe('access-token-abc');
    expect(service.isLoggedIn).toBe(true);
  });

  it('isAdmin should be true for admin user', () => {
    const adminToken: TokenResponse = {
      ...mockTokenResponse,
      user: { ...mockUser, is_admin: true },
    };
    service.login({ email: 'a@b.com', password: 'pw' }).subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(adminToken);
    expect(service.isAdmin).toBe(true);
  });
});
