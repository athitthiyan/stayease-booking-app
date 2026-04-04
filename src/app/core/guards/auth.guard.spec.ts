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
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { isLoggedIn: false },
        },
        {
          provide: Router,
          useValue: { createUrlTree: jest.fn(() => 'url-tree') },
        },
      ],
    });
  });

  it('should allow access when user is logged in', () => {
    TestBed.overrideProvider(AuthService, { useValue: { isLoggedIn: true } });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/profile' } as RouterStateSnapshot)
    );
    expect(result).toBe(true);
  });

  it('should redirect to /auth/login when user is not logged in', () => {
    const router = TestBed.inject(Router);
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/profile' } as RouterStateSnapshot)
    );
    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/profile' },
    });
  });
});

describe('guestGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { isLoggedIn: false },
        },
        {
          provide: Router,
          useValue: { createUrlTree: jest.fn(() => 'url-tree') },
        },
      ],
    });
  });

  it('should allow access when user is not logged in', () => {
    const result = TestBed.runInInjectionContext(() =>
      guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
    expect(result).toBe(true);
  });

  it('should redirect to /profile when user is already logged in', () => {
    TestBed.overrideProvider(AuthService, { useValue: { isLoggedIn: true } });
    const router = TestBed.inject(Router);
    TestBed.runInInjectionContext(() =>
      guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
    expect(router.createUrlTree).toHaveBeenCalledWith(['/profile']);
  });
});
