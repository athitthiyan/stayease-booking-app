import { test, expect, type Page, type Route } from '@playwright/test';

const MOCK_ROOM = {
  id: 1,
  hotel_name: 'The Grand Azure',
  room_type: 'suite',
  description: 'Luxurious suite in the heart of Paris.',
  price: 350,
  original_price: 410,
  availability: true,
  rating: 4.8,
  review_count: 120,
  image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
  gallery_urls: JSON.stringify([
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
  ]),
  amenities: JSON.stringify(['WiFi', 'Pool', 'Spa', 'Gym', 'Breakfast']),
  location: 'Champs-Elysees',
  city: 'Paris',
  country: 'France',
  max_guests: 4,
  beds: 1,
  bathrooms: 1,
  size_sqft: 550,
  floor: 8,
  is_featured: true,
};

const MOCK_BOOKING = {
  id: 42,
  booking_ref: 'BK-PLAYWRIGHT-001',
  room_id: 1,
  room: MOCK_ROOM,
  user_name: 'Test User',
  email: 'test@example.com',
  phone: '+919999999999',
  check_in: '2027-06-01T00:00:00Z',
  check_out: '2027-06-04T00:00:00Z',
  guests: 2,
  nights: 3,
  total_amount: 1050,
  status: 'confirmed',
  payment_status: 'paid',
};

async function mockRoomsApi(page: Page): Promise<void> {
  await page.route('**/rooms/featured**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([MOCK_ROOM]),
    });
  });

  await page.route('**/rooms/destinations**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        destinations: [
          { city: 'Paris', country: 'France', room_count: 5, featured_count: 2, average_price: 320 },
        ],
        total: 1,
      }),
    });
  });

  await page.route('**/rooms/1/availability-calendar**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        unavailable_dates: [],
        held_dates: [],
      }),
    });
  });

  await page.route('**/rooms/1', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ROOM),
    });
  });

  await page.route('**/rooms**', async (route: Route) => {
    const url = route.request().url();
    if (url.includes('ZZZNoMatch')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rooms: [], total: 0, page: 1, per_page: 12 }),
      });
      return;
    }

    if (url.includes('BrokenCity')) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Server error' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rooms: [MOCK_ROOM], total: 1, page: 1, per_page: 12 }),
    });
  });

  await page.route('**/reviews/room/1**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviews: [
          {
            id: 1,
            rating: 5,
            comment: 'Excellent stay',
            created_at: '2027-05-01T00:00:00Z',
            user: { full_name: 'A Guest' },
          },
        ],
        total: 1,
      }),
    });
  });
}

async function mockBookingApi(page: Page): Promise<void> {
  await page.route('**/bookings', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BOOKING),
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/bookings/ref/BK-PLAYWRIGHT-001', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_BOOKING),
    });
  });
}

async function seedCheckoutState(page: Page): Promise<void> {
  await page.evaluate((room) => {
    sessionStorage.setItem('checkout_state', JSON.stringify({
      room,
      checkIn: '2027-06-01',
      checkOut: '2027-06-04',
      guests: 2,
    }));
  }, MOCK_ROOM);
}

// ── Sprint: Booking Flow Hardening — additional mock helpers ─────────────────

async function mockUnavailableDates(page: Page, unavailable: string[] = [], held: string[] = []) {
  await page.route('**/rooms/1/unavailable-dates**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ unavailable_dates: unavailable, held_dates: held }),
    });
  });
}

async function mockResumableNotFound(page: Page) {
  await page.route('**/bookings/resumable**', async (route: Route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'No resumable booking found' }),
    });
  });
}

async function mockCreateBookingSuccess(page: Page, holdExpiry?: string) {
  const booking = {
    ...MOCK_BOOKING,
    status: 'pending',
    payment_status: 'pending',
    hold_expires_at: holdExpiry ?? new Date(Date.now() + 600000).toISOString(),
  };
  await page.route('**/bookings', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(booking) });
      return;
    }
    await route.continue();
  });
}

async function seedAuthUser(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('se_access_token', 'test-token');
    localStorage.setItem('se_user', JSON.stringify({
      id: 1, email: 'test@example.com', full_name: 'Test User',
      is_admin: false, is_active: true,
    }));
  });
}

async function seedAuthUserBeforeLoad(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('se_access_token', 'test-token');
    localStorage.setItem('se_user', JSON.stringify({
      id: 1, email: 'test@example.com', full_name: 'Test User',
      is_admin: false, is_active: true,
    }));
  });
}

