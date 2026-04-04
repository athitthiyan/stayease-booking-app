import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent),
    title: 'StayEase — Find Your Perfect Stay',
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./features/search-results/search-results.component').then(m => m.SearchResultsComponent),
    title: 'Search Rooms — StayEase',
  },
  {
    path: 'rooms/:id',
    loadComponent: () =>
      import('./features/room-detail/room-detail.component').then(m => m.RoomDetailComponent),
    title: 'Room Details — StayEase',
  },
  {
    path: 'checkout/:id',
    loadComponent: () =>
      import('./features/checkout/checkout.component').then(m => m.CheckoutComponent),
    title: 'Checkout — StayEase',
  },
  {
    path: 'booking-confirmation',
    loadComponent: () =>
      import('./features/booking-confirmation/booking-confirmation.component').then(m => m.BookingConfirmationComponent),
    title: 'Booking Confirmed — StayEase',
  },

  // ─── Auth (guest-only) ───────────────────────────────────────────────────────
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
    title: 'Sign In — StayEase',
    canActivate: [guestGuard],
  },
  {
    path: 'auth/signup',
    loadComponent: () =>
      import('./features/auth/signup/signup.component').then(m => m.SignupComponent),
    title: 'Create Account — StayEase',
    canActivate: [guestGuard],
  },
  {
    path: 'auth/forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    title: 'Reset Password — StayEase',
    canActivate: [guestGuard],
  },
  {
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    title: 'Set New Password — StayEase',
  },

  // ─── Authenticated routes ────────────────────────────────────────────────────
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/profile.component').then(m => m.ProfileComponent),
    title: 'My Profile — StayEase',
    canActivate: [authGuard],
  },
  {
    path: 'bookings',
    loadComponent: () =>
      import('./features/booking-history/booking-history.component').then(m => m.BookingHistoryComponent),
    title: 'My Bookings — StayEase',
    canActivate: [authGuard],
  },
  {
    path: 'wishlist',
    loadComponent: () =>
      import('./features/wishlist/wishlist.component').then(m => m.WishlistComponent),
    title: 'Saved Stays — StayEase',
    canActivate: [authGuard],
  },

  { path: '**', redirectTo: '' },
];
