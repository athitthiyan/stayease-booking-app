import { routes } from './app.routes';

describe('routes', () => {
  it('defines all public and authenticated pages', () => {
    const paths = routes.map(route => route.path);

    expect(paths).toEqual([
      '',
      'search',
      'rooms/:id',
      'checkout/:id',
      'booking-confirmation',
      'privacy-policy',
      'terms-and-conditions',
      'cancellation-policy',
      'refund-policy',
      'support',
      'auth/login',
      'auth/signup',
      'auth/forgot-password',
      'auth/reset-password',
      'profile',
      'bookings',
      'wishlist',
      '404',
      '**',
    ]);
  });

  it('protects the appropriate routes and titles', () => {
    expect(routes.find(route => route.path === 'auth/login')?.canActivate?.length).toBe(1);
    expect(routes.find(route => route.path === 'auth/signup')?.canActivate?.length).toBe(1);
    expect(routes.find(route => route.path === 'auth/forgot-password')?.canActivate?.length).toBe(1);
    expect(routes.find(route => route.path === 'profile')?.canActivate?.length).toBe(1);
    expect(routes.find(route => route.path === 'bookings')?.canActivate?.length).toBe(1);
    expect(routes.find(route => route.path === 'wishlist')?.canActivate?.length).toBe(1);
    expect(routes.find(route => route.path === 'privacy-policy')?.title).toContain('Privacy Policy');
    expect(routes.find(route => route.path === 'refund-policy')?.title).toContain('Refund Policy');
    expect(routes.find(route => route.path === 'support')?.title).toContain('Support');
    expect(routes.find(route => route.path === '404')?.title).toContain('Page Not Found');
    expect(routes.find(route => route.path === '**')?.redirectTo).toBe('/404');
    expect(routes.find(route => route.path === '')?.title).toContain('Stayvora');
  });

  it('lazy-loads every route component', async () => {
    const loaded = await Promise.all(
      routes
        .filter(route => route.loadComponent)
        .map(route => route.loadComponent!())
    );

    expect(loaded).toHaveLength(18);
    expect(loaded.every(component => !!component)).toBe(true);
  });
});
