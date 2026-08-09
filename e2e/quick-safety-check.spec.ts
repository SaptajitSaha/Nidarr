import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

async function stubMapTiles(page: Page) {
  await page.route('https://*.tile.openstreetmap.org/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG });
  });
}

async function mockLocation(
  page: Page,
  mode: 'success' | 'denied',
  coordinates = { latitude: 22.5726, longitude: 88.3639 }
) {
  await page.addInitScript(({ locationMode, testCoordinates }) => {
    const state = { getCalls: 0 };
    (window as typeof window & { __quickSafetyGeoState?: typeof state }).__quickSafetyGeoState = state;
    const position = {
      coords: {
        latitude: testCoordinates.latitude,
        longitude: testCoordinates.longitude,
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
    const deniedError = {
      code: 1,
      message: 'Permission denied for quick safety check test',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError;

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback, error?: PositionErrorCallback | null) => {
          state.getCalls += 1;
          window.setTimeout(() => {
            if (locationMode === 'success') success(position);
            else error?.(deniedError);
          }, 0);
        },
        watchPosition: () => 1,
        clearWatch: () => undefined,
      },
    });
  }, { locationMode: mode, testCoordinates: coordinates });
}

async function seedPendingReport(
  page: Page,
  coordinates: { latitude: number; longitude: number },
  severity: number
) {
  await page.addInitScript(({ testCoordinates, testSeverity }) => {
    localStorage.setItem('nidarr_pending_reports_v1', JSON.stringify([{
      id: 'quick-safety-pending',
      latitude: testCoordinates.latitude,
      longitude: testCoordinates.longitude,
      areaName: 'Quick safety test point',
      category: 'Harassment',
      severity: testSeverity,
      timeContext: 'evening',
      summary: 'A user-submitted report for the quick safety check test.',
      sourceType: 'Community',
      verificationStatus: 'Pending',
      reportCount: 1,
      createdAt: new Date().toISOString(),
      originalLocationText: 'Quick safety test point',
      isDemoData: false,
    }]));
  }, { testCoordinates: coordinates, testSeverity: severity });
}

