import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

const APPEARANCE_STORAGE_KEY = 'nidarr_appearance_v1';
const PENDING_REPORTS_STORAGE_KEY = 'nidarr_pending_reports_v1';
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

async function preparePage(page: Page) {
  await page.route('https://*.tile.openstreetmap.org/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG });
  });
  await page.addInitScript(() => {
    const deniedError = {
      code: 1,
      message: 'Permission denied for appearance test',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError;

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error?: PositionErrorCallback | null) =>
          window.setTimeout(() => error?.(deniedError), 0),
        watchPosition: () => 1,
        clearWatch: () => undefined,
      },
    });
  });
}

async function openProfile(page: Page) {
  await page.locator('.mobile-nav').getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your Profile' })).toBeVisible();
}

async function selectAppearance(page: Page, name: 'System' | 'Light' | 'Dark') {
  await page.locator(`label[for="appearance-${name.toLowerCase()}"]`).click();
  await expect(page.getByRole('radio', { name, exact: true })).toBeChecked();
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await page.locator('.app-body').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
}

async function expectDarkSurface(locator: Locator) {
  const background = await locator.evaluate((element) => getComputedStyle(element).backgroundColor);
  const channels = background.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
  expect(channels).toHaveLength(3);
  expect(Math.max(...channels)).toBeLessThan(80);
}

test.beforeEach(async ({ page }) => {
  await preparePage(page);
});

test('System is the default and follows operating-system appearance changes immediately', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate((key) => localStorage.getItem(key), APPEARANCE_STORAGE_KEY)).toBeNull();

  await openProfile(page);
  const group = page.getByRole('radiogroup', { name: 'Appearance' });
  await expect(group).toBeVisible();
  await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeChecked();
  await expect(page.getByText(/System selected.*Light currently active/)).toBeVisible();

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByText(/System selected.*Dark currently active/)).toBeVisible();

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('explicit Light and Dark choices persist and ignore later system changes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await openProfile(page);

  await selectAppearance(page, 'Dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate((key) => localStorage.getItem(key), APPEARANCE_STORAGE_KEY)).toBe('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await openProfile(page);
  await selectAppearance(page, 'Light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate((key) => localStorage.getItem(key), APPEARANCE_STORAGE_KEY)).toBe('light');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await openProfile(page);
  await expect(page.getByRole('radio', { name: 'Light', exact: true })).toBeChecked();
});

test('malformed appearance storage recovers to System without retaining bad data', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.evaluate((key) => localStorage.setItem(key, '{malformed'), APPEARANCE_STORAGE_KEY);
  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate((key) => localStorage.getItem(key), APPEARANCE_STORAGE_KEY)).toBeNull();
  await openProfile(page);
  await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeChecked();
});

test('appearance control is keyboard accessible and exposes the active state', async ({ page }) => {
  await page.goto('/');
  await openProfile(page);

  const systemRadio = page.getByRole('radio', { name: 'System', exact: true });
  await systemRadio.focus();
  await expect(systemRadio).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Light', exact: true })).toBeChecked();
  await expect(page.locator('#appearance-active-state')).toContainText('Light selected and active');
  expect(await page.evaluate((key) => localStorage.getItem(key), APPEARANCE_STORAGE_KEY)).toBe('light');
});

test('dark theme covers critical screens, map overlays, and both signal detail sheets', async ({ page }) => {
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
  await page.goto('/');
  await page.evaluate(({ appearanceKey, reportsKey }) => {
    localStorage.setItem(appearanceKey, 'dark');
    localStorage.setItem(reportsKey, JSON.stringify([{
      id: 'appearance-pending-report',
      latitude: 22.5726,
      longitude: 88.3639,
      areaName: 'Test map point',
      category: 'Harassment',
      severity: 3,
      timeContext: 'evening',
      summary: 'A user-submitted report for appearance coverage.',
      sourceType: 'Community',
      verificationStatus: 'Pending',
      reportCount: 1,
      createdAt: new Date().toISOString(),
      originalLocationText: 'Test map point',
      isDemoData: false,
    }]));
  }, { appearanceKey: APPEARANCE_STORAGE_KEY, reportsKey: PENDING_REPORTS_STORAGE_KEY });
  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: 'Your safety tools, in one place.' })).toBeVisible();
  await expectDarkSurface(page.locator('.home-action').first());
  await expectNoHorizontalOverflow(page);

  await page.locator('.mobile-nav').getByRole('button', { name: 'Report', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Report an Incident' })).toBeVisible();
  await expect(page.locator('#description')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analyse Report' })).toBeVisible();
  await page.getByRole('button', { name: 'Stalking', exact: true }).click();
  await page.locator('#description').fill('A person followed me from the station after 9 PM.');
  await page.locator('#location').fill('Park Street Metro Gate 2');
  await page.getByRole('button', { name: 'Analyse Report' }).click();
  await expect(page.getByRole('heading', { name: 'Safety Analysis Complete' })).toBeVisible();
  await expect(page.getByText('Requires community verification')).toBeVisible();
  await expectDarkSurface(page.locator('.analysis-card'));
  await page.getByRole('button', { name: 'Add to Safety Map' }).click();
  const locationDialog = page.getByRole('dialog', { name: 'Confirm incident location' });
  await expect(locationDialog).toBeVisible();
  await expect(locationDialog).toContainText('Gemini does not choose map coordinates');
  await expectDarkSurface(page.locator('.location-confirmation-sheet'));
  await locationDialog.getByRole('button', { name: 'Select on map' }).click();
  await expect(page.locator('.location-picker-map')).toBeVisible();
  await locationDialog.getByRole('button', { name: 'Cancel location confirmation' }).click();

  await page.locator('.mobile-nav').getByRole('button', { name: 'Walk With Me', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Walk With Me', exact: true })).toBeVisible();
  await expect(page.locator('#walk-destination')).toBeVisible();
  await expect(page.getByText(/Trusted-contact alerts and emergency integrations are simulated.*No real alert is sent/i)).toBeVisible();

  await openProfile(page);
  await expectDarkSurface(page.locator('.profile-card').first());
  await expect(page.getByRole('button', { name: 'Reset Demo Data' })).toBeVisible();

  await page.locator('.mobile-nav').getByRole('button', { name: 'Safety Map', exact: true }).click();
  await expect(page.locator('.map-legend')).toBeVisible();
  await expect(page.getByText('Demonstration and unverified community data')).toBeVisible();
  await expectDarkSurface(page.locator('.map-legend'));

  const seededMarker = page.locator('.leaflet-overlay-pane path[fill="#10B981"], .leaflet-overlay-pane path[fill="#10b981"]').first();
  await seededMarker.dispatchEvent('click');
  await expect(page.getByText(/Demonstration data.*not real safety information/)).toBeVisible();
  await expectDarkSurface(page.locator('.details-sheet'));
  await page.locator('.details-sheet').getByRole('button').first().click();

  const pendingMarker = page.locator('.leaflet-overlay-pane path[fill="#7E22CE"], .leaflet-overlay-pane path[fill="#7e22ce"]').first();
  await pendingMarker.dispatchEvent('click');
  const pendingSheet = page.getByRole('dialog', { name: 'Test map point' });
  await expect(pendingSheet).toBeVisible();
  await expect(pendingSheet).toContainText('Pending community verification');
  await expectDarkSurface(pendingSheet);
  await expectNoHorizontalOverflow(page);
});
