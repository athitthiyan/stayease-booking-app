import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';

import { SsoCallbackComponent } from './sso-callback.component';
import { AuthService } from '../../../core/services/auth.service';
import * as msalConfig from '../../../core/auth/msal.config';

describe('SsoCallbackComponent', () => {
  const authService = {
    socialLoginWithToken: jest.fn(),
  };

  let getMsalRedirectResultSpy: jest.SpyInstance;
  let wasBackendLoginDoneSpy: jest.SpyInstance;

  function setup(fragment: string | null, url = '/auth/callback/microsoft') {
    TestBed.configureTestingModule({
      imports: [SsoCallbackComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
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
    getMsalRedirectResultSpy = jest.spyOn(msalConfig, 'getMsalRedirectResult').mockReturnValue(null);
    wasBackendLoginDoneSpy = jest.spyOn(msalConfig, 'wasBackendLoginDone').mockReturnValue(false);
  });

  afterEach(() => {
    getMsalRedirectResultSpy.mockRestore();
    wasBackendLoginDoneSpy.mockRestore();
  });

  // ─── Backend login completed in APP_INITIALIZER ───────────────────────

  it('navigates home when backend login already completed', () => {
    wasBackendLoginDoneSpy.mockReturnValue(true);
    const { component, router } = setup(null);
    component.ngOnInit();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
    expect(authService.socialLoginWithToken).not.toHaveBeenCalled();
  });

  // ─── MSAL result available but backend not done ───────────────────────

  it('sends MSAL idToken to backend when redirect result available', () => {
    getMsalRedirectResultSpy.mockReturnValue({ idToken: 'msal-jwt' });
    authService.socialLoginWithToken.mockReturnValue(of({ access_token: 'tok' }));

    const { component, router } = setup(null, '/auth/callback/microsoft');
    component.ngOnInit();

    expect(authService.socialLoginWithToken).toHaveBeenCalledWith('microsoft', 'msal-jwt');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  // ─── Fragment fallback ──────────────────────────────────────────────────

  it('falls back to fragment and sets error when no id_token', () => {
    const { component } = setup(null);
    component.ngOnInit();
    expect(component.error()).toBe('Sign-in failed. No authentication token received.');
    expect(authService.socialLoginWithToken).not.toHaveBeenCalled();
  });

  it('falls back to fragment parsing with id_token', () => {
    authService.socialLoginWithToken.mockReturnValue(of({ access_token: 'tok' }));
    const { component, router } = setup('id_token=test-jwt', '/auth/callback/microsoft');
    component.ngOnInit();
    expect(authService.socialLoginWithToken).toHaveBeenCalledWith('microsoft', 'test-jwt');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('resolves google provider from URL', () => {
    authService.socialLoginWithToken.mockReturnValue(of({ access_token: 'tok' }));
    const { component } = setup('id_token=goog-jwt', '/auth/callback/google');
    component.ngOnInit();
    expect(authService.socialLoginWithToken).toHaveBeenCalledWith('google', 'goog-jwt');
  });

  it('defaults to microsoft when URL has no known provider', () => {
    authService.socialLoginWithToken.mockReturnValue(of({ access_token: 'tok' }));
    const { component } = setup('id_token=jwt', '/auth/callback/unknown');
    component.ngOnInit();
    expect(authService.socialLoginWithToken).toHaveBeenCalledWith('microsoft', 'jwt');
  });

  it('sets error when socialLoginWithToken fails', () => {
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
