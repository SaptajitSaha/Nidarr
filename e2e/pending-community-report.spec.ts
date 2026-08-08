import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const PENDING_REPORTS_STORAGE_KEY = 'nidarr_pending_reports_v1';
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

const seededMarkerColors = new Set(['#10b981', '#f59e0b', '#f97316', '#ef4444']);

async function stubMapTiles(page: Page) {
  await page.route('https://*.tile.openstreetmap.org/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG });
  });
}

async function mockAnalysis(page: Page, isSafetyRelevant: boolean) {
  await page.route('**/api/analyse', async (route) => {
    const requestBody = route.request().postDataJSON() as { description?: string };
    const isStalking = requestBody.description?.toLowerCase().includes('followed') ?? false;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        category: isStalking ? 'Stalking' : 'Other',
        severity: isStalking ? 4 : 1,
        timeContext: isStalking ? 'after 9 PM' : 'this afternoon',
        location: isStalking ? 'Park Street Metro Gate 2' : 'Unknown',
        summary: isStalking
          ? 'A person reportedly followed the user from the metro station.'
          : 'The user reported eating biryani at home.',
        isSafetyRelevant,
        requiresVerification: isSafetyRelevant,
      }),
    });
  });
}

async function navigateToReport(page: Page) {
  await page.goto('/');
  await page.locator('.mobile-nav').getByRole('button', { name: 'Report', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Report an Incident' })).toBeVisible();
}

async function submitReport(
  page: Page,
  options: { category: 'Stalking' | 'Other'; description: string; location?: string }
) {
  await page.getByRole('button', { name: options.category, exact: true }).click();
  await page.locator('#description').fill(options.description);
  if (options.location) await page.locator('#location').fill(options.location);
  await page.getByRole('button', { name: 'Analyse Report' }).click();
  await expect(page.getByRole('heading', { name: 'Safety Analysis Complete' })).toBeVisible();
}

async function markerCountByFill(page: Page, acceptedColors: Set<string>) {
  return page.locator('.leaflet-overlay-pane path.leaflet-interactive').evaluateAll(
    (markers, colors) => markers.filter((marker) => colors.includes((marker.getAttribute('fill') ?? '').toLowerCase())).length,
    [...acceptedColors]
  );
}

test.beforeEach(async ({ page }) => {
  await stubMapTiles(page);
});

test('adds a pending stalking report and persists it after reload', async ({ page }) => {
  await mockAnalysis(page, true);
  await navigateToReport(page);
  await submitReport(page, {
    category: 'Stalking',
    description: 'A person followed me from the metro station for several blocks after 9 PM.',
    location: 'Park Street Metro Gate 2',
  });

  const addToMapButton = page.getByRole('button', { name: 'Add to Safety Map' });
  await expect(addToMapButton).toBeVisible();
  await addToMapButton.click();

  await page.getByRole('button', { name: /Select on map/ }).click();
  const locationPicker = page.locator('.location-picker-map');
  await expect(locationPicker).toBeVisible();
  const mapBounds = await locationPicker.boundingBox();
  expect(mapBounds).not.toBeNull();
  await page.mouse.click(mapBounds!.x + mapBounds!.width * 0.55, mapBounds!.y + mapBounds!.height * 0.45);

  await expect(page.getByText(/^Selected:/)).toBeVisible();
  const confirmButton = page.getByRole('button', { name: 'Confirm location' });
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect(page.getByText('Report added as a pending community signal.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Added to Safety Map' })).toBeDisabled();
  await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]').length, PENDING_REPORTS_STORAGE_KEY)).toBe(1);

  await page.getByRole('button', { name: 'View on Safety Map' }).click();
  await expect(page.getByText('Pending community verification')).toBeVisible();
  await expect(page.locator('.nearby-count-chip--pending')).toContainText('1');
  await expect.poll(() => markerCountByFill(page, new Set(['#7e22ce']))).toBeGreaterThan(0);
  await expect.poll(() => markerCountByFill(page, seededMarkerColors)).toBeGreaterThanOrEqual(7);

  await page.reload();
  await page.locator('.mobile-nav').getByRole('button', { name: 'Safety Map', exact: true }).click();
  await expect(page.locator('.leaflet-map')).toBeVisible();
  await expect(page.locator('.nearby-count-chip--pending')).toContainText('1');
  await expect.poll(() => markerCountByFill(page, new Set(['#7e22ce']))).toBeGreaterThan(0);
  await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]').length, PENDING_REPORTS_STORAGE_KEY)).toBe(1);
});

test('does not offer map submission for an irrelevant biryani report', async ({ page }) => {
  await mockAnalysis(page, false);
  await navigateToReport(page);
  await submitReport(page, {
    category: 'Other',
    description: 'I ate biryani at home this afternoon and enjoyed it.',
  });

  await expect(page.getByRole('button', { name: 'Add to Safety Map' })).toHaveCount(0);
});

test('geolocation denial keeps map selection available and does not crash', async ({ page, context }) => {
  await context.clearPermissions();
  await mockAnalysis(page, true);
  await navigateToReport(page);
  await submitReport(page, {
    category: 'Stalking',
    description: 'A person followed me near the station after 9 PM.',
    location: 'Near the station',
  });

  await page.getByRole('button', { name: 'Add to Safety Map' }).click();
  await page.getByRole('button', { name: /Use my current location/ }).click();
  await expect(page.locator('.location-error')).toContainText(/denied|could not be determined|unavailable/i);
  await expect(page.getByRole('button', { name: /Select on map/ })).toBeEnabled();
  await page.getByRole('button', { name: /Select on map/ }).click();
  await expect(page.locator('.location-picker-map')).toBeVisible();
});

test('location picker reports OSM tile failure without blocking cancellation', async ({ page }) => {
  await page.unroute('https://*.tile.openstreetmap.org/**');
  await page.route('https://*.tile.openstreetmap.org/**', async (route) => {
    await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Tile unavailable for test' });
  });
  await mockAnalysis(page, true);
  await navigateToReport(page);
  await submitReport(page, {
    category: 'Stalking',
    description: 'A person followed me near the station after 9 PM.',
    location: 'Near the station',
  });

  await page.getByRole('button', { name: 'Add to Safety Map' }).click();
  await page.getByRole('button', { name: /Select on map/ }).click();
  await expect(page.getByText('Map background could not load. You can go back or cancel and try again when connected.')).toBeVisible();

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Confirm incident location' })).toHaveCount(0);
});

test('seeded demo markers still render', async ({ page }) => {
  await page.goto('/');
  await page.locator('.mobile-nav').getByRole('button', { name: 'Safety Map', exact: true }).click();
  await expect(page.locator('.leaflet-map')).toBeVisible();
  await expect.poll(() => markerCountByFill(page, seededMarkerColors)).toBeGreaterThanOrEqual(7);
});
