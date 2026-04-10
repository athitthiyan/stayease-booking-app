import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MsalService } from '../auth/msal-angular-shim';
import { BrowserAuthError } from '../auth/msal-browser-shim';
import { AuthService } from './auth.service';
import { TokenResponse, UserResponse } from '../models/auth.model';
import * as env from '../../../environments/environment';

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

const mockMsalService = {
  loginPopup: jest.fn(),
  loginRedirect: jest.fn(),
  handleRedirectObservable: jest.fn().mockReturnValue(of(null)),
  instance: { initialize: jest.fn().mockResolvedValue(undefined), clearCache: jest.fn(), handleRedirectPromise: jest.fn().mockResolvedValue(null) },
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let routerSpy: { navigate: jest.Mock; navigateByUrl: jest.Mock };

  beforeEach(() => {
    localStorage.clear();
    routerSpy = { navigate: jest.fn(), navigateByUrl: jest.fn() };
    mockMsalService.loginPopup.mockReset();
    mockMsalService.loginRedirect.mockReset();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy },
        { provide: MsalService, useValue: mockMsalService },
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
      providers: [AuthService, { provide: Router, useValue: routerSpy }, { provide: MsalService, useValue: mockMsalService }],
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
      providers: [AuthService, { provide: Router, useValue: routerSpy }, { provide: MsalService, useValue: mockMsalService }],
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

    const req = http.expectOne(`${env.environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush(mockTokenResponse);

    expect(service.getAccessToken()).toBe('access-token-abc');
    expect(localStorage.getItem('se_user')).toEqual(JSON.stringify(mockUser));
    expect(localStorage.getItem('se_rt')).toBe('refresh-token-xyz');
    expect(service.isLoggedIn).toBe(true);
    expect(emitted).toEqual(mockUser);
  });

  // ─── signup ───────────────────────────────────────────────────────────────

  it('should persist session on signup', () => {
    service
      .signup({ email: 'new@example.com', full_name: 'New User', password: 'Pass1234!' })
      .subscribe();

    const req = http.expectOne(`${env.environment.apiUrl}/auth/signup`);
    expect(req.request.method).toBe('POST');
    req.flush(mockTokenResponse);

    expect(service.isLoggedIn).toBe(true);
  });

  // ─── social login ─────────────────────────────────────────────────────────

  it('should persist session on social login', () => {
    service
      .socialLogin({ provider: 'google', id_token: 'google-id-token' })
      .subscribe();

    const req = http.expectOne(`${env.environment.apiUrl}/auth/social-login`);
    expect(req.request.method).toBe('POST');
    req.flush(mockTokenResponse);

    expect(service.isLoggedIn).toBe(true);
  });

  // ─── refresh token ────────────────────────────────────────────────────────

  it('should refresh token and persist new session', () => {
    localStorage.setItem('se_rt', 'refresh-token-xyz');
    service.refreshToken().subscribe();

    const req = http.expectOne(`${env.environment.apiUrl}/auth/refresh`);
    expect(req.request.body).toEqual({ refresh_token: 'refresh-token-xyz' });
    expect(req.request.withCredentials).toBe(true);
    req.flush(mockTokenResponse);

    expect(service.getAccessToken()).toBe('access-token-abc');
  });

  it('should deduplicate in-flight refresh token requests', () => {
    localStorage.setItem('se_rt', 'refresh-token-xyz');
    const results: TokenResponse[] = [];

    service.refreshToken().subscribe(value => results.push(value));
    service.refreshToken().subscribe(value => results.push(value));

    const reqs = http.match(`${env.environment.apiUrl}/auth/refresh`);
    expect(reqs).toHaveLength(1);
    reqs[0].flush(mockTokenResponse);

    expect(results).toEqual([mockTokenResponse, mockTokenResponse]);
  });

  it('should not call refresh endpoint when no refresh token is stored', () => {
    let error: unknown;

    service.refreshToken().subscribe({
      error: err => {
        error = err;
      },
    });

    expect((error as Error).message).toBe('No refresh token available.');
    http.expectNone(`${env.environment.apiUrl}/auth/refresh`);
  });

  // ─── get me ───────────────────────────────────────────────────────────────

  it('should update currentUser from getMe', () => {
    service.getMe().subscribe(u => expect(u).toEqual(mockUser));

    const req = http.expectOne(`${env.environment.apiUrl}/auth/me`);
    req.flush(mockUser);

    expect(service.currentUser).toEqual(mockUser);
  });

  // ─── update profile ───────────────────────────────────────────────────────

  it('should update profile and emit updated user', () => {
    const updated = { ...mockUser, full_name: 'Updated Name' };
    service.updateProfile({ full_name: 'Updated Name' }).subscribe(u =>
      expect(u.full_name).toBe('Updated Name')
    );

    const req = http.expectOne(`${env.environment.apiUrl}/auth/me`);
    expect(req.request.method).toBe('PUT');
    req.flush(updated);
  });

  // ─── change password ──────────────────────────────────────────────────────

  it('should call change-password endpoint', () => {
    service
      .changePassword({ current_password: 'old', new_password: 'NewPass123' })
      .subscribe();

    const req = http.expectOne(`${env.environment.apiUrl}/auth/change-password`);
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'Password changed successfully' });
  });

  // ─── forgot password ──────────────────────────────────────────────────────

  it('should call forgot-password endpoint', () => {
    service.forgotPassword({ email: 'test@example.com' }).subscribe();

    const req = http.expectOne(`${env.environment.apiUrl}/auth/forgot-password`);
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'If that email exists...' });
  });

  // ─── reset password ───────────────────────────────────────────────────────

  it('should call reset-password endpoint', () => {
    service
      .resetPassword({ token: 'reset-token', new_password: 'NewPass123' })
      .subscribe();

    const req = http.expectOne(`${env.environment.apiUrl}/auth/reset-password`);
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'Password has been reset successfully' });
  });

  // ─── logout ───────────────────────────────────────────────────────────────

  it('should clear storage, reset user, call logout endpoint, and navigate on logout', () => {
    localStorage.setItem('se_user', JSON.stringify(mockUser));
    service.hydrateSession('tok', mockUser);

    service.logout();

    // Flush the fire-and-forget logout POST
    const req = http.expectOne(`${env.environment.apiUrl}/auth/logout`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    expect(req.request.withCredentials).toBe(true);
    req.flush({ message: 'Logged out successfully' });

    expect(localStorage.getItem('se_user')).toBeNull();
    expect(localStorage.getItem('se_rt')).toBeNull();
    expect(service.isLoggedIn).toBe(false);
    expect(service.getAccessToken()).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('should call google revoke on logout when GIS is loaded', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const revokeMock = jest.fn();
    win.google = {
      accounts: { oauth2: { revoke: revokeMock } },
    };
    service.hydrateSession('goog-tok', mockUser);

    service.logout();
    http.expectOne(`${env.environment.apiUrl}/auth/logout`).flush({ message: 'Logged out successfully' });

    expect(revokeMock).toHaveBeenCalledWith('goog-tok', expect.any(Function));
    delete win.google;
  });

  it('should not call google revoke when GIS is not loaded', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).google;
    service.hydrateSession('tok', mockUser);

    // Should not throw
    service.logout();
    http.expectOne(`${env.environment.apiUrl}/auth/logout`).flush({ message: 'Logged out successfully' });
    expect(service.isLoggedIn).toBe(false);
  });

  // ─── token accessors ──────────────────────────────────────────────────────

  it('getAccessToken should return null when not set', () => {
    expect(service.getAccessToken()).toBeNull();
  });

  it('getAccessToken should return token after login', () => {
    service.login({ email: 'a@b.com', password: 'pw' }).subscribe();
    http.expectOne(`${env.environment.apiUrl}/auth/login`).flush(mockTokenResponse);
    expect(service.getAccessToken()).toBe('access-token-abc');
  });

  // ─── isAdmin ──────────────────────────────────────────────────────────────

  it('isAdmin should be false for non-admin user', () => {
    service.login({ email: 'a@b.com', password: 'pw' }).subscribe();
    http.expectOne(`${env.environment.apiUrl}/auth/login`).flush(mockTokenResponse);
    expect(service.isAdmin).toBe(false);
  });

  // ─── phone OTP ─────────────────────────────────────────────────────────

  it('should call the phone OTP request endpoint', () => {
    service.requestPhoneOtp({ phone: '+1234567890' }).subscribe();
    const req = http.expectOne(`${env.environment.apiUrl}/auth/phone/request-otp`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ phone: '+1234567890' });
    req.flush({ message: 'sent', otp_id: 'otp-1' });
  });

  it('should update user and localStorage on verifyPhoneOtp', () => {
    const verifiedUser = { ...mockUser, phone: '+1234567890', phone_verified: true };
    service.verifyPhoneOtp({ phone: '+1234567890', otp: '123456' }).subscribe();

    const req = http.expectOne(`${env.environment.apiUrl}/auth/phone/verify`);
    expect(req.request.method).toBe('POST');
    req.flush(verifiedUser);

    expect(service.currentUser).toEqual(verifiedUser);
    expect(JSON.parse(localStorage.getItem('se_user')!)).toEqual(verifiedUser);
  });

  // ─── Microsoft + social login with token ──────────────────────────────

  it('should reject when Google client ID is not configured', async () => {
    const original = env.environment.googleClientId;
    (env.environment as { googleClientId: string }).googleClientId = '';
    try {
      await expect(service.loginWithGoogle()).rejects.toThrow('Google Client ID is not configured');
    } finally {
      (env.environment as { googleClientId: string }).googleClientId = original;
    }
  });

  it('should reject duplicate Google login while one is in progress', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    // Set up a Google mock that never resolves (simulates open popup)
    win.google = {
      accounts: {
        oauth2: {
          initTokenClient: () => ({
            requestAccessToken: () => { /* popup stays open */ },
          }),
        },
      },
    };

    // First call starts the flow
    service.loginWithGoogle();

    // Second call should reject immediately
    await expect(service.loginWithGoogle()).rejects.toThrow('A Google sign-in is already in progress.');
    delete win.google;
  });

  it('should show denied message when Google returns access_denied', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    win.google = {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: { callback: (r: Record<string, string>) => void }) => ({
            requestAccessToken: () => cfg.callback({ error: 'access_denied' }),
          }),
        },
      },
    };

    await expect(service.loginWithGoogle()).rejects.toThrow('Google Sign-In was denied. Please grant the required permissions.');
    delete win.google;
  });

  it('should call MSAL loginRedirect for Microsoft sign-in', async () => {
    mockMsalService.loginRedirect.mockReturnValue(of(undefined));

    await service.loginWithMicrosoft();
    expect(mockMsalService.loginRedirect).toHaveBeenCalled();
  });

  it('should throw in-progress message when interaction is in progress', async () => {
    const inProgressError = new BrowserAuthError('interaction_in_progress');
    mockMsalService.loginRedirect.mockReturnValue(throwError(() => inProgressError));

    await expect(service.loginWithMicrosoft()).rejects.toThrow('A sign-in is already in progress. Please wait.');
  });

  it('should throw generic message for other MSAL errors', async () => {
    const otherError = new BrowserAuthError('some_other_error');
    mockMsalService.loginRedirect.mockReturnValue(throwError(() => otherError));

    await expect(service.loginWithMicrosoft()).rejects.toThrow('Microsoft Sign-In failed. Please try again.');
  });

  it('should post and persist session on socialLoginWithToken', () => {
    service.socialLoginWithToken('google', 'test-id-token').subscribe();

    const req = http.expectOne(`${env.environment.apiUrl}/auth/social-login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ provider: 'google', id_token: 'test-id-token' });
    req.flush(mockTokenResponse);

    expect(service.getAccessToken()).toBe('access-token-abc');
    expect(localStorage.getItem('se_user')).toEqual(JSON.stringify(mockUser));
    expect(service.isLoggedIn).toBe(true);
  });

  it('should deduplicate in-flight social login requests for the same provider and token', () => {
    const responses: TokenResponse[] = [];

    service.socialLoginWithToken('google', 'same-token').subscribe(value => responses.push(value));
    service.socialLoginWithToken('google', 'same-token').subscribe(value => responses.push(value));

    const reqs = http.match(`${env.environment.apiUrl}/auth/social-login`);
    expect(reqs).toHaveLength(1);
    reqs[0].flush(mockTokenResponse);

    expect(responses).toEqual([mockTokenResponse, mockTokenResponse]);
  });

  it('should allow retrying social login after an in-flight request fails', () => {
    const errors: unknown[] = [];

    service.socialLoginWithToken('google', 'retry-token').subscribe({ error: err => errors.push(err) });
    const failedReq = http.expectOne(`${env.environment.apiUrl}/auth/social-login`);
    failedReq.flush({ detail: 'nope' }, { status: 500, statusText: 'Server Error' });

    service.socialLoginWithToken('google', 'retry-token').subscribe();
    const retryReq = http.expectOne(`${env.environment.apiUrl}/auth/social-login`);
    retryReq.flush(mockTokenResponse);

    expect(errors).toHaveLength(1);
    expect(service.isLoggedIn).toBe(true);
  });

  it('should reject when Google callback returns generic error', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    win.google = {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: { callback: (r: Record<string, string>) => void }) => ({
            requestAccessToken: () => cfg.callback({ error: 'popup_closed' }),
          }),
        },
      },
    };

    await expect(service.loginWithGoogle()).rejects.toThrow('Google Sign-In was cancelled.');
    delete win.google;
  });

  it('should navigate home when Google callback succeeds', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    win.google = {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: { callback: (r: Record<string, string>) => void }) => ({
            requestAccessToken: () => cfg.callback({ access_token: 'goog-tok' }),
          }),
        },
      },
    };

    const promise = service.loginWithGoogle();

    // Flush the socialLoginWithToken HTTP call
    const req = http.expectOne(`${env.environment.apiUrl}/auth/social-login`);
    expect(req.request.body).toEqual({ provider: 'google', id_token: 'goog-tok' });
    req.flush(mockTokenResponse);

    await promise;
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/']);
    delete win.google;
  });

  it('should reject when socialLoginWithToken errors on Google callback', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    win.google = {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: { callback: (r: Record<string, string>) => void }) => ({
            requestAccessToken: () => cfg.callback({ access_token: 'goog-tok' }),
          }),
        },
      },
    };

    const promise = service.loginWithGoogle();
    const req = http.expectOne(`${env.environment.apiUrl}/auth/social-login`);
    req.flush({ detail: 'fail' }, { status: 500, statusText: 'Internal Server Error' });

    await expect(promise).rejects.toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).google;
  });

  it('should load script when google is not on window and call initAndPrompt on load', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).google;
    const appendSpy = jest.spyOn(document.body, 'appendChild').mockImplementation((el) => {
      // Simulate script loaded, but google still not available → reject
      if (el instanceof HTMLScriptElement && el.onload) {
        (el.onload as () => void)();
      }
      return el;
    });

    await expect(service.loginWithGoogle()).rejects.toThrow('Google Identity Services failed to load.');
    appendSpy.mockRestore();
  });

  it('should reject when script fails to load', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).google;
    const appendSpy = jest.spyOn(document.body, 'appendChild').mockImplementation((el) => {
      if (el instanceof HTMLScriptElement && el.onerror) {
        (el.onerror as () => void)();
      }
      return el;
    });

    await expect(service.loginWithGoogle()).rejects.toThrow('Failed to load Google Identity Services.');
    appendSpy.mockRestore();
  });

  it('isAdmin should be true for admin user', () => {
    const adminToken: TokenResponse = {
      ...mockTokenResponse,
      user: { ...mockUser, is_admin: true },
    };
    service.login({ email: 'a@b.com', password: 'pw' }).subscribe();
    http.expectOne(`${env.environment.apiUrl}/auth/login`).flush(adminToken);
    expect(service.isAdmin).toBe(true);
  });
});
