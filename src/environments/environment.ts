export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8000',
  apiBaseUrl: 'http://127.0.0.1:8000',
  customerPortalUrl: 'http://localhost:4200',
  paymentAppUrl: 'http://localhost:4201',
  paymentPortalUrl: 'http://localhost:4201',
  adminPortalUrl: 'http://localhost:4202',
  partnerPortalUrl: 'http://localhost:4203',
  microsoftClientId: '041f5aef-c9db-4eb8-9bb0-349a19fc3002',
  microsoftTenantId:'553e9dc0-268d-499d-b603-c817abd918f1',
  // Google OAuth client ID for Google Sign-In (different from Maps API key)
  // Get from: Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client ID
  googleClientId: '227255495608-2quh3crqstjaq22g0r2pt5mqj120pdre.apps.googleusercontent.com',
  googleMapsApiKey: 'AIzaSyA2Bgbm2nroTHIaPS-0oKGdSmyEktwT1s',
  stripePublishableKey: 'pk_test_51TH0UuBDYx3dIveAYRnmWFuHY6EB8yZigeKqjltdRnQpc3iidRxSDV6rdmZrH8bcRt9fg3HIBCp32GRpMTnjSGcy00KPKiGzPL',
  // Feature toggle: set false to disable Stripe globally (Razorpay/mock remain available)
  stripeEnabled: true,
  maintenanceMode: false,
  maintenanceHosts: [] as string[],
};
