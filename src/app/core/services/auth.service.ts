import { Injectable, NgZone, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
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

const ACCESS_TOKEN_KEY = 'se_access_token';
const REFRESH_TOKEN_KEY = 'se_refresh_token';
const USER_KEY = 'se_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private base = `${environment.apiUrl}/auth`;

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
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
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
    const refresh_token = this.getRefreshToken();
    return this.http
      .post<TokenResponse>(`${this.base}/refresh`, { refresh_token })
      .pipe(tap(res => this.persistSession(res)));
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
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/auth/login']);
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

  private persistSession(resp: TokenResponse): void {
    if (resp.access_token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, resp.access_token);
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
    return new Promise((resolve, reject) => {
      const clientId = environment.googleClientId;
      if (!clientId) {
        reject(new Error('Google Client ID is not configured.'));
        return;
      }

      const initAndPrompt = () => {
        const google = (window as unknown as { google?: { accounts: GoogleAccounts } }).google;
        if (!google) {
          reject(new Error('Google Identity Services failed to load.'));
          return;
        }

        // Use OAuth2 token client with popup — returns an access_token
        // the backend verifies via Google userinfo endpoint
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          callback: (response: { access_token?: string; error?: string }) => {
            if (response.error || !response.access_token) {
              this.ngZone.run(() => reject(new Error('Google Sign-In was cancelled.')));
              return;
            }
            this.ngZone.run(() => {
              this.socialLoginWithToken('google', response.access_token!).subscribe({
                next: () => {
                  this.router.navigate(['/']);
                  resolve();
                },
                error: (err: unknown) => reject(err),
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
      script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
      document.body.appendChild(script);
    });
  }

  async loginWithMicrosoft(): Promise<void> {
    const clientId = environment.microsoftClientId || '';
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback/microsoft');
    const scope = encodeURIComponent('openid email profile');
    const nonce = Math.random().toString(36).slice(2);
    const authUrl =
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
      `?client_id=${clientId}` +
      `&response_type=id_token` +
      `&redirect_uri=${redirectUri}` +
      `&scope=${scope}` +
      `&response_mode=fragment` +
      `&nonce=${nonce}`;
    window.location.href = authUrl;
  }

  socialLoginWithToken(provider: 'google' | 'apple' | 'microsoft', idToken: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.base}/social-login`, {
      provider,
      id_token: idToken
    }).pipe(
      tap(resp => this.persistSession(resp))
    );
  }
}

interface GoogleTokenClient {
  requestAccessToken(): void;
}

interface GoogleAccounts {
  oauth2: {
    initTokenClient(config: {
      client_id: string;
      scope: string;
      callback: (response: { access_token?: string; error?: string }) => void;
    }): GoogleTokenClient;
  };
}