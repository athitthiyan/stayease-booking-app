// SECURITY NOTE: All production URLs use HTTPS for secure communication.
// Verify SSL certificates are properly configured and certificate pinning is implemented
// at the network/backend level to prevent man-in-the-middle attacks.
// See: https://owasp.org/www-community/attacks/Manipulator-in-the-middle_attack

export const environment = {
  production: true,
  apiUrl: 'https://hotel-api-production-447d.up.railway.app',
  apiBaseUrl: 'https://hotel-api-production-447d.up.railway.app',
  customerPortalUrl: 'https://stayvora.co.in',
  paymentAppUrl: 'https://payflow-payment-app.vercel.app',
  paymentPortalUrl: 'https://payflow-payment-app.vercel.app',
  adminPortalUrl: 'https://admin.stayvora.co.in',
  partnerPortalUrl: 'https://partner.stayvora.co.in',
  microsoftClientId: '041f5aef-c9db-4eb8-9bb0-349a19fc3002',
  microsoftTenantId:'553e9dc0-268d-499d-b603-c817abd918f1',
  googleClientId: '227255495608-2quh3crqstjaq22g0r2pt5mqj120pdre.apps.googleusercontent.com',
  googleMapsApiKey: 'AIzaSyA2Bgbm2nroTHIaPS-0oKGdSmyEktwT1s',
  stripePublishableKey: 'pk_test_51TH0UuBDYx3dIveAYRnmWFuHY6EB8yZigeKqjltdRnQpc3iidRxSDV6rdmZrH8bcRt9fg3HIBCp32GRpMTnjSGcy00KPKiGzPL',
  stripeEnabled: false,
  maintenanceMode: false,
  maintenanceHosts: ['www.stayvora.co.in'],
  // Google Analytics 4 — set to your GA4 measurement ID (e.g. 'G-XXXXXXXXXX')
  gaMeasurementId: '',
};
