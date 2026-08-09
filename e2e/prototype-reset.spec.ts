import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const PENDING_REPORTS_STORAGE_KEY = 'nidarr_pending_reports_v1';
const WALK_SESSION_STORAGE_KEY = 'nidarr_walk_session_v1';
const USER_PROFILE_STORAGE_KEY = 'nidarr_user_profile_v1';
const UNRELATED_STORAGE_KEY = 'unrelated_app_preference';
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

async function mockGeolocation(page: Page) {
  await page.addInitScript(() => {
    const testState = { watchCalls: 0, clearCalls: 0, activeWatchers: [] as number[] };
    (window as typeof window & { __resetGeoState?: typeof testState }).__resetGeoState = testState;
    let nextWatcherId = 1;

    const position = {
      coords: {
        latitude: 22.5726,
        longitude: 88.3639,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    } as GeolocationPosition;

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => window.setTimeout(() => success(position), 0),
        watchPosition: (success: PositionCallback) => {
          const watcherId = nextWatcherId++;
          testState.watchCalls += 1;
          testState.activeWatchers.push(watcherId);
          window.setTimeout(() => success(position), 0);
          return watcherId;
        },
        clearWatch: (watcherId: number) => {
          testState.clearCalls += 1;
          testState.activeWatchers = testState.activeWatchers.filter((id) => id !== watcherId);
        },
      },
    });
  });
}

async function mockSafetyAnalysis(page: Page) {
  await page.route('**/api/analyse', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        category: 'Stalking',
        severity: 4,
        timeContext: 'after 9 PM',
        location: 'Park Street Metro Gate 2',
        summary: 'A person reportedly followed the user from the metro station.',
        isSafetyRelevant: true,
        requiresVerification: true,
      }),
    });
  });
}

async function geolocationState(page: Page) {
  return page.evaluate(() => {
    const state = (window as typeof window & {
      __resetGeoState?: { watchCalls: number; clearCalls: number; activeWatchers: number[] };
    }).__resetGeoState;
    return state ?? { watchCalls: 0, clearCalls: 0, activeWatchers: [] };
  });
}

async function markerCountByFill(page: Page, acceptedColors: Set<string>) {
  return page.locator('.leaflet-overlay-pane path.leaflet-interactive').evaluateAll(
    (markers, colors) => markers.filter((marker) => colors.includes((marker.getAttribute('fill') ?? '').toLowerCase())).length,
    [...acceptedColors]
  );
}

test.beforeEach(async ({ page }) => {
  await stubMapTiles(page);
  await mockGeolocation(page);
  await mockSafetyAnalysis(page);
});