async function openQuickSafetyCheck(page: Page) {
  await page.getByRole('button', { name: /Check my surroundings/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Around you' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function locationRequestCount(page: Page) {
  return page.evaluate(() =>
    (window as typeof window & { __quickSafetyGeoState?: { getCalls: number } })
      .__quickSafetyGeoState?.getCalls ?? 0
  );
}

async function surfaceChannels(locator: Locator) {
  const background = await locator.evaluate((element) => getComputedStyle(element).backgroundColor);
  return background.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
}

test.beforeEach(async ({ page }) => {
  await stubMapTiles(page);
});

test('summarizes nearby demonstration and pending signals and opens the Safety Map', async ({ page }) => {
  await mockLocation(page, 'success');
  await seedPendingReport(page, { latitude: 22.5726, longitude: 88.3639 }, 1);
  await page.goto('/');

  const trigger = page.getByRole('button', { name: /Check my surroundings/ });
  await expect(trigger).toContainText('Get a quick overview of safety signals near your current location.');
  const dialog = await openQuickSafetyCheck(page);

  await expect(dialog.getByText('Location available', { exact: true })).toBeVisible();
  await expect(dialog.locator('.quick-safety-metric--total')).toContainText(/Total nearby signals.*6/);
  await expect(dialog.locator('.quick-safety-metric--demonstration')).toContainText(/Demonstration signals.*5/);
  await expect(dialog.locator('.quick-safety-metric--pending')).toContainText(/Pending community reports.*1.*Unverified/);
  await expect(dialog.locator('.quick-safety-highest-signal')).toContainText(/Highest nearby demonstration signal.*High/);
  await expect(dialog).toContainText('Based only on seeded demonstration data');
  await expect(dialog).toContainText('Safety signals provide context and do not determine whether an area is safe or unsafe.');
  await expect(dialog).not.toContainText('Highest nearby risk');
  await expect.poll(() => locationRequestCount(page)).toBe(1);

  await dialog.getByRole('button', { name: 'View Safety Map' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.leaflet-map')).toBeVisible();
  await expect.poll(() => locationRequestCount(page)).toBe(1);
});

test('pending report severity is excluded from the highest demonstration signal', async ({ page }) => {
  const saltLake = { latitude: 22.5726, longitude: 88.4316 };
  await mockLocation(page, 'success', saltLake);
  await seedPendingReport(page, saltLake, 5);
  await page.goto('/');

  const dialog = await openQuickSafetyCheck(page);
  await expect(dialog.locator('.quick-safety-metric--total')).toContainText(/2/);
  await expect(dialog.locator('.quick-safety-metric--demonstration')).toContainText(/1/);
  await expect(dialog.locator('.quick-safety-metric--pending')).toContainText(/1/);
  await expect(dialog.locator('.quick-safety-highest-signal')).toContainText(/Highest nearby demonstration signal.*Low/);
  await expect(dialog.locator('.quick-safety-highest-signal .risk-level-badge')).toHaveText('Low');
});

test('shows an honest zero-signal state without inventing a demonstration level', async ({ page }) => {
  await mockLocation(page, 'success', { latitude: 28.6139, longitude: 77.2090 });
  await page.goto('/');

  const dialog = await openQuickSafetyCheck(page);
  await expect(dialog.locator('.quick-safety-metric--total')).toContainText(/0/);
  await expect(dialog.locator('.quick-safety-metric--demonstration')).toContainText(/0/);
  await expect(dialog.locator('.quick-safety-metric--pending')).toContainText(/0/);
  await expect(dialog.locator('.quick-safety-highest-signal')).toContainText(/Highest nearby demonstration signal.*Not available/);
  await expect(dialog.getByText('No nearby safety signals are currently available.', { exact: true })).toBeVisible();
});

test('denied location does not calculate from Kolkata or request location again', async ({ page }) => {
  await mockLocation(page, 'denied');
  await page.addInitScript(() => {
    const now = Date.now();
    localStorage.setItem('nidarr_walk_session_v1', JSON.stringify({
      id: 'quick-safety-active-walk',
      destination: 'Jadavpur 8B',
      startedAt: new Date(now - 5 * 60_000).toISOString(),
      expectedArrivalAt: new Date(now + 25 * 60_000).toISOString(),
      trustedContact: { name: 'Ananya', phone: '' },
      status: 'ACTIVE',
      startingCoordinates: { latitude: 22.5726, longitude: 88.3639, capturedAt: new Date(now).toISOString() },
      latestCoordinates: { latitude: 22.5726, longitude: 88.3639, capturedAt: new Date(now).toISOString() },
    }));
  });
  await page.goto('/');
  await expect.poll(() => locationRequestCount(page)).toBe(1);
  await expect(page.locator('.home-signal-count--demo')).toContainText(/5.*demonstration safety signals nearby/);
  await expect(page.getByRole('button', { name: /Resume Walk With Me/ })).toBeVisible();

  const trigger = page.getByRole('button', { name: /Check my surroundings/ });
  const dialog = await openQuickSafetyCheck(page);
  await expect(dialog.getByText('Location access denied', { exact: true })).toBeVisible();
  await expect(dialog).toContainText('Location is needed to check signals around you.');
  await expect(dialog).toContainText('No nearby counts have been calculated.');
  await expect(dialog.locator('.quick-safety-metrics')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /Retry location/i })).toHaveCount(0);
  await expect.poll(() => locationRequestCount(page)).toBe(1);

  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  const reopenedDialog = await openQuickSafetyCheck(page);
  await expect(reopenedDialog.getByRole('button', { name: 'Close quick safety check' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(reopenedDialog).toHaveCount(0);
  await expect.poll(() => locationRequestCount(page)).toBe(1);
});

test('sheet remains visible and readable in explicit light and dark themes', async ({ page }) => {
  await mockLocation(page, 'success');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');

  let dialog = await openQuickSafetyCheck(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  let channels = await surfaceChannels(dialog.locator('.quick-safety-sheet'));
  expect(channels).toHaveLength(3);
  expect(Math.min(...channels)).toBeGreaterThan(230);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();

  await page.evaluate(() => localStorage.setItem('nidarr_appearance_v1', 'dark'));
  await page.reload();
  dialog = await openQuickSafetyCheck(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  channels = await surfaceChannels(dialog.locator('.quick-safety-sheet'));
  expect(channels).toHaveLength(3);
  expect(Math.max(...channels)).toBeLessThan(80);
  await expect(dialog.getByRole('button', { name: 'View Safety Map' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
});
