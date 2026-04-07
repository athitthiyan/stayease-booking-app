import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { AuthenticationResult } from '@azure/msal-browser';

import { SsoCallbackComponent } from './sso-callback.component';
import { AuthService } from '../../../core/services/auth.service';

describe('SsoCallbackComponent', () => {
  const authService = {
    socialLoginWithToken: jest.fn(),
  };

  const msalService = {
    handleRedirectObservable: jest.fn(),
  };

  function setup(fragment: string | null, url = '/auth/callback/microsoft') {
    msalService.handleRedirectObservable.mockReturnValue(of(null));

    TestBed.configureTestingModule({
      imports: [SsoCallbackComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: MsalService, useValue: msalService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { fragment } },
        },
      ],
    });

    const router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    jest.spyOn(router, 'url', 'get').mockReturnValue(url);

    const fixture = TestBed.createComponent(SsoCallbackComponent);
    return { fixture, component: fixture.componentInstance, router };
  }

  beforeEach(() => {
    authService.socialLoginWithToken.mockReset();
    msalService.handleRedirectObservable.mockReset();
  });

  // ─── MSAL redirect handling ─────────────────────────────────────────────

  it('handles MSAL redirect result with idToken', () => {
    const msalResult = { idToken: 'msal-jwt' } as AuthenticationResult;
    authService.socialLoginWithToken.mockReturnValue(of({ access_token: 'tok' }));

    const { component, router } = setup(null, '/auth/callback/microsoft');
    msalService.handleRedirectObservable.mockReturnValue(of(msalResult));
    component.ngOnInit();

    expect(authService.socialLoginWithToken).toHaveBeenCalledWith('microsoft', 'msal-jwt');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  // ─── Fragment fallback ──────────────────────────────────────────────────

  it('falls back to fragment when MSAL returns null and sets error when no id_token', () => {
    msalService.handleRedirectObservable.mockReturnValue(of(null));
    const { component } = setup(null);
    component.ngOnInit();
    expect(component.error()).toBe('Sign-in failed. No authentication token received.');
    expect(authService.socialLoginWithToken).not.toHaveBeenCalled();
  });

  it('falls back to fragment when MSAL returns null and fragment has no id_token param', () => {
    msalService.handleRedirectObservable.mockReturnValue(of(null));
    const { component } = setup('state=abc');
    component.ngOnInit();
    expect(component.error()).toBe('Sign-in failed. No authentication token received.');
  });

  it('falls back to fragment parsing when MSAL returns null', () => {
    msalService.handleRedirectObservable.mockReturnValue(of(null));
    authService.socialLoginWithToken.mockReturnValue(of({ access_token: 'tok' }));
    const { component, router } = setup('id_token=test-jwt', '/auth/callback/microsoft');
    component.ngOnInit();
    expect(authService.socialLoginWithToken).toHaveBeenCalledWith('microsoft', 'test-jwt');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('falls back to fragment parsing when MSAL errors', () => {
    msalService.handleRedirectObservable.mockReturnValue(throwError(() => new Error('msal error')));
    authService.socialLoginWithToken.mockReturnValue(of({ access_token: 'tok' }));
    const { component, router } = setup('id_token=fallback-jwt', '/auth/callback/microsoft');
    component.ngOnInit();
    expect(authService.socialLoginWithToken).toHaveBeenCalledWith('microsoft', 'fallback-jwt');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('resolves google provider from URL', () => {
    msalService.handleRedirectObservable.mockReturnValue(of(null));
    authService.socialLoginWithToken.mockReturnValue(of({ access_token: 'tok' }));
    const { component } = setup('id_token=goog-jwt', '/auth/callback/google');
    component.ngOnInit();
    expect(authService.socialLoginWithToken).toHaveBeenCalledWith('google', 'goog-jwt');
  });

  it('defaults to microsoft when URL has no known provider', () => {
    msalService.handleRedirectObservable.mockReturnValue(of(null));
    authService.socialLoginWithToken.mockReturnValue(of({ access_token: 'tok' }));
    const { component } = setup('id_token=jwt', '/auth/callback/unknown');
    component.ngOnInit();
    expect(authService.socialLoginWithToken).toHaveBeenCalledWith('microsoft', 'jwt');
  });

  it('sets error when socialLoginWithToken fails', () => {
    msalService.handleRedirectObservable.mockReturnValue(of(null));
    authService.socialLoginWithToken.mockReturnValue(throwError(() => new Error('fail')));
    const { component } = setup('id_token=bad-jwt');
    component.ngOnInit();
    expect(component.error()).toBe('Sign-in failed. Please try again.');
  });

  it('navigates to login on goToLogin()', () => {
    const { component, router } = setup(null);
    component.goToLogin();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});