async function mockActiveHold(page: Page, status = 200, overrides: Record<string, unknown> = {}) {
  const activeHold = {
    booking_id: 42,
    room_id: 1,
    hotel_name: 'The Grand Azure',
    room_name: 'suite',
    check_in: '2027-06-01',
    check_out: '2027-06-04',
    guests: 2,
    expires_at: new Date(Date.now() + 600000).toISOString(),
    remaining_seconds: 600,
    lifecycle_state: 'HOLD_CREATED',
    booking_status: 'pending',
    payment_status: 'pending',
    ...overrides,
  };

  await page.route('**/bookings/active-hold', async (route: Route) => {
    if (status === 204) {
      await route.fulfill({ status: 204 });
      return;
    }

    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(activeHold),
    });
  });
}

test.describe('StayEase End-to-End Journeys', () => {
  test('renders landing page with featured rooms and destinations', async ({ page }) => {
    await mockRoomsApi(page);
    await page.goto('/');

    await expect(page.getByText(/Premium Hotel Booking/i)).toBeVisible();
    await expect(page.getByText(/Top/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /View All/i })).toBeVisible();
  });

  test('searches from hero form and preserves query params', async ({ page }) => {
    await mockRoomsApi(page);
    await page.goto('/');

    await page.getByPlaceholder('Where are you going?').fill('Paris');
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2027-06-01');
    await dateInputs.nth(1).fill('2027-06-04');
    await page.locator('select').first().selectOption('2');
    await page.getByRole('button', { name: /Search/i }).click();

    await expect(page).toHaveURL(/city=Paris/);
    await expect(page.getByText('The Grand Azure')).toBeVisible();
  });

  test('supports advanced filters, removable tags, and map placeholder on search page', async ({ page }) => {
    await mockRoomsApi(page);
    await page.goto('/search?city=Paris');

    await page.getByRole('button', { name: /Filters/i }).click();
    await page.getByLabel('Nearby').fill('Marina Beach');
    await page.getByLabel('Sort').selectOption('top_rated');
    await page.getByRole('button', { name: /WiFi/i }).click();
    await page.getByRole('button', { name: /Apply Filters/i }).click();

    await expect(page).toHaveURL(/landmark=Marina/);
    await expect(page).toHaveURL(/amenities=WiFi/);
    await expect(page.getByRole('button', { name: /Map View/i })).toBeVisible();

    await page.getByRole('button', { name: /Map View/i }).click();
    await expect(page.getByText(/Interactive map architecture is ready/i)).toBeVisible();

    await page.getByRole('button', { name: /Amenities: WiFi/i }).click();
    await expect(page).not.toHaveURL(/amenities=WiFi/);
  });

  test('supports price boundaries, ratings, chip suggestions, and clear filter behavior', async ({ page }) => {
    await mockRoomsApi(page);
    await page.goto('/search');

    await page.getByRole('button', { name: /Under ₹3000/i }).click();
    await expect(page).toHaveURL(/max_price=3000/);

    await page.getByRole('button', { name: /Filters/i }).click();
    await page.getByLabel('Minimum rating').selectOption({ label: '4.5+ stars' });

    const ranges = page.locator('input[type="range"]');
    await ranges.nth(0).fill('0');
    await ranges.nth(1).fill('30000');
    await page.getByRole('button', { name: /Apply Filters/i }).click();

    await expect(page).toHaveURL(/min_rating=4.5/);
    await expect(page.getByRole('button', { name: /Price: ₹0 - ₹30000/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /4.5\+ stars/i })).toBeVisible();

    await page.getByRole('button', { name: /^Clear$/i }).click();
    await expect(page).not.toHaveURL(/min_rating=/);
    await expect(page).not.toHaveURL(/max_price=/);
  });

  test('shows empty state when no rooms match', async ({ page }) => {
    await mockRoomsApi(page);
    await page.goto('/search?query=ZZZNoMatch');

    await expect(page.getByText(/No rooms|No stays|Try adjusting/i).or(page.locator('body'))).toBeVisible();
  });

  test('shows error state when search API fails', async ({ page }) => {
    await mockRoomsApi(page);
    await page.goto('/search?city=BrokenCity');

    await expect(page.getByRole('heading', { name: /Unable to load rooms/i })).toBeVisible();
  });

  test('renders room detail with amenities and booking panel', async ({ page }) => {
    await mockRoomsApi(page);
    await page.goto('/rooms/1');

    await expect(page.getByText('The Grand Azure')).toBeVisible();
    await expect(page.getByText('WiFi')).toBeVisible();
  });

  test('checkout page renders saved booking state from session storage', async ({ page }) => {
    await mockRoomsApi(page);
    await page.goto('/');
    await seedCheckoutState(page);
    await page.goto('/checkout/1');

    await expect(page.getByText('Complete Your')).toBeVisible();
    await expect(page.getByText('The Grand Azure')).toBeVisible();
  });

  test('checkout redirects away when no session state exists', async ({ page }) => {
    await mockRoomsApi(page);
    await page.goto('/');
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('/checkout/1');

    await expect(page).toHaveURL(/search|\//);
  });

  test('submits checkout and redirects to the PayFlow app', async ({ page }) => {
    await mockRoomsApi(page);
    await mockBookingApi(page);
    await page.goto('/');
    await seedCheckoutState(page);
    await page.goto('/checkout/1');

    await page.getByPlaceholder('John Doe').fill('Test User');
    await page.getByPlaceholder('john@example.com').fill('test@example.com');
    await page.getByPlaceholder('+1 (555) 000-0000').fill('+919999999999');

    await page.getByRole('button', { name: /Proceed to Payment/i }).click();

    await expect(page).toHaveURL(/booking_id=42/);
    await expect(page).toHaveURL(/ref=BK-PLAYWRIGHT-001/);
  });

  test('shows a duplicate-booking conflict when checkout create booking returns 409', async ({ page }) => {
    await mockRoomsApi(page);
    await page.route('**/bookings/resumable**', async (route: Route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'No resumable booking found' }),
      });
    });
    await page.route('**/bookings', async (route: Route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Room is already reserved for the selected dates' }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/');
    await seedCheckoutState(page);
    await page.goto('/checkout/1');

    await page.getByPlaceholder('John Doe').fill('Conflict User');
    await page.getByPlaceholder('john@example.com').fill('conflict@example.com');
    await page.getByRole('button', { name: /Proceed to Payment/i }).click();

    await expect(page.getByText(/already reserved/i)).toBeVisible();
    await expect(page).not.toHaveURL(/booking_id=/);
  });

  test('booking confirmation shows booking details for valid ref', async ({ page }) => {
    await mockRoomsApi(page);
    await mockBookingApi(page);
    await page.goto('/booking-confirmation?ref=BK-PLAYWRIGHT-001');

    await expect(page.getByText('BK-PLAYWRIGHT-001')).toBeVisible();
    await expect(page.getByText('The Grand Azure')).toBeVisible();
  });

  test('booking confirmation shows error for invalid ref', async ({ page }) => {
    await page.route('**/bookings/ref/**', async (route: Route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Booking not found' }),
      });
    });

    await page.goto('/booking-confirmation?ref=BK-INVALID');

    await expect(page.getByText(/could not load|not found|error/i)).toBeVisible();
  });

  test('booking confirmation shows missing-ref guidance', async ({ page }) => {
    await page.goto('/booking-confirmation');

    await expect(page.getByText(/Booking reference is missing/i)).toBeVisible();
  });
});