test('reset confirmation preserves on cancel and clears only Nidarr prototype state on confirm', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => localStorage.setItem(key, 'keep-me'), UNRELATED_STORAGE_KEY);

  await page.locator('.mobile-nav').getByRole('button', { name: 'Walk With Me', exact: true }).click();
  await page.locator('#walk-destination').fill('Jadavpur 8B');
  await page.locator('#walk-contact-name').fill('Ananya');
  await page.getByRole('button', { name: 'Start Walk With Me' }).click();
  await expect(page.getByRole('heading', { name: 'Walk With Me Active' })).toBeVisible();
  await expect.poll(async () => (await geolocationState(page)).activeWatchers.length).toBe(1);

  await page.locator('.mobile-nav').getByRole('button', { name: 'Report', exact: true }).click();
  await page.getByRole('button', { name: 'Stalking', exact: true }).click();
  await page.locator('#description').fill('A person followed me from the metro station for several blocks after 9 PM.');
  await page.locator('#location').fill('Park Street Metro Gate 2');
  await page.getByRole('button', { name: 'Analyse Report' }).click();
  await expect(page.getByRole('heading', { name: 'Safety Analysis Complete' })).toBeVisible();
  await page.getByRole('button', { name: 'Add to Safety Map' }).click();
  await page.getByRole('button', { name: /Select on map/ }).click();

  const locationPicker = page.locator('.location-picker-map');
  const mapBounds = await locationPicker.boundingBox();
  expect(mapBounds).not.toBeNull();
  await page.mouse.click(mapBounds!.x + mapBounds!.width * 0.55, mapBounds!.y + mapBounds!.height * 0.45);
  await page.getByRole('button', { name: 'Confirm location' }).click();
  await expect(page.getByText('Report added as a pending community signal.')).toBeVisible();

  await page.locator('.mobile-nav').getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByText('Demo controls')).toBeVisible();
  await page.locator('#profile-display-name').fill('Saptajit');
  await page.locator('#profile-contact-name').fill('Ananya');
  await page.locator('#profile-contact-phone').fill('9876543210');
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), USER_PROFILE_STORAGE_KEY)).not.toBeNull();
  await page.getByRole('button', { name: 'Reset Demo Data' }).click();

  const dialog = page.getByRole('dialog', { name: 'Reset demo data?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Delete locally stored pending community reports');
  await expect(dialog).toContainText('End and remove the current Walk With Me session');
  await expect(dialog).toContainText('Delete the profile saved on this device');
  await expect(dialog).toContainText('Seeded demonstration safety signals and browser permission state will not be affected.');

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), PENDING_REPORTS_STORAGE_KEY)).not.toBeNull();
  await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), WALK_SESSION_STORAGE_KEY)).not.toBeNull();
  await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), USER_PROFILE_STORAGE_KEY)).not.toBeNull();
  await expect.poll(async () => (await geolocationState(page)).activeWatchers.length).toBe(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), UNRELATED_STORAGE_KEY)).toBe('keep-me');

  await page.getByRole('button', { name: 'Reset Demo Data' }).click();
  await page.getByRole('dialog', { name: 'Reset demo data?' })
    .getByRole('button', { name: 'Reset Demo Data' }).click();

  await expect(page.getByRole('heading', { name: 'Your safety tools, in one place.' })).toBeVisible();
  const successNotice = page.getByText('Demo data reset successfully.');
  await expect(successNotice).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.location-confirmation-overlay, .details-sheet, .map-save-success')).toHaveCount(0);
  await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), PENDING_REPORTS_STORAGE_KEY)).toBeNull();
  await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), WALK_SESSION_STORAGE_KEY)).toBeNull();
  await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), USER_PROFILE_STORAGE_KEY)).toBeNull();
  await expect.poll(async () => (await geolocationState(page)).activeWatchers.length).toBe(0);
  await expect.poll(async () => (await geolocationState(page)).clearCalls).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), UNRELATED_STORAGE_KEY)).toBe('keep-me');

  // The non-blocking success notice must not prevent immediate navigation.
  await page.getByRole('button', { name: /View Safety Map/ }).click();
  await expect(page.locator('.leaflet-map')).toBeVisible();
  await expect.poll(() => markerCountByFill(page, seededMarkerColors)).toBeGreaterThanOrEqual(7);
  await expect.poll(() => markerCountByFill(page, new Set(['#7e22ce']))).toBe(0);

  await page.locator('.mobile-nav').getByRole('button', { name: 'Home', exact: true }).click();
  await expect(successNotice).toBeHidden({ timeout: 5_000 });
  await page.reload();
  expect(await page.evaluate((key) => localStorage.getItem(key), UNRELATED_STORAGE_KEY)).toBe('keep-me');
  expect(await page.evaluate((key) => localStorage.getItem(key), PENDING_REPORTS_STORAGE_KEY)).toBeNull();
  expect(await page.evaluate((key) => localStorage.getItem(key), WALK_SESSION_STORAGE_KEY)).toBeNull();
  expect(await page.evaluate((key) => localStorage.getItem(key), USER_PROFILE_STORAGE_KEY)).toBeNull();
});
