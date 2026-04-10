// SECURITY WARNING: This is a development-only environment file.
// Keys exposed here (Google, Stripe, Microsoft) are safe for development/testing
// because they are restricted to localhost origins and use test/sandbox API keys.
// DO NOT use production API keys in this file.
// All keys in this file are already rotated/disabled in production.

import { PORTAL_URLS, STRIPE_TEST_KEY } from '../app/core/config/stayvora.config';

export const environment = {
  production: false,
  ...PORTAL_URLS.dev,
  paymentAppUrl: PORTAL_URLS.dev.paymentPortalUrl,
  microsoftClientId: '041f5aef-c9db-4eb8-9bb0-349a19fc3002',
  microsoftTenantId: '553e9dc0-268d-499d-b603-c817abd918f1',
  // Google OAuth client ID for Google Sign-In (different from Maps API key)
  googleClientId: '227255495608-2quh3crqstjaq22g0r2pt5mqj120pdre.apps.googleusercontent.com',
  googleMapsApiKey: 'AIzaSyA2Bgbm2nroTHIaPS-0oKGdSmyEktwT1s',
  stripePublishableKey: STRIPE_TEST_KEY,
  stripeEnabled: true,
  maintenanceMode: false,
  maintenanceHosts: [] as string[],
  // Google Analytics 4 — set measurement ID to enable (e.g. 'G-XXXXXXXXXX')
  gaMeasurementId: '',
  // Sentry DSN for error tracking — set to enable (e.g. 'https://...@sentry.io/...')
  sentryDsn: '',
};
