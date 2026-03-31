import { Routes } from '@angular/router';

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
  { path: '**', redirectTo: '' },
];
