import { of, throwError } from 'rxjs';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
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
    handleRedirectObservable: jest.fn().mockReturnValue(of(null)),
    instance: {
      handleRedirectPromise: jest.fn(),
    },
  };

  function setup(fragment: string | null, url = '/auth/callback/microsoft') {
    msalService.instance.handleRedirectPromise.mockResolvedValue(null);

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
    msalService.instance.handleRedirectPromise.mockReset();
  });

  // ─── MSAL redirect handling ─────────────────────────────────────────────

  it('handles MSAL redirect result with idToken', fakeAsync(() => {
    const msalResult = { idToken: 'msal-jwt' } as AuthenticationResult;
    authService.socialLoginWithToken.mockReturnValue(of({ access_token: 'tok' }));

    const { component, router } = setup(null, '/auth/callback/microsoft');
    msalService.instance.handleRedirectPromise.mockResolvedValue(msalResult);
    component.ngOnInit();
    tick();

    expect(authService.socialLoginWithToken).toHaveBeenCalledWith('microsoft', 'msal-jwt');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  }));

  // ─── Fragment fallback ──────────────────────────────────────────────────

  it('falls back to fragment when MSAL returns null and sets error when no id_token', fakeAsync(() => {
    const { component } = setup(null);
    component.ngOnInit();
    tick();
    expect(component.error()).toBe('Sign-in failed. No authentication token received.');
    expect(authService.socialLoginWithToken).not.toHaveBeenCalled();
  }));

  it('falls back to fragment when MSAL returns null and fragment has no id_token param', fakeAsync(() => {
    const { component } = setup('state=abc');
    component.ngOnInit();
    tick();
    expect(component.error()).toBe('Sign-in failed. No authentication token received.');
  }));

  it('falls back to fragment parsing when MSAL returns null', fakeAsync(() => {
    authService.socialLoginWithToken.mockReturnValue(of({ access_token: 'tok' }));
    const { component, router } = setup('id_token=test-jwt', '/auth/callback/microsoft');
    component.ngOnInit();
    tick();
    expect(authService.socialLoginWithToken).toHaveBeenCalledWith('microsoft', 'test-jwt');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  }));

  it('falls back to fragment parsing when MSAL rejects', fakeAsync(() => {
    authService.socialLoginWithToken.mockReturnValue(of({ access_token: 'tok' }));
    const { component, router } = setup('id_token=fallback-jwt', '/auth/callback/microsoft');
    msalService.instance.handleRedirectPromise.mockRejectedValue(new Error('msal error'));
    component.ngOnInit();
    tick();
    expect(authService.socialLoginWithToken).toHaveBeenCalledWith('microsoft', 'fallback-jwt');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  }));

  it('resolves google provider from URL', fakeAsync(() => {
    authService.socialLoginWithToken.mockReturnValue(of({ access_token: 'tok' }));
    const { component } = setup('id_token=goog-jwt', '/auth/callback/google');
    component.ngOnInit();
    tick();
    expect(authService.socialLoginWithToken).toHaveBeenCalledWith('google', 'goog-jwt');
  }));

  it('defaults to microsoft when URL has no known provider', fakeAsync(() => {
    authService.socialLoginWithToken.mockReturnValue(of({ access_token: 'tok' }));
    const { component } = setup('id_token=jwt', '/auth/callback/unknown');
    component.ngOnInit();
    tick();
    expect(authService.socialLoginWithToken).toHaveBeenCalledWith('microsoft', 'jwt');
  }));

  it('sets error when socialLoginWithToken fails', fakeAsync(() => {
    authService.socialLoginWithToken.mockReturnValue(throwError(() => new Error('fail')));
    const { component } = setup('id_token=bad-jwt');
    component.ngOnInit();
    tick();
    expect(component.error()).toBe('Sign-in failed. Please try again.');
  }));

  it('navigates to login on goToLogin()', () => {
    const { component, router } = setup(null);
    component.goToLogin();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});
