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
      .signup({
        email: 'new@example.com',
        full_name: 'New User',
        phone: '+1234567890',
        password: 'Pass1234!',
        email_challenge_id: 'email-challenge-1',
        phone_challenge_id: 'phone-challenge-1',
      })
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
    service
      .forgotPassword({ channel: 'email', recipient: 'test@example.com' })
      .subscribe();

    const req = http.expectOne(`${env.environment.apiUrl}/auth/forgot-password`);
    expect(req.request.method).toBe('POST');
    req.flush({
      message: 'OTP sent',
      challenge_id: 'forgot-email-1',
      flow: 'password_reset',
      channel: 'email',
      recipient: 'test@example.com',
      expires_in_seconds: 300,
      resend_available_in_seconds: 30,
      resends_remaining: 3,
      attempts_remaining: 5,
      max_resends: 3,
      max_attempts: 5,
    });
  });

  // ─── reset password ───────────────────────────────────────────────────────

  it('should call reset-password endpoint', () => {
    service
      .resetPassword({ reset_token: 'reset-token', new_password: 'NewPass123' })
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

  it('should call the OTP challenge request endpoint', () => {
    service
      .requestOtpChallenge({
        flow: 'profile',
        channel: 'phone',
        recipient: '+1234567890',
      })
      .subscribe();
    const req = http.expectOne(`${env.environment.apiUrl}/auth/otp/request`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      flow: 'profile',
      channel: 'phone',
      recipient: '+1234567890',
    });
    req.flush({
      message: 'OTP sent',
      challenge_id: 'otp-1',
      flow: 'profile',
      channel: 'phone',
      recipient: '+1234567890',
      expires_in_seconds: 300,
      resend_available_in_seconds: 30,
      resends_remaining: 3,
      attempts_remaining: 5,
      max_resends: 3,
      max_attempts: 5,
    });
  });

  it('should return verification response from verifyOtpChallenge', () => {
    let response: unknown;
    service
      .verifyOtpChallenge({ challenge_id: 'otp-1', otp: '123456' })
      .subscribe(result => {
        response = result;
      });

    const req = http.expectOne(`${env.environment.apiUrl}/auth/otp/verify`);
    expect(req.request.method).toBe('POST');
    req.flush({
      message: 'OTP verified',
      challenge_id: 'otp-1',
      flow: 'profile',
      channel: 'phone',
      recipient: '+1234567890',
      reset_token: 'reset-session-token',
    });

    expect(response).toEqual({
      message: 'OTP verified',
      challenge_id: 'otp-1',
      flow: 'profile',
      channel: 'phone',
      recipient: '+1234567890',
      reset_token: 'reset-session-token',
    });
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

  it('should re-throw non-BrowserAuthError exceptions from Microsoft login', async () => {
    const customError = new Error('Custom error message');
    mockMsalService.loginRedirect.mockReturnValue(throwError(() => customError));

    await expect(service.loginWithMicrosoft()).rejects.toThrow('Custom error message');
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

  it('should navigate to redirect URL from sessionStorage after Google login success', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    sessionStorage.setItem('sv_redirect_after_login', '/rooms/42');
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
    expect(req.request.body).toEqual({ provider: 'google', id_token: 'goog-tok' });
    req.flush(mockTokenResponse);

    await promise;
    expect(sessionStorage.getItem('sv_redirect_after_login')).toBeNull();
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/rooms/42');
    delete win.google;
  });

  it('should show denied message when Google returns access_denied error', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    win.google = {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: { callback: (r: Record<string, unknown>) => void }) => ({
            requestAccessToken: () => cfg.callback({ error: 'access_denied' }),
          }),
        },
      },
    };

    try {
      await service.loginWithGoogle();
      fail('should have thrown');
    } catch (err) {
      expect((err as Error).message).toBe('Google Sign-In was denied. Please grant the required permissions.');
    }
    delete win.google;
  });

  it('should show cancelled message when Google returns error other than access_denied', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    win.google = {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: { callback: (r: Record<string, unknown>) => void }) => ({
            requestAccessToken: () => cfg.callback({ error: 'popup_closed_by_user' }),
          }),
        },
      },
    };

    try {
      await service.loginWithGoogle();
      fail('should have thrown');
    } catch (err) {
      expect((err as Error).message).toBe('Google Sign-In was cancelled.');
    }
    delete win.google;
  });

  it('should handle Microsoft login with BrowserAuthError for interaction_in_progress', async () => {
    const inProgressError = new BrowserAuthError('interaction_in_progress');
    mockMsalService.loginRedirect.mockReturnValue(throwError(() => inProgressError));

    try {
      await service.loginWithMicrosoft();
      fail('should have thrown');
    } catch (err) {
      expect((err as Error).message).toBe('A sign-in is already in progress. Please wait.');
    }
  });

  it('should handle Microsoft login with BrowserAuthError for other error codes', async () => {
    const otherAuthError = new BrowserAuthError('browser_not_supported');
    mockMsalService.loginRedirect.mockReturnValue(throwError(() => otherAuthError));

    try {
      await service.loginWithMicrosoft();
      fail('should have thrown');
    } catch (err) {
      expect((err as Error).message).toBe('Microsoft Sign-In failed. Please try again.');
    }
  });

  it('should re-throw non-BrowserAuthError exceptions from loginWithMicrosoft', async () => {
    const customError = new Error('Network timeout');
    mockMsalService.loginRedirect.mockReturnValue(throwError(() => customError));

    try {
      await service.loginWithMicrosoft();
      fail('should have thrown');
    } catch (err) {
      expect((err as Error).message).toBe('Network timeout');
    }
  });

  it('should deduplicate concurrent socialLoginWithToken requests with same provider and token', () => {
    const results: TokenResponse[] = [];

    service.socialLoginWithToken('apple', 'same-apple-token').subscribe(value => results.push(value));
    service.socialLoginWithToken('apple', 'same-apple-token').subscribe(value => results.push(value));
    service.socialLoginWithToken('apple', 'same-apple-token').subscribe(value => results.push(value));

    const reqs = http.match(`${env.environment.apiUrl}/auth/social-login`);
    expect(reqs).toHaveLength(1);
    reqs[0].flush(mockTokenResponse);

    expect(results).toEqual([mockTokenResponse, mockTokenResponse, mockTokenResponse]);
  });

  it('should allow different tokens for same provider to create separate requests', () => {
    const results: TokenResponse[] = [];

    service.socialLoginWithToken('google', 'token-1').subscribe(value => results.push(value));
    service.socialLoginWithToken('google', 'token-2').subscribe(value => results.push(value));

    const reqs = http.match(`${env.environment.apiUrl}/auth/social-login`);
    expect(reqs).toHaveLength(2);
    reqs[0].flush(mockTokenResponse);
    reqs[1].flush(mockTokenResponse);

    expect(results).toEqual([mockTokenResponse, mockTokenResponse]);
  });

  it('should clear in-flight marker when socialLoginWithToken completes', () => {
    service.socialLoginWithToken('microsoft', 'ms-token').subscribe();

    const req = http.expectOne(`${env.environment.apiUrl}/auth/social-login`);
    req.flush(mockTokenResponse);

    // After completion, a new request with same token should create new HTTP request
    service.socialLoginWithToken('microsoft', 'ms-token').subscribe();
    http.expectOne(`${env.environment.apiUrl}/auth/social-login`);
  });

  // ─── initSession coverage ────────────────────────────────────────────────

  it('should return false when no cached user exists', (done) => {
    service.initSession().subscribe(result => {
      expect(result).toBe(false);
      done();
    });
  });

  it('should return true when cached user exists but no refresh token', (done) => {
    localStorage.setItem('se_user', JSON.stringify(mockUser));
    localStorage.setItem('se_at', 'access-token-abc');

    // Create new service instance to load from storage
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy },
        { provide: MsalService, useValue: mockMsalService },
      ],
    });
    const freshService = TestBed.inject(AuthService);

    freshService.initSession().subscribe(result => {
      expect(result).toBe(true);
      expect(freshService.isLoggedIn).toBe(true);
      done();
    });
  });

  it('should refresh token and return true on initSession when cached user and refresh token exist', (done) => {
    localStorage.setItem('se_user', JSON.stringify(mockUser));
    localStorage.setItem('se_rt', 'refresh-token-xyz');

    // Create new service instance to load from storage
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy },
        { provide: MsalService, useValue: mockMsalService },
      ],
    });
    const freshService = TestBed.inject(AuthService);
    const freshHttp = TestBed.inject(HttpTestingController);

    freshService.initSession().subscribe(result => {
      expect(result).toBe(true);
      freshHttp.verify();
      done();
    });

    const req = freshHttp.expectOne(`${env.environment.apiUrl}/auth/refresh`);
    req.flush(mockTokenResponse);
  });

  it('should return true on initSession when refresh fails', (done) => {
    localStorage.setItem('se_user', JSON.stringify(mockUser));
    localStorage.setItem('se_rt', 'refresh-token-xyz');

    // Create new service instance to load from storage
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy },
        { provide: MsalService, useValue: mockMsalService },
      ],
    });
    const freshService = TestBed.inject(AuthService);
    const freshHttp = TestBed.inject(HttpTestingController);

    freshService.initSession().subscribe(result => {
      expect(result).toBe(true);
      // User should still be cached even after refresh failure
      expect(freshService.currentUser).toEqual(mockUser);
      done();
    });

    const req = freshHttp.expectOne(`${env.environment.apiUrl}/auth/refresh`);
    req.flush({ message: 'error' }, { status: 401, statusText: 'Unauthorized' });
  });

  // ─── getAccessToken coverage ────────────────────────────────────────────

  it('should hydrate session from consumePendingSession if memory is empty', () => {
    // Create a fresh service with empty localStorage and memory
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: routerSpy },
        { provide: MsalService, useValue: mockMsalService },
      ],
    });

    // Mock the consumePendingSession export
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const msal = require('../auth/msal.config');
    const originalConsume = msal.consumePendingSession;

    try {
      msal.consumePendingSession = jest.fn().mockReturnValue({
        accessToken: 'pending-token',
        user: mockUser,
      });

      const freshService = TestBed.inject(AuthService);
      const token = freshService.getAccessToken();

      expect(token).toBe('pending-token');
      expect(freshService.currentUser).toEqual(mockUser);
    } finally {
      msal.consumePendingSession = originalConsume;
    }
  });

  // ─── logout coverage ────────────────────────────────────────────────────

  it('should not call google revoke when token is null on logout', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const revokeMock = jest.fn();
    win.google = {
      accounts: { oauth2: { revoke: revokeMock } },
    };

    service.logout();
    http.expectOne(`${env.environment.apiUrl}/auth/logout`).flush({ message: 'Logged out successfully' });

    expect(revokeMock).not.toHaveBeenCalled();
    expect(service.isLoggedIn).toBe(false);
    delete win.google;
  });

  // ─── persistSession coverage ────────────────────────────────────────────

  it('should persist session when only access_token is present', () => {
    const partialResp = {
      access_token: 'only-access-token',
      refresh_token: undefined,
      user: undefined,
    } as unknown as TokenResponse;

    service.login({ email: 'a@b.com', password: 'pw' }).subscribe();
    const req = http.expectOne(`${env.environment.apiUrl}/auth/login`);
    req.flush(partialResp);

    expect(service.getAccessToken()).toBe('only-access-token');
    expect(localStorage.getItem('se_rt')).toBeNull();
  });

  it('should persist session when only refresh_token is present', () => {
    const partialResp = {
      access_token: undefined,
      refresh_token: 'only-refresh-token',
      user: undefined,
    } as unknown as TokenResponse;

    service.login({ email: 'a@b.com', password: 'pw' }).subscribe();
    const req = http.expectOne(`${env.environment.apiUrl}/auth/login`);
    req.flush(partialResp);

    expect(localStorage.getItem('se_rt')).toBe('only-refresh-token');
  });

  it('should persist session when only user is present', () => {
    const partialResp = {
      access_token: undefined,
      refresh_token: undefined,
      user: mockUser,
    } as unknown as TokenResponse;

    service.login({ email: 'a@b.com', password: 'pw' }).subscribe();
    const req = http.expectOne(`${env.environment.apiUrl}/auth/login`);
    req.flush(partialResp);

    expect(service.currentUser).toEqual(mockUser);
    expect(localStorage.getItem('se_user')).toEqual(JSON.stringify(mockUser));
  });

  // ─── hydrateSession coverage ────────────────────────────────────────────

  it('should hydrate session with token only when user is null', () => {
    service.hydrateSession('token-only', null);

    expect(service.getAccessToken()).toBe('token-only');
    expect(localStorage.getItem('se_at')).toBe('token-only');
    expect(service.currentUser).toBeNull();
    expect(localStorage.getItem('se_user')).toBeNull();
  });

  it('should hydrate session with token only when user is undefined', () => {
    service.hydrateSession('token-only-2', undefined);

    expect(service.getAccessToken()).toBe('token-only-2');
    expect(localStorage.getItem('se_at')).toBe('token-only-2');
    expect(service.currentUser).toBeNull();
    expect(localStorage.getItem('se_user')).toBeNull();
  });

  // ─── loginWithGoogle coverage ────────────────────────────────────────────

  it('should reject when Google script fails to load', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    delete win.google;

    // Mock document.body.appendChild to trigger script onerror
    const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation((element: Node) => {
      const script = element as HTMLScriptElement;
      if (script.src && script.src.includes('accounts.google.com')) {
        // Simulate script load error
        setTimeout(() => {
          if (script.onerror) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            script.onerror(new Event('error') as any);
          }
        }, 0);
      }
      return element;
    });

    try {
      await expect(service.loginWithGoogle()).rejects.toThrow('Failed to load Google Identity Services.');
    } finally {
      appendChildSpy.mockRestore();
    }
  });

  it('should use Google if already loaded when loginWithGoogle is called', async () => {
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

    // appendChildSpy should NOT be called since google is already available
    const appendChildSpy = jest.spyOn(document.body, 'appendChild');

    const promise = service.loginWithGoogle();

    const req = http.expectOne(`${env.environment.apiUrl}/auth/social-login`);
    req.flush(mockTokenResponse);

    await promise;
    expect(appendChildSpy).not.toHaveBeenCalled();
    appendChildSpy.mockRestore();
    delete win.google;
  });

  it('should reject when GIS fails to load (google undefined after script load)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    delete win.google;

    // Mock document.body.appendChild to trigger script onload but leave google undefined
    const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation((element: Node) => {
      const script = element as HTMLScriptElement;
      if (script.src && script.src.includes('accounts.google.com')) {
        // Simulate script load success but google is not available
        setTimeout(() => {
          if (script.onload) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            script.onload(new Event('load') as any);
          }
        }, 0);
      }
      return element;
    });

    try {
      await expect(service.loginWithGoogle()).rejects.toThrow('Google Identity Services failed to load.');
    } finally {
      appendChildSpy.mockRestore();
    }
  });

  // ─── socialLoginWithToken coverage ──────────────────────────────────────

  it('should clean up in-flight when different request replaces it', () => {
    const results: (TokenResponse | string)[] = [];
    const errors: unknown[] = [];

    // First request in-flight
    service.socialLoginWithToken('google', 'token-1').subscribe({
      next: (r) => results.push(r),
      error: (e) => errors.push(e),
    });

    const req1 = http.expectOne(`${env.environment.apiUrl}/auth/social-login`);

    // Second request with different token replaces in-flight
    service.socialLoginWithToken('google', 'token-2').subscribe({
      next: () => results.push('second'),
      error: (e) => errors.push(e),
    });

    const req2 = http.expectOne(`${env.environment.apiUrl}/auth/social-login`);

    // Complete first request
    req1.flush(mockTokenResponse);

    // Complete second request
    req2.flush(mockTokenResponse);

    // Both should have results
    expect(results).toContain(mockTokenResponse);
    expect(results).toContain('second');
  });

  it('should handle no access token when logout calls google revoke', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const revokeMock = jest.fn();
    win.google = {
      accounts: { oauth2: { revoke: revokeMock } },
    };

    // Service has no access token stored
    service.logout();

    const req = http.expectOne(`${env.environment.apiUrl}/auth/logout`);
    req.flush({ message: 'Logged out successfully' });

    // revoke should NOT be called when there's no access token
    expect(revokeMock).not.toHaveBeenCalled();
    delete win.google;
  });
});
