import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { BookingSearchStore } from '../services/booking-search.store';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const searchStore = inject(BookingSearchStore);

  if (authService.isLoggedIn) {
    return true;
  }

  // Preserve the intended destination so we can redirect back after login
  searchStore.setRedirectIntent(state.url);

  // Preserve the intent so checkout can detect it returned from auth
  if (state.url.startsWith('/checkout')) {
    sessionStorage.setItem('booking_auth_redirect', 'true');
  }

  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn) {
    return true;
  }

  return router.createUrlTree(['/profile']);
};
