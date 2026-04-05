import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent),
    title: 'Stayvora — Stay Better. Travel Smarter.',
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./features/search-results/search-results.component').then(m => m.SearchResultsComponent),
    title: 'Search Rooms — Stayvora',
  },
  {
    path: 'rooms/:id',
    loadComponent: () =>
      import('./features/room-detail/room-detail.component').then(m => m.RoomDetailComponent),
    title: 'Room Details — Stayvora',
  },
  {
    path: 'checkout/:id',
    loadComponent: () =>
      import('./features/checkout/checkout.component').then(m => m.CheckoutComponent),
    title: 'Checkout — Stayvora',
    canActivate: [authGuard],
  },
  {
    path: 'booking-confirmation',
    loadComponent: () =>
      import('./features/booking-confirmation/booking-confirmation.component').then(m => m.BookingConfirmationComponent),
    title: 'Booking Confirmed — Stayvora',
  },

  // ─── Auth (guest-only) ───────────────────────────────────────────────────────
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
    title: 'Sign In — Stayvora',
    canActivate: [guestGuard],
  },
  {
    path: 'auth/signup',
    loadComponent: () =>
      import('./features/auth/signup/signup.component').then(m => m.SignupComponent),
    title: 'Create Account — Stayvora',
    canActivate: [guestGuard],
  },
  {
    path: 'auth/forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    title: 'Reset Password — Stayvora',
    canActivate: [guestGuard],
  },
  {
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    title: 'Set New Password — Stayvora',
  },

  // ─── Authenticated routes ────────────────────────────────────────────────────
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/profile.component').then(m => m.ProfileComponent),
    title: 'My Profile — Stayvora',
    canActivate: [authGuard],
  },
  {
    path: 'bookings',
    loadComponent: () =>
      import('./features/booking-history/booking-history.component').then(m => m.BookingHistoryComponent),
    title: 'My Bookings — Stayvora',
    canActivate: [authGuard],
  },
  {
    path: 'wishlist',
    loadComponent: () =>
      import('./features/wishlist/wishlist.component').then(m => m.WishlistComponent),
    title: 'Saved Stays — Stayvora',
    canActivate: [authGuard],
  },

  {
    path: '404',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then(m => m.NotFoundComponent),
    title: 'Page Not Found — Stayvora',
  },
  { path: '**', redirectTo: '/404' },
];