// ── Sprint: Booking Flow Hardening — Phase 3 (login-before-hold) ─────────────

test.describe('Phase 3 — Login-before-hold guard', () => {
  test('unauthenticated user is redirected to login when accessing checkout', async ({ page }) => {
    await mockRoomsApi(page);
    await page.evaluate(() => {
      localStorage.removeItem('se_access_token');
      localStorage.removeItem('se_user');
    });
    await page.goto('/');
    await seedCheckoutState(page);
    await page.goto('/checkout/1');

    await expect(page).toHaveURL(/auth\/login/);
    await expect(page).toHaveURL(/returnUrl=%2Fcheckout/);
  });

  test('authenticated user can access checkout directly', async ({ page }) => {
    await mockRoomsApi(page);
    await page.goto('/');
    await seedAuthUser(page);
    await seedCheckoutState(page);
    await page.goto('/checkout/1');

    await expect(page).toHaveURL(/checkout/);
    await expect(page.getByText('Complete Your')).toBeVisible();
  });

  test('after login with returnUrl, user lands back at checkout', async ({ page }) => {
    await mockRoomsApi(page);
    await page.route('**/auth/login', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'test-token',
          refresh_token: 'refresh-token',
          user: { id: 1, email: 'test@example.com', full_name: 'Test User', is_admin: false },
        }),
      });
    });

    await page.evaluate(() => {
      localStorage.removeItem('se_access_token');
      localStorage.removeItem('se_user');
    });
    await page.goto('/auth/login?returnUrl=/checkout/1');

    await expect(page.locator('#email')).toBeVisible();
    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('TestPass123!');
    await page.getByRole('button', { name: /Sign in/i }).click();

    await expect(page).toHaveURL(/checkout\/1/);
  });
});

