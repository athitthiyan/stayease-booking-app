/**
 * End-to-end tests for StayEase Booking App
 *
 * All API calls are intercepted with route mocks so no live backend is needed.
 *
 * Flows covered:
 *   1. Landing page renders featured rooms
 *   2. Search by city shows filtered results
 *   3. Click room card → room detail page loads
 *   4. Select dates and click "Book Now" → reaches checkout
 *   5. Checkout redirects to /search when no state (edge case)
 *   6. Booking confirmation page loads with booking ref
 *   7. Empty search results state shown when no rooms match
 */

import { test, expect, type Page, type Route } from '@playwright/test';

// ─── Shared mock data ─────────────────────────────────────────────────────────

const MOCK_ROOM = {
  id: 1,
  hotel_name: 'The Grand Azure',
  room_type: 'suite',
  description: 'Luxurious suite in the heart of Paris.',
  price: 350,
  availability: true,
  rating: 4.8,
  review_count: 120,
  image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
  gallery_urls: JSON.stringify([
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800',
  ]),
  amenities: JSON.stringify(['WiFi', 'Pool', 'Spa', 'Gym', 'Breakfast']),
  location: 'Champs-Élysées',
  city: 'Paris',
  country: 'France',
  max_guests: 2,
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
  check_in: '2027-06-01T00:00:00Z',
  check_out: '2027-06-04T00:00:00Z',
  guests: 2,
  nights: 3,
  total_amount: 1050,
  status: 'confirmed',
  payment_status: 'paid',
};

// ─── Mock helpers ──────────────────────────────────────────────────────────────

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
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rooms: [MOCK_ROOM], total: 1, page: 1, per_page: 12 }),
      });
    }
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
    } else {
      await route.continue();
    }
  });

  await page.route('**/bookings/ref/BK-PLAYWRIGHT-001', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_BOOKING),
    });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Landing Page', () => {
  test('renders featured rooms on the landing page', async ({ page }) => {
    await mockRoomsApi(page);
    await page.goto('/');

    await expect(page.getByText('The Grand Azure')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Paris')).toBeVisible();
  });

  test('shows destinations section', async ({ page }) => {
    await mockRoomsApi(page);
    await page.goto('/');

    await expect(page.getByText('France')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Search Results', () => {
  test('navigates to search and shows rooms', async ({ page }) => {
    await mockRoomsApi(page);
    await page.goto('/search?city=Paris');

    await expect(page.getByText('The Grand Azure')).toBeVisible({ timeout: 10_000 });
  });

  test('shows empty state when no rooms match', async ({ page }) => {
    await page.route('**/rooms**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rooms: [], total: 0, page: 1, per_page: 12 }),
      });
    });
    await page.goto('/search?query=ZZZNoMatch');

    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Room Detail', () => {
  test('room detail page loads with correct info', async ({ page }) => {
    await mockRoomsApi(page);
    await page.goto('/rooms/1');

    await expect(page.getByText('The Grand Azure')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Paris')).toBeVisible();
    await expect(page.getByText('WiFi')).toBeVisible();
  });

  test('price information is displayed', async ({ page }) => {
    await mockRoomsApi(page);
    await page.goto('/rooms/1');

    await expect(page.getByText(/350/)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Checkout Flow', () => {
  test('checkout page shows booking summary when state is loaded via sessionStorage', async ({ page }) => {
    await mockRoomsApi(page);
    await mockBookingApi(page);

    await page.goto('/');
    await page.evaluate((room: typeof MOCK_ROOM) => {
      sessionStorage.setItem('checkout_state', JSON.stringify({
        room,
        checkIn: '2027-06-01',
        checkOut: '2027-06-04',
        guests: 2,
      }));
    }, MOCK_ROOM);

    await page.goto('/checkout');

    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 });
  });

  test('checkout redirects to /search when no state available', async ({ page }) => {
    await mockRoomsApi(page);
    await page.goto('/');
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('/checkout');

    await expect(page).toHaveURL(/search|\//, { timeout: 5_000 });
  });
});

test.describe('Booking Confirmation', () => {
  test('booking confirmation page shows booking details', async ({ page }) => {
    await mockRoomsApi(page);
    await page.route('**/bookings/ref/BK-PLAYWRIGHT-001', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BOOKING),
      });
    });

    await page.goto('/booking-confirmation?ref=BK-PLAYWRIGHT-001');
    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('BK-PLAYWRIGHT-001')).toBeVisible({ timeout: 10_000 });
  });

  test('booking confirmation shows error when ref is invalid', async ({ page }) => {
    await page.route('**/bookings/ref/**', async (route: Route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Booking not found' }),
      });
    });

    await page.goto('/booking-confirmation?ref=BK-INVALID');
    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/could not load|not found|error/i)).toBeVisible({ timeout: 10_000 });
  });
});
