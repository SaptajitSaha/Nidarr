import type { Page } from '@playwright/test';
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

async function mockAppLocation(
  page: Page,
  mode: 'success' | 'denied',
  coordinates = { latitude: 22.5726, longitude: 88.3639 }
) {
  await page.addInitScript(({ locationMode, testCoordinates }) => {
    const state = { getCalls: 0 };
    (window as typeof window & { __homeGeoState?: typeof state }).__homeGeoState = state;
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
      message: 'Permission denied for Home test',
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
        watchPosition: (success: PositionCallback) => {
          if (locationMode === 'success') window.setTimeout(() => success(position), 0);
          return 1;
        },
        clearWatch: () => undefined,
      },
    });
  }, { locationMode: mode, testCoordinates: coordinates });
}

async function locationRequestCount(page: Page) {
  return page.evaluate(() =>
    (window as typeof window & { __homeGeoState?: { getCalls: number } }).__homeGeoState?.getCalls ?? 0
  );
}

test.beforeEach(async ({ page }) => {
  await stubMapTiles(page);
});

test('Home loads, keeps counts factual, reuses location, and routes quick actions', async ({ page }) => {
  await mockAppLocation(page, 'success');
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Your safety tools, in one place.' })).toBeVisible();
  await expect(page.locator('.home-signal-count--demo')).toContainText(/5.*demonstration safety signals nearby/);
  await expect(page.locator('.home-signal-count--pending')).toContainText(/0.*pending community reports nearby/);
  await expect(page.getByText('No active Walk With Me session')).toBeVisible();
  await expect.poll(() => locationRequestCount(page)).toBe(1);

  await page.getByRole('button', { name: /View Safety Map/ }).click();
  await expect(page.locator('.leaflet-map')).toBeVisible();
  await expect.poll(() => locationRequestCount(page)).toBe(1);

  await page.locator('.mobile-nav').getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: /Report an Incident/ }).click();
  await expect(page.getByRole('heading', { name: 'Report an Incident' })).toBeVisible();

  await page.locator('.mobile-nav').getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: /Start Walk With Me/ }).click();
  await expect(page.getByRole('heading', { name: 'Walk With Me' })).toBeVisible();
  await expect.poll(() => locationRequestCount(page)).toBe(1);
});

test('Home does not calculate nearby counts without location', async ({ page }) => {
  await mockAppLocation(page, 'denied');
  await page.goto('/');

  await expect(page.getByText('Enable location to see nearby safety signals.')).toBeVisible();
  await expect(page.locator('.home-signal-counts')).toHaveCount(0);
  await expect.poll(() => locationRequestCount(page)).toBe(1);

  await page.getByRole('button', { name: /View Safety Map/ }).click();
  await expect(page.locator('.leaflet-map')).toBeVisible();
  await page.locator('.mobile-nav').getByRole('button', { name: 'Home', exact: true }).click();
  await expect.poll(() => locationRequestCount(page)).toBe(1);
});

test('Safety Map centres once on a first location well away from Kolkata', async ({ page }) => {
  await mockAppLocation(page, 'success', { latitude: 28.6139, longitude: 77.2090 });
  await page.goto('/');
  await page.locator('.mobile-nav').getByRole('button', { name: 'Safety Map', exact: true }).click();

  const map = page.locator('.leaflet-map');
  const userMarker = page.locator('.leaflet-overlay-pane path[fill="#3B82F6"]').last();
  await expect(map).toBeVisible();
  await expect.poll(async () => {
    const mapBox = await map.boundingBox();
    const markerBox = await userMarker.boundingBox();
    if (!mapBox || !markerBox) return false;
    const markerCenterX = markerBox.x + markerBox.width / 2;
    const markerCenterY = markerBox.y + markerBox.height / 2;
    return markerCenterX >= mapBox.x && markerCenterX <= mapBox.x + mapBox.width &&
      markerCenterY >= mapBox.y && markerCenterY <= mapBox.y + mapBox.height;
  }).toBe(true);
});

test('Home resumes an active walk and opens a recent pending report on the map', async ({ page }) => {
  await mockAppLocation(page, 'success');
  await page.addInitScript(() => {
    const now = Date.now();
    localStorage.setItem('nidarr_walk_session_v1', JSON.stringify({
      id: 'walk-home-test',
      destination: 'Jadavpur 8B',
      startedAt: new Date(now - 5 * 60_000).toISOString(),
      expectedArrivalAt: new Date(now + 25 * 60_000).toISOString(),
      trustedContact: { name: 'Ananya', phone: '9876543210' },
      status: 'ACTIVE',
      startingCoordinates: { latitude: 22.5726, longitude: 88.3639, capturedAt: new Date(now).toISOString() },
      latestCoordinates: { latitude: 22.5726, longitude: 88.3639, capturedAt: new Date(now).toISOString() },
    }));
    localStorage.setItem('nidarr_pending_reports_v1', JSON.stringify([{
      id: 'pending-home-test',
      latitude: 22.5726,
      longitude: 88.3639,
      areaName: 'Park Street Metro Gate 2',
      category: 'Stalking',
      severity: 4,
      timeContext: 'after 9 PM',
      summary: 'A user-submitted prototype report.',
      sourceType: 'Community',
      verificationStatus: 'Pending',
      reportCount: 1,
      createdAt: new Date(now).toISOString(),
      originalLocationText: 'Park Street Metro Gate 2',
      isDemoData: false,
    }]));
  });

  await page.goto('/');
  await expect(page.locator('.home-signal-count--pending')).toContainText(/1.*pending community report nearby/);
  await expect(page.getByText('Pending verification')).toBeVisible();
  await expect(page.locator('.home-active-walk')).toContainText('Jadavpur 8B');

  await page.getByRole('button', { name: 'Resume Session' }).click();
  await expect(page.getByRole('heading', { name: 'Walk With Me Active' })).toBeVisible();

  await page.locator('.mobile-nav').getByRole('button', { name: 'Home', exact: true }).click();
  await page.locator('.home-report-item').getByRole('button', { name: 'View on Map' }).click();
  await expect(page.getByText('Pending community verification')).toBeVisible();
  await expect(page.locator('.leaflet-map')).toBeVisible();

  await page.getByRole('button', { name: 'Close pending report details' }).click();
  await page.locator('.mobile-nav').getByRole('button', { name: 'Home', exact: true }).click();
  await page.locator('.mobile-nav').getByRole('button', { name: 'Safety Map', exact: true }).click();
  await expect(page.getByText('Pending community verification')).toHaveCount(0);
});
