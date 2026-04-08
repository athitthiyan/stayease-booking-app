import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';

import { SsoCallbackComponent } from './sso-callback.component';
import { AuthService } from '../../../core/services/auth.service';
import { BookingSearchStore } from '../../../core/services/booking-search.store';
import * as msalConfig from '../../../core/auth/msal.config';

describe('SsoCallbackComponent', () => {
  const authService = {
    socialLoginWithToken: jest.fn(),
  };
  const searchStore = {
    getAndClearRedirectIntent: jest.fn(),
  };

  let getMsalRedirectResultSpy: jest.SpyInstance;
  let wasBackendLoginDoneSpy: jest.SpyInstance;

  function setup(fragment: string | null, url = '/auth/callback/microsoft') {
    TestBed.configureTestingModule({
      imports: [SsoCallbackComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: BookingSearchStore, useValue: searchStore },
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
    searchStore.getAndClearRedirectIntent.mockReset();
    searchStore.getAndClearRedirectIntent.mockReturnValue(null);
    getMsalRedirectResultSpy = jest.spyOn(msalConfig, 'getMsalRedirectResult').mockReturnValue(null);
    wasBackendLoginDoneSpy = jest.spyOn(msalConfig, 'wasBackendLoginDone').mockReturnValue(false);
    window.history.replaceState({}, '', '/auth/callback/microsoft');
  });

  afterEach(() => {
    getMsalRedirectResultSpy.mockRestore();
    wasBackendLoginDoneSpy.mockRestore();
    window.history.replaceState({}, '', '/');
  });

  // ─── Backend login completed in APP_INITIALIZER ───────────────────────

  it('navigates home when backend login already completed', () => {
    wasBackendLoginDoneSpy.mockReturnValue(true);
    const { component, router } = setup(null);
    component.ngOnInit();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
    expect(authService.socialLoginWithToken).not.toHaveBeenCalled();
  });

  it('redirects to the originally intended route when one is stored', () => {
    wasBackendLoginDoneSpy.mockReturnValue(true);
    searchStore.getAndClearRedirectIntent.mockReturnValue('/checkout/5');

    const { component, router } = setup(null);
    const navigateByUrlSpy = jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.ngOnInit();

    expect(navigateByUrlSpy).toHaveBeenCalledWith('/checkout/5');
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

  it('surfaces OAuth callback errors from the URL', () => {
    window.history.replaceState(
      {},
      '',
      '/auth/callback/microsoft?error=unsupported_response_type&error_description=The+provided+value+for+the+input+parameter+response_type+is+not+supported.',
    );

    const { component } = setup(null);
    component.ngOnInit();

    expect(component.error()).toBe(
      'Microsoft Sign-In is not configured correctly for this app. Please try again after updating the Microsoft app registration.',
    );
    expect(authService.socialLoginWithToken).not.toHaveBeenCalled();
  });

  it('shows a retry message when a code exists but token completion did not happen', () => {
    window.history.replaceState({}, '', '/auth/callback/microsoft?code=auth-code-123');

    const { component } = setup(null);
    component.ngOnInit();

    expect(component.error()).toBe('Sign-in could not be completed. Please try again.');
  });

  it('falls back to the generic OAuth message when no error description is present', () => {
    window.history.replaceState({}, '', '/auth/callback/microsoft?error=server_error');

    const { component } = setup(null);
    component.ngOnInit();

    expect(component.error()).toBe('Sign-in failed. Please try again.');
  });

  it('decodes OAuth error descriptions from the callback URL', () => {
    window.history.replaceState(
      {},
      '',
      '/auth/callback/microsoft?error=server_error&error_description=User+canceled+login',
    );

    const { component } = setup(null);
    component.ngOnInit();

    expect(component.error()).toBe('User canceled login');
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

  it('navigates home when no redirect intent is stored after a successful callback', () => {
    authService.socialLoginWithToken.mockReturnValue(of({ access_token: 'tok' }));
    const { component, router } = setup('id_token=jwt');
    const navigateByUrlSpy = jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.ngOnInit();

    expect(navigateByUrlSpy).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
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