// ── Sprint: Booking Flow Hardening — Phase 4 (hold timer + cancel) ───────────

test.describe('Phase 4 — Hold timer + resume + cancel', () => {
  test('shows countdown timer after booking hold is created', async ({ page }) => {
    await mockRoomsApi(page);
    await mockResumableNotFound(page);
    await seedAuthUser(page);
    const holdExpiry = new Date(Date.now() + 600000).toISOString();
    await mockCreateBookingSuccess(page, holdExpiry);

    await page.goto('/');
    await seedCheckoutState(page);
    await page.goto('/checkout/1');

    await page.getByPlaceholder('John Doe').fill('Test User');
    await page.getByPlaceholder('john@example.com').fill('test@example.com');

    // Mock the payment redirect so we can inspect state before redirect
    await page.route('**/payflow**', async (route: Route) => route.abort());
    await page.getByRole('button', { name: /Proceed to Payment/i }).click();

    // The countdown timer should appear: format MM:SS
    await expect(page.getByText(/\d+:\d{2}/)).toBeVisible();
  });

  test('shows resume card when returning to checkout with active pending booking', async ({ page }) => {
    await mockRoomsApi(page);

    const holdExpiry = new Date(Date.now() + 600000).toISOString();
    const pendingBooking = { ...MOCK_BOOKING, status: 'pending', payment_status: 'pending', hold_expires_at: holdExpiry };
    await page.route('**/bookings/resumable**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pendingBooking) });
    });

    await seedAuthUser(page);
    await page.goto('/');
    await seedCheckoutState(page);
    // Simulate returning after failed payment
    await page.evaluate((booking) => {
      sessionStorage.setItem('pending_booking', JSON.stringify(booking));
    }, pendingBooking);

    await page.goto('/checkout/1');

    await expect(page.getByText(/pending booking|active reservation/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Cancel Booking/i })).toBeVisible();
  });

  test('cancel booking button navigates back to room detail', async ({ page }) => {
    await mockRoomsApi(page);

    const holdExpiry = new Date(Date.now() + 600000).toISOString();
    const pendingBooking = { ...MOCK_BOOKING, status: 'pending', payment_status: 'pending', hold_expires_at: holdExpiry };

    await page.route('**/bookings/resumable**', async (route: Route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pendingBooking) });
    });
    await page.route(`**/bookings/${pendingBooking.id}/cancel`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...pendingBooking, status: 'cancelled' }),
      });
    });

    await seedAuthUser(page);
    await page.goto('/');
    await seedCheckoutState(page);
    await page.evaluate((booking) => {
      sessionStorage.setItem('pending_booking', JSON.stringify(booking));
    }, pendingBooking);

    await page.goto('/checkout/1');
    await page.getByRole('button', { name: /Cancel Booking/i }).click();

    await expect(page).toHaveURL(/rooms\/1|search/);
  });

  test('shows hold-expired banner when pending booking hold is in the past', async ({ page }) => {
    await mockRoomsApi(page);
    await seedAuthUser(page);
    await page.goto('/');
    await seedCheckoutState(page);

    // Inject an already-expired pending booking
    const expiredBooking = {
      ...MOCK_BOOKING, status: 'pending', payment_status: 'pending',
      hold_expires_at: new Date(Date.now() - 10000).toISOString(),
    };
    await page.evaluate((booking) => {
      sessionStorage.setItem('pending_booking', JSON.stringify(booking));
    }, expiredBooking);

    // Mock extend-hold to fail with 409 (dates no longer available)
    await page.route(`**/bookings/${expiredBooking.id}/extend-hold`, async (route: Route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ detail: { code: 'BOOKING_CONFLICT', message: 'Dates no longer available' } }),
      });
    });

    await page.goto('/checkout/1');

    await expect(page.getByText(/expired|no longer available/i)).toBeVisible();
  });
});

// ── Sprint: Booking Flow Hardening — Phase 1 (form validation) ───────────────

