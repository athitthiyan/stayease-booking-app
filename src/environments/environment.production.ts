// SECURITY NOTE: All production URLs use HTTPS for secure communication.
// Verify SSL certificates are properly configured and certificate pinning is implemented
// at the network/backend level to prevent man-in-the-middle attacks.

import { PORTAL_URLS, STRIPE_TEST_KEY } from '../app/core/config/stayvora.config';

export const environment = {
  production: true,
  ...PORTAL_URLS.prod,
  paymentAppUrl: PORTAL_URLS.prod.paymentPortalUrl,
  microsoftClientId: '041f5aef-c9db-4eb8-9bb0-349a19fc3002',
  microsoftTenantId: '553e9dc0-268d-499d-b603-c817abd918f1',
  googleClientId: '227255495608-2quh3crqstjaq22g0r2pt5mqj120pdre.apps.googleusercontent.com',
  googleMapsApiKey: 'AIzaSyA2Bgbm2nroTHIaPS-0oKGdSmyEktwT1s',
  stripePublishableKey: STRIPE_TEST_KEY,
  stripeEnabled: false,
  maintenanceMode: false,
  maintenanceHosts: ['www.stayvora.co.in'],
  gaMeasurementId: '',
};
