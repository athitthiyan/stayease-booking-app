import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';


describe('authGuard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoggedIn: false } },
        { provide: Router, useValue: { createUrlTree: jest.fn(() => 'url-tree') } },
      ],
    });
  });

  afterEach(() => sessionStorage.clear());

  // ── Phase 3: login-before-hold guard ───────────────────────────────────────

  it('allows access when user is logged in', () => {
    TestBed.overrideProvider(AuthService, { useValue: { isLoggedIn: true } });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/profile' } as RouterStateSnapshot)
    );
    expect(result).toBe(true);
  });

  it('redirects to /auth/login when user is not logged in', () => {
    const router = TestBed.inject(Router);
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/profile' } as RouterStateSnapshot)
    );
    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/profile' },
    });
  });

  it('preserves returnUrl when redirecting from /bookings page', () => {
    const router = TestBed.inject(Router);
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/bookings' } as RouterStateSnapshot)
    );
    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/bookings' },
    });
  });

  it('sets booking_auth_redirect in sessionStorage when redirecting from /checkout URL', () => {
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/checkout/42' } as RouterStateSnapshot)
    );
    expect(sessionStorage.getItem('booking_auth_redirect')).toBe('true');
  });

  it('does NOT set booking_auth_redirect when redirecting from non-checkout URL', () => {
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/profile' } as RouterStateSnapshot)
    );
    expect(sessionStorage.getItem('booking_auth_redirect')).toBeNull();
  });

  it('does NOT set booking_auth_redirect when user is already logged in (no redirect happens)', () => {
    TestBed.overrideProvider(AuthService, { useValue: { isLoggedIn: true } });
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/checkout/42' } as RouterStateSnapshot)
    );
    expect(sessionStorage.getItem('booking_auth_redirect')).toBeNull();
  });
});

describe('guestGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoggedIn: false } },
        { provide: Router, useValue: { createUrlTree: jest.fn(() => 'url-tree') } },
      ],
    });
  });

  it('allows access when user is not logged in', () => {
    const result = TestBed.runInInjectionContext(() =>
      guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
    expect(result).toBe(true);
  });

  it('redirects to /profile when user is already logged in', () => {
    TestBed.overrideProvider(AuthService, { useValue: { isLoggedIn: true } });
    const router = TestBed.inject(Router);
    TestBed.runInInjectionContext(() =>
      guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
    expect(router.createUrlTree).toHaveBeenCalledWith(['/profile']);
  });
});