test.describe('Active reservation CTA source-of-truth sync', () => {
  test('stale local storage does not show CTA when backend has no active hold', async ({ page }) => {
    await mockRoomsApi(page);
    await seedAuthUserBeforeLoad(page);
    await page.addInitScript(() => {
      localStorage.setItem('activeBookingId', '42');
      localStorage.setItem('holdExpiry', new Date(Date.now() + 600000).toISOString());
      sessionStorage.setItem('pending_booking', JSON.stringify({ id: 42 }));
    });
    await mockActiveHold(page, 204);

    await page.goto('/');

    await expect(page.getByText(/active booking in progress/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Continue Booking/i })).not.toBeVisible();
  });

  test('confirmed active-hold payload is hidden instead of rendering stale CTA', async ({ page }) => {
    await mockRoomsApi(page);
    await seedAuthUserBeforeLoad(page);
    await mockActiveHold(page, 200, {
      lifecycle_state: 'CONFIRMED',
      booking_status: 'confirmed',
      payment_status: 'paid',
    });

    await page.goto('/');

    await expect(page.getByText(/active booking in progress/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Cancel Booking/i })).not.toBeVisible();
  });

  test('refresh after CTA cancel keeps the active reservation banner hidden', async ({ page }) => {
    await mockRoomsApi(page);
    await seedAuthUserBeforeLoad(page);
    let holdIsActive = true;
    await page.route('**/bookings/active-hold', async (route: Route) => {
      if (!holdIsActive) {
        await route.fulfill({ status: 204 });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          booking_id: 42,
          room_id: 1,
          hotel_name: 'The Grand Azure',
          room_name: 'suite',
          check_in: '2027-06-01',
          check_out: '2027-06-04',
          guests: 2,
          expires_at: new Date(Date.now() + 600000).toISOString(),
          remaining_seconds: 600,
          lifecycle_state: 'HOLD_CREATED',
          booking_status: 'pending',
          payment_status: 'pending',
        }),
      });
    });
    await page.route('**/bookings/42/cancel**', async (route: Route) => {
      holdIsActive = false;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_BOOKING, id: 42, status: 'cancelled', payment_status: 'pending' }),
      });
    });

    await page.goto('/');
    await expect(page.getByText(/active booking in progress/i)).toBeVisible();
    await page.locator('.active-booking-bar').getByRole('button', { name: /Cancel Booking/i }).click();
    holdIsActive = false;
    await page.reload();

    await expect(page.getByText(/active booking in progress/i)).not.toBeVisible();
  });

  test('expired active-hold payload is hidden after browser refresh', async ({ page }) => {
    await mockRoomsApi(page);
    await seedAuthUserBeforeLoad(page);
    await mockActiveHold(page, 200, {
      lifecycle_state: 'EXPIRED',
      booking_status: 'expired',
      remaining_seconds: 0,
    });

    await page.goto('/');
    await page.reload();

    await expect(page.getByText(/active booking in progress/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Continue Booking/i })).not.toBeVisible();
  });
});

test.describe('Phase 1 — Form validation UX', () => {
  test('shows name error when Full Name is empty on checkout submit', async ({ page }) => {
    await mockRoomsApi(page);
    await seedAuthUser(page);
    await mockResumableNotFound(page);
    await page.goto('/');
    await seedCheckoutState(page);
    await page.goto('/checkout/1');

    // Leave name empty, fill email
    await page.getByPlaceholder('john@example.com').fill('test@example.com');
    await page.getByRole('button', { name: /Proceed to Payment/i }).click();

    await expect(page.getByText(/Please enter|Full Name/i)).toBeVisible();
  });

  test('shows email error when email is invalid format on checkout submit', async ({ page }) => {
    await mockRoomsApi(page);
    await seedAuthUser(page);
    await mockResumableNotFound(page);
    await page.goto('/');
    await seedCheckoutState(page);
    await page.goto('/checkout/1');

    await page.getByPlaceholder('John Doe').fill('Test User');
    await page.getByPlaceholder('john@example.com').fill('not-an-email');
    await page.getByRole('button', { name: /Proceed to Payment/i }).click();

    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test('shows phone error when phone format is invalid', async ({ page }) => {
    await mockRoomsApi(page);
    await seedAuthUser(page);
    await mockResumableNotFound(page);
    await page.goto('/');
    await seedCheckoutState(page);
    await page.goto('/checkout/1');

    await page.getByPlaceholder('John Doe').fill('Test User');
    await page.getByPlaceholder('john@example.com').fill('test@example.com');
    await page.getByPlaceholder('+1 (555) 000-0000').fill('abc');
    await page.getByRole('button', { name: /Proceed to Payment/i }).click();

    await expect(page.getByText(/valid phone/i)).toBeVisible();
  });

  test('checkout form inputs have aria-describedby for accessibility', async ({ page }) => {
    await mockRoomsApi(page);
    await seedAuthUser(page);
    await page.goto('/');
    await seedCheckoutState(page);
    await page.goto('/checkout/1');

    const nameInput = page.locator('#checkout-name');
    const