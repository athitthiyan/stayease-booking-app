import { expect, test } from '@playwright/test';

const roomId = process.env.STAYVORA_SMOKE_ROOM_ID ?? '1';

test.describe('Stayvora production smoke', () => {
  test('homepage load', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Stayvora/i)).toBeVisible();
  });

  test('search route loads', async ({ page }) => {
    await page.goto('/search');
    await expect(page).toHaveURL(/search/);
  });

  test('room detail loads', async ({ page }) => {
    await page.goto(`/rooms/${roomId}`);
    await expect(page).toHaveURL(new RegExp(`/rooms/${roomId}`));
  });
});
