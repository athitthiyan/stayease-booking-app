import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent),
    title: 'Stayvora - Stay Better. Travel Smarter.',
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./features/search-results/search-results.component').then(m => m.SearchResultsComponent),
    title: 'Search Rooms - Stayvora',
  },
  {
    path: 'rooms/:id',
    loadComponent: () =>
      import('./features/room-detail/room-detail.component').then(m => m.RoomDetailComponent),
    title: 'Room Details - Stayvora',
  },
  {
    path: 'checkout/:id',
    loadComponent: () =>
      import('./features/checkout/checkout.component').then(m => m.CheckoutComponent),
    title: 'Checkout - Stayvora',
    canActivate: [authGuard],
  },
  {
    path: 'booking-confirmation',
    loadComponent: () =>
      import('./features/booking-confirmation/booking-confirmation.component').then(m => m.BookingConfirmationComponent),
    title: 'Booking Confirmed - Stayvora',
  },
  {
    path: 'privacy-policy',
    loadComponent: () =>
      import('./features/legal-policy/legal-policy.component').then(m => m.LegalPolicyComponent),
    title: 'Privacy Policy - Stayvora',
    data: {
      content: {
        eyebrow: 'Legal',
        title: 'Privacy Policy',
        intro:
          'Stayvora collects only the information required to search, reserve, support, and reconcile hotel bookings safely. We do not sell personal booking data.',
        sections: [
          {
            heading: 'What we collect',
            body:
              'We collect guest identity, contact details, booking details, payment references, and support interactions needed to process reservations, communicate booking updates, and prevent fraud.',
          },
          {
            heading: 'How we use it',
            body:
              'We use your data to confirm reservations, process payments and refunds, help support teams resolve issues, and meet legal, tax, and fraud-prevention obligations.',
          },
          {
            heading: 'Retention and protection',
            body:
              'We retain operational and finance records for compliance and reconciliation. Access is limited to authorized systems and staff, and payment secrets are never exposed in customer UI flows.',
          },
        ],
      },
    },
  },
  {
    path: 'terms-and-conditions',
    loadComponent: () =>
      import('./features/legal-policy/legal-policy.component').then(m => m.LegalPolicyComponent),
    title: 'Terms and Conditions - Stayvora',
    data: {
      content: {
        eyebrow: 'Legal',
        title: 'Terms and Conditions',
        intro:
          'These terms govern your use of Stayvora to discover hotels, create booking holds, complete payments, and communicate with hotel partners through the platform.',
        sections: [
          {
            heading: 'Booking contract',
            body:
              'A booking becomes final only after payment confirmation and successful reservation confirmation from the platform. A hold alone does not guarantee final confirmation once the timer expires.',
          },
          {
            heading: 'Pricing and availability',
            body:
              'Prices, taxes, and availability may change until payment is confirmed. Stayvora surfaces live pricing and availability from partner-controlled inventory systems and booking locks.',
          },
          {
            heading: 'User responsibilities',
            body:
              'Guests must provide accurate traveler details and valid payment credentials. Abuse, automated scraping, fraud, and manipulation of inventory or payment flows may result in account restriction.',
          },
        ],
      },
    },
  },
  {
    path: 'cancellation-policy',
    loadComponent: () =>
      import('./features/legal-policy/legal-policy.component').then(m => m.LegalPolicyComponent),
    title: 'Cancellation Policy - Stayvora',
    data: {
      content: {
        eyebrow: 'Booking Policy',
        title: 'Cancellation Policy',
        intro:
          'Cancellation eligibility depends on the property terms shown at checkout and on the final confirmed booking state.',
        sections: [
          {
            heading: 'Free cancellation window',
            body:
              'Many stays support free cancellation within the initial policy window shown during checkout. After that window closes, hotel-specific charges may apply.',
          },
          {
            heading: 'Pending booking holds',
            body:
              'A pending booking hold may be cancelled by the guest before payment confirmation. Cancelling an active hold immediately releases dates back to inventory.',
          },
          {
            heading: 'Confirmed bookings',
            body:
              'Confirmed bookings follow the cancellation terms shown at checkout and in booking history. Where penalties apply, the refund amount will reflect those terms.',
          },
        ],
      },
    },
  },
  {
    path: 'refund-policy',
    loadComponent: () =>
      import('./features/legal-policy/legal-policy.component').then(m => m.LegalPolicyComponent),
    title: 'Refund Policy - Stayvora',
    data: {
      content: {
        eyebrow: 'Finance Policy',
        title: 'Refund Policy',
        intro:
          'Refunds are processed against the original successful payment once eligibility is confirmed under the property cancellation terms and the recorded payment state.',
        sections: [
          {
            heading: 'Eligible refunds',
            body:
              'Refunds may be approved for eligible cancellations, duplicate charges, unresolved inventory conflicts, or operational exceptions approved by support or finance.',
          },
          {
            heading: 'Processing timeline',
            body:
              'Once a refund is approved, Stayvora records the refund state and reconciles the payment transaction. Bank and card settlement times can vary by provider.',
          },
          {
            heading: 'Failed or partial refunds',
            body:
              'If a refund fails or requires manual intervention, finance support will investigate the payment record and contact the guest using the booking email on file.',
          },
        ],
      },
    },
  },
  {
    path: 'support',
    loadComponent: () =>
      import('./features/support/support.component').then(m => m.SupportComponent),
    title: 'Support - Stayvora',
  },
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
    title: 'Sign In - Stayvora',
    canActivate: [guestGuard],
  },
  {
    path: 'auth/signup',
    loadComponent: () =>
      import('./features/auth/signup/signup.component').then(m => m.SignupComponent),
    title: 'Create Account - Stayvora',
    canActivate: [guestGuard],
  },
  {
    path: 'auth/forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    title: 'Reset Password - Stayvora',
    canActivate: [guestGuard],
  },
  {
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    title: 'Set New Password - Stayvora',
  },
  {
    path: 'auth/callback/microsoft',
    loadComponent: () =>
      import('./features/auth/sso-callback/sso-callback.component').then(m => m.SsoCallbackComponent),
    title: 'Signing In - Stayvora',
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/profile.component').then(m => m.ProfileComponent),
    title: 'My Profile - Stayvora',
    canActivate: [authGuard],
  },
  {
    path: 'bookings',
    loadComponent: () =>
      import('./features/booking-history/booking-history.component').then(m => m.BookingHistoryComponent),
    title: 'My Bookings - Stayvora',
    canActivate: [authGuard],
  },
  {
    path: 'wishlist',
    loadComponent: () =>
      import('./features/wishlist/wishlist.component').then(m => m.WishlistComponent),
    title: 'Saved Stays - Stayvora',
    canActivate: [authGuard],
  },
  {
    path: '404',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then(m => m.NotFoundComponent),
    title: 'Page Not Found - Stayvora',
  },
  { path: '**', redirectTo: '/404' },
];
