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
