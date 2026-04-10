import { Injectable, NgZone, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, finalize, firstValueFrom, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { BrowserAuthError, RedirectRequest } from '../auth/msal-browser-shim';
import { MsalService } from '../auth/msal-angular-shim';
import { environment } from '../../../environments/environment';
import { loginRequest, consumePendingSession } from '../auth/msal.config';
import {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  MessageResponse,
  PhoneOtpRequest,
  PhoneOtpResponse,
  PhoneOtpVerifyRequest,
  ResetPasswordRequest,
  SocialLoginRequest,
  TokenResponse,
  UserLogin,
  UserProfileUpdate,
  UserResponse,
  UserSignup,
} from '../models/auth.model';

// Access token is persisted in localStorage so it survives page navigations
// (e.g. redirect to PayFlow payment app and back).  The HttpOnly refresh-token
// cookie is the primary session credential; the access token is a short-lived
// convenience cache.
// User profile is also cached in localStorage (non-sensitive data).
const USER_KEY = 'se_user';
const TOKEN_KEY = 'se_at';
const REFRESH_TOKEN_KEY = 'se_rt';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private msalService = inject(MsalService);
  private base = `${environment.apiUrl}/auth`;
  private googleLoginInProgress = false;
  private socialLoginInFlight:
    | {
        key: string;
        request$: Observable<TokenResponse>;
      }
    | null = null;
  private refreshTokenInFlight$: Observable<TokenResponse> | null = null;

  // Access token cached in memory and localStorage (survives page navigations)
  private accessTokenMemory: string | null = localStorage.getItem(TOKEN_KEY);

  private currentUserSubject = new BehaviorSubject<UserResponse | null>(
    this.loadUserFromStorage()
  );

  currentUser$ = this.currentUserSubject.asObservable();

  get currentUser(): UserResponse | null {
    return this.currentUserSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  get isAdmin(): boolean {
    return this.currentUserSubject.value?.is_admin ?? false;
  }

  getAccessToken(): string | null {
    // Lazy-consume the SSO session obtained during APP_INITIALIZER.
    // This fires the instant any service (e.g. ActiveBookingService) asks
    // for a token — before the SsoCallbackComponent even loads.
    if (!this.accessTokenMemory) {
      const pending = consumePendingSession();
      if (pending) {
        this.hydrateSession(pending.accessToken, pending.user);
      }
    }
    // Fall back to localStorage if memory was cleared (e.g. page navigation)
    if (!this.accessTokenMemory) {
      this.accessTokenMemory = localStorage.getItem(TOKEN_KEY);
    }
    return this.accessTokenMemory;
  }

  /**
   * Restore session on app init by calling /auth/refresh.
   * The HttpOnly cookie is sent automatically by the browser.
   * Returns true if session was restored, false otherwise.
   */
  initSession(): Observable<boolean> {
    // If we have a cached user, attempt a silent refresh to get a fresh access token.
    // If refresh fails (e.g. cookie lost, transient error), we still preserve
    // the cached user so the UI shows them as logged in.  The auth interceptor
    // will retry the refresh on the first real API call; if that also fails it
    // will redirect to login.  This prevents unnecessary logouts after cross-app
    // navigations (e.g. returning from PayFlow payment app).
    const cachedUser = this.loadUserFromStorage();
    if (cachedUser) {
      // Ensure the BehaviorSubject is hydrated even before refresh completes
      if (!this.currentUserSubject.value) {
        this.currentUserSubject.next(cachedUser);
      }
      if (!this.getStoredRefreshToken()) {
        return of(!!this.getAccessToken());
      }
      return this.refreshToken().pipe(
        tap(() => { /* session restored with fresh token */ }),
        switchMap(() => of(true)),
        catchError(() => {
          // Don't clear the user — they may still have a valid session.
          // The cached access token in localStorage (if present) will be
          // used for the next API call; the interceptor handles 401 → refresh.
          return of(true);
        })
      );
    }
    return of(false);
  }

  signup(payload: UserSignup): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.base}/signup`, payload).pipe(
      tap(res => this.persistSession(res))
    );
  }

  login(payload: UserLogin): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.base}/login`, payload).pipe(
      tap(res => this.persistSession(res))
    );
  }

  socialLogin(payload: SocialLoginRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.base}/social-login`, payload).pipe(
      tap(res => this.persistSession(res))
    );
  }

  refreshToken(): Observable<TokenResponse> {
    if (this.refreshTokenInFlight$) {
      return this.refreshTokenInFlight$;
    }

    const refreshToken = this.getStoredRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available.'));
    }

    this.refreshTokenInFlight$ = this.http
      .post<TokenResponse>(
        `${this.base}/refresh`,
        { refresh_token: refreshToken },
        { withCredentials: true }
      )
      .pipe(
        tap(res => this.persistSession(res)),
        finalize(() => {
          this.refreshTokenInFlight$ = null;
        }),
        shareReplay(1),
      );

    return this.refreshTokenInFlight$;
  }

  getMe(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.base}/me`).pipe(
      tap(user => {
        this.currentUserSubject.next(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      })
    );
  }

  updateProfile(payload: UserProfileUpdate): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.base}/me`, payload).pipe(
      tap(user => {
        this.currentUserSubject.next(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      })
    );
  }

  requestPhoneOtp(payload: PhoneOtpRequest): Observable<PhoneOtpResponse> {
    return this.http.post<PhoneOtpResponse>(`${this.base}/phone/request-otp`, payload);
  }

  verifyPhoneOtp(payload: PhoneOtpVerifyRequest): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.base}/phone/verify`, payload).pipe(
      tap(user => {
        this.currentUserSubject.next(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      })
    );
  }

  changePassword(payload: ChangePasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.base}/change-password`, payload);
  }

  forgotPassword(payload: ForgotPasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.base}/forgot-password`, payload);
  }

  resetPassword(payload: ResetPasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.base}/reset-password`, payload);
  }

  logout(): void {
    // Revoke refresh token server-side (cookie sent automatically)
    this.http.post(`${this.base}/logout`, {}, { withCredentials: true }).subscribe({
      // The session may already be gone; local logout should still complete quietly.
      error: () => void 0,
    });
    // Revoke Google session if GIS is loaded
    const google = (window as unknown as { google?: { accounts: GoogleAccounts } }).google;
    if (google?.accounts?.oauth2?.revoke) {
      const token = this.getAccessToken();
      if (token) {
        google.accounts.oauth2.revoke(token, () => { /* best-effort */ });
      }
    }
    this.clearLocal();
    this.router.navigate(['/auth/login']);
  }

  private clearLocal(): void {
    this.accessTokenMemory = null;
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this.currentUserSubject.next(null);
  }

  private getStoredRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  private loadUserFromStorage(): UserResponse | null {
    const user = localStorage.getItem(USER_KEY);
    if (!user) return null;
    try {
      return JSON.parse(user);
    } catch {
      return null;
    }
  }

  /**
   * Hydrate the in-memory session from data obtained outside Angular
   * (e.g. the MSAL APP_INITIALIZER fetch).  The HttpOnly refresh cookie
   * was already stored by the browser; we just need the access token in memory.
   */
  hydrateSession(accessToken: string, user: unknown): void {
    this.accessTokenMemory = accessToken;
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (user) {
      const typed = user as UserResponse;
      this.currentUserSubject.next(typed);
      localStorage.setItem(USER_KEY, JSON.stringify(typed));
    }
  }

  private persistSession(resp: TokenResponse): void {
    if (resp.access_token) {
      this.accessTokenMemory = resp.access_token;
      localStorage.setItem(TOKEN_KEY, resp.access_token);
    }
    if (resp.refresh_token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, resp.refresh_token);
    }
    if (resp.user) {
      this.currentUserSubject.next(resp.user);
      localStorage.setItem(USER_KEY, JSON.stringify(resp.user));
    }
  }

  loginWithGoogle(): Promise<void> {
    if (this.googleLoginInProgress) {
      return Promise.reject(new Error('A Google sign-in is already in progress.'));
    }
    this.googleLoginInProgress = true;

    return new Promise<void>((resolve, reject) => {
      const clientId = environment.googleClientId;
      if (!clientId) {
        this.googleLoginInProgress = false;
        reject(new Error('Google Client ID is not configured.'));
        return;
      }

      const done = () => { this.googleLoginInProgress = false; };

      const initAndPrompt = () => {
        const google = (window as unknown as { google?: { accounts: GoogleAccounts } }).google;
        if (!google) {
          done();
          reject(new Error('Google Identity Services failed to load.'));
          return;
        }

        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          callback: (response: GoogleTokenResponse) => {
            if (response.error || !response.access_token) {
              this.ngZone.run(() => {
                done();
                const msg = response.error === 'access_denied'
                  ? 'Google Sign-In was denied. Please grant the required permissions.'
                  : 'Google Sign-In was cancelled.';
                reject(new Error(msg));
              });
              return;
            }
            this.ngZone.run(() => {
              this.socialLoginWithToken('google', response.access_token!).subscribe({
                next: () => {
                  done();
                  // Redirect to the page the user was on before login
                  const intended = sessionStorage.getItem('sv_redirect_after_login');
                  if (intended) {
                    sessionStorage.removeItem('sv_redirect_after_login');
                    this.router.navigateByUrl(intended);
                  } else {
                    this.router.navigate(['/']);
                  }
                  resolve();
                },
                error: (err: unknown) => { done(); reject(err); },
              });
            });
          },
        });

        client.requestAccessToken();
      };

      if ((window as unknown as { google?: unknown }).google) {
        initAndPrompt();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => initAndPrompt();
      script.onerror = () => { done(); reject(new Error('Failed to load Google Identity Services.')); };
      document.body.appendChild(script);
    });
  }

  async loginWithMicrosoft(): Promise<void> {
    try {
      // Redirect flow: navigates the page to Microsoft login.
      // After auth, Microsoft redirects back to /auth/callback/microsoft
      // where the SsoCallbackComponent handles the response.
      await firstValueFrom(this.msalService.loginRedirect(loginRequest as RedirectRequest));
    } catch (err: unknown) {
      if (err instanceof BrowserAuthError) {
        switch (err.errorCode) {
          case 'interaction_in_progress':
            throw new Error('A sign-in is already in progress. Please wait.');
          default:
            throw new Error('Microsoft Sign-In failed. Please try again.');
        }
      }
      throw err;
    }
  }

  socialLoginWithToken(provider: 'google' | 'apple' | 'microsoft', idToken: string): Observable<TokenResponse> {
    const key = `${provider}:${idToken}`;
    if (this.socialLoginInFlight?.key === key) {
      return this.socialLoginInFlight.request$;
    }

    const request$ = this.http.post<TokenResponse>(`${this.base}/social-login`, {
      provider,
      id_token: idToken,
    }).pipe(
      tap(resp => this.persistSession(resp)),
      finalize(() => {
        if (this.socialLoginInFlight?.key === key) {
          this.socialLoginInFlight = null;
        }
      }),
      shareReplay(1),
    );

    this.socialLoginInFlight = {
      key,
      request$,
    };

    return request$;
  }
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken(): void;
}

interface GoogleAccounts {
  oauth2: {
    initTokenClient(config: {
      client_id: string;
      scope: string;
      callback: (response: GoogleTokenResponse) => void;
    }): GoogleTokenClient;
    revoke?(token: string, callback: () => void): void;
  };
}
