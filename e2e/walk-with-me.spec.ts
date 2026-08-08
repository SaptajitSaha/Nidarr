import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const WALK_SESSION_STORAGE_KEY = 'nidarr_walk_session_v1';
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

async function stubMapTiles(page: Page) {
  await page.route('https://*.tile.openstreetmap.org/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG });
  });
}

async function mockGeolocation(page: Page, mode: 'success' | 'denied') {
  await page.addInitScript((geolocationMode) => {
    const testState = { watchCalls: 0, clearCalls: 0, activeWatchers: [] as number[] };
    (window as typeof window & { __walkGeoState?: typeof testState }).__walkGeoState = testState;
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

    const deniedError = {
      code: 1,
      message: 'Permission denied for test',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError;

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (
          success: PositionCallback,
          error?: PositionErrorCallback | null
        ) => window.setTimeout(() => {
          if (geolocationMode === 'success') success(position);
          else error?.(deniedError);
        }, 0),
        watchPosition: (
          success: PositionCallback,
          error?: PositionErrorCallback | null
        ) => {
          const watcherId = nextWatcherId++;
          testState.watchCalls += 1;
          testState.activeWatchers.push(watcherId);
          window.setTimeout(() => {
            if (geolocationMode === 'success') success(position);
            else error?.(deniedError);
          }, 0);
          return watcherId;
        },
        clearWatch: (watcherId: number) => {
          testState.clearCalls += 1;
          testState.activeWatchers = testState.activeWatchers.filter((id) => id !== watcherId);
        },
      },
    });
  }, mode);
}

async function openWalkWithMe(page: Page) {
  await page.goto('/');
  await page.locator('.mobile-nav').getByRole('button', { name: 'Walk With Me', exact: true }).click();
}

async function startWalk(page: Page) {
  await expect(page.getByRole('heading', { name: 'Walk With Me' })).toBeVisible();
  await page.locator('#walk-destination').fill('Jadavpur 8B');
  await page.locator('#walk-contact-name').fill('Ananya');
  await page.locator('#walk-contact-phone').fill('9876543210');
  await page.getByRole('button', { name: 'Start Walk With Me' }).click();
  await expect(page.getByRole('heading', { name: 'Walk With Me Active' })).toBeVisible();
}

async function geolocationState(page: Page) {
  return page.evaluate(() => {
    const state = (window as typeof window & {
      __walkGeoState?: { watchCalls: number; clearCalls: number; activeWatchers: number[] };
    }).__walkGeoState;
    return state ?? { watchCalls: 0, clearCalls: 0, activeWatchers: [] };
  });
}

test.beforeEach(async ({ page }) => {
  await stubMapTiles(page);
});

test('starts, restores, demonstrates check-in, and completes safely with one watcher', async ({ page }) => {
  await mockGeolocation(page, 'success');
  await openWalkWithMe(page);
  await startWalk(page);

  await expect(page.getByText('******3210')).toBeVisible();
  await expect(page.getByText('9876543210')).toHaveCount(0);
  await expect(page.getByLabel('Time remaining')).toHaveText(/^\d{1,2}:\d{2}$/);
  await expect.poll(async () => (await geolocationState(page)).watchCalls).toBe(1);
  await expect.poll(async () => (await geolocationState(page)).activeWatchers.length).toBe(1);
  await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null')?.status, WALK_SESSION_STORAGE_KEY)).toBe('ACTIVE');

  await page.getByRole('button', { name: 'View Safety Map' }).click();
  await expect(page.getByText(/Walk With Me active · Safety signals around your journey/)).toBeVisible();
  await expect(page.locator('.leaflet-map')).toBeVisible();
  await expect.poll(() => page.locator('.leaflet-overlay-pane path[fill="#3B82F6"]').count()).toBeGreaterThan(0);
  await page.locator('.mobile-nav').getByRole('button', { name: 'Walk With Me', exact: true }).click();

  await page.reload();
  await expect.poll(async () => (await geolocationState(page)).watchCalls).toBe(1);
  await expect.poll(async () => (await geolocationState(page)).activeWatchers.length).toBe(1);
  await page.locator('.mobile-nav').getByRole('button', { name: 'Walk With Me', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Walk With Me Active' })).toBeVisible();

  await expect(page.getByText('Prototype demo control')).toBeVisible();
  await page.getByRole('button', { name: 'Trigger check-in' }).click();
  await expect(page.getByRole('heading', { name: 'Have you arrived safely?' })).toBeVisible();
  await page.getByRole('button', { name: "I'M SAFE" }).click();

  await expect(page.getByRole('heading', { name: 'Walk completed' })).toBeVisible();
  await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), WALK_SESSION_STORAGE_KEY)).toBeNull();
  await expect.poll(async () => (await geolocationState(page)).activeWatchers.length).toBe(0);
  await expect.poll(async () => (await geolocationState(page)).clearCalls).toBe(1);

  await page.getByRole('button', { name: 'Start another session' }).click();
  await expect(page.locator('#walk-destination')).toBeVisible();
});

test('restored timestamp in the past derives check-in-required state', async ({ page }) => {
  await mockGeolocation(page, 'success');
  await openWalkWithMe(page);
  await startWalk(page);

  await page.evaluate((key) => {
    const session = JSON.parse(localStorage.getItem(key) ?? 'null');
    session.startedAt = new Date(Date.now() - 60_000).toISOString();
    session.expectedArrivalAt = new Date(Date.now() - 1_000).toISOString();
    localStorage.setItem(key, JSON.stringify(session));
  }, WALK_SESSION_STORAGE_KEY);

  await page.reload();
  await page.locator('.mobile-nav').getByRole('button', { name: 'Walk With Me', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Have you arrived safely?' })).toBeVisible();
  await expect(page.getByText('No notification has been sent.')).toBeVisible();
});

test('geolocation denial permits limited mode and help requires confirmation', async ({ page }) => {
  await mockGeolocation(page, 'denied');
  await openWalkWithMe(page);
  await startWalk(page);

  await expect(page.getByText(/Location permission denied — continuing in limited\/demo mode/)).toBeVisible();
  await expect.poll(async () => (await geolocationState(page)).watchCalls).toBe(0);

  await page.getByRole('button', { name: 'Need Help', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Request prototype help?' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText('No message, phone call, notification, police alert, or emergency-service request will be sent.');
  await expect(page.locator('a[href^="tel:"], a[href^="sms:"], a[href*="whatsapp"], a[href*="wa.me"]')).toHaveCount(0);

  await confirmation.getByRole('button', { name: 'Confirm Need Help' }).click();
  await expect(page.getByRole('heading', { name: 'Help requested' })).toBeVisible();
  await expect(page.getByText('Prototype: your trusted contact would be alerted here.')).toBeVisible();
  await expect(page.getByText('No current location is available to share.')).toBeVisible();

  await page.getByRole('button', { name: 'End Session' }).click();
  await expect(page.getByRole('heading', { name: 'Session ended' })).toBeVisible();
  await expect(page.getByText('No contact or emergency service was notified.')).toBeVisible();
  await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), WALK_SESSION_STORAGE_KEY)).toBeNull();
});
