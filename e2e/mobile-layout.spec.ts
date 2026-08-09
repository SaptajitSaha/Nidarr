import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

async function prepareMobilePage(page: Page) {
  await page.route('https://*.tile.openstreetmap.org/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG });
  });
  await page.addInitScript(() => {
    const deniedError = {
      code: 1,
      message: 'Permission denied for responsive test',
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

async function isWithinViewport(locator: Locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.left >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight;
  });
}

const overlaps = (first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }) =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y;

test('mobile shell and critical map controls fit without horizontal overflow', async ({ page }) => {
  await prepareMobilePage(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const viewportWidth = await page.evaluate(() => window.innerWidth);
  const containerBox = await page.locator('.mobile-container').boundingBox();
  expect(containerBox).not.toBeNull();
  expect(Math.round(containerBox!.x)).toBe(0);
  expect(Math.round(containerBox!.width)).toBe(viewportWidth);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await page.locator('.app-body').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page.locator('.mobile-nav')).toBeVisible();
  expect(await isWithinViewport(page.locator('.mobile-nav'))).toBe(true);

  await page.getByRole('button', { name: /Check my surroundings/ }).click();
  let quickSafetyDialog = page.getByRole('dialog', { name: 'Around you' });
  await expect(quickSafetyDialog).toBeVisible();
  await expect(quickSafetyDialog).toContainText('Location is needed to check signals around you.');
  await expect.poll(() => isWithinViewport(quickSafetyDialog.locator('.quick-safety-sheet'))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(quickSafetyDialog).toHaveCount(0);

  const emergencyAction = page.getByRole('button', { name: /Emergency Toolkit/ });
  const homeActions = page.locator('.home-action-grid .home-action');
  await expect(homeActions).toHaveCount(5);
  for (let index = 0; index < await homeActions.count(); index += 1) {
    await homeActions.nth(index).scrollIntoViewIfNeeded();
    await expect(homeActions.nth(index)).toBeVisible();
    expect(await isWithinViewport(homeActions.nth(index))).toBe(true);
  }
  await emergencyAction.scrollIntoViewIfNeeded();
  await expect(emergencyAction).toBeVisible();
  expect(await isWithinViewport(emergencyAction)).toBe(true);
  await emergencyAction.click();
  let emergencyDialog = page.getByRole('dialog', { name: 'Emergency Toolkit' });
  await expect(emergencyDialog).toBeVisible();
  await expect(emergencyDialog.getByRole('button', { name: /Call 112/ })).toBeVisible();
  await expect.poll(() => isWithinViewport(emergencyDialog.locator('.emergency-toolkit-sheet'))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await emergencyDialog.getByRole('button', { name: 'Stop Emergency Mode' }).scrollIntoViewIfNeeded();
  await expect(emergencyDialog.getByRole('button', { name: 'Stop Emergency Mode' })).toBeVisible();
  await emergencyDialog.getByRole('button', { name: 'Close Emergency Toolkit' }).click();

  await page.locator('.mobile-nav').getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your Profile' })).toBeVisible();
  await expect(page.getByText('Location access denied', { exact: true })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Appearance' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeChecked();
  await expect(page.locator('label[for="appearance-light"]')).toBeVisible();
  await expect(page.locator('label[for="appearance-dark"]')).toBeVisible();
  await expect(page.locator('#profile-display-name')).toHaveAttribute('maxlength', '60');
  await expect(page.locator('#profile-contact-name')).toHaveAttribute('maxlength', '80');
  await expect(page.locator('#profile-contact-phone')).toHaveAttribute('maxlength', '30');
  await expect(page.locator('#profile-home-area')).toHaveAttribute('maxlength', '120');
  await page.locator('#profile-display-name').fill('A profile name that remains usable on narrow mobile layouts');
  await page.locator('#profile-contact-name').fill('A trusted contact with a deliberately long but valid display name');
  await page.locator('#profile-contact-phone').fill('+91 98765 43210 ext 123');
  await page.locator('#profile-home-area').fill('A plain-text home area description that wraps without becoming a map position');
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect(page.getByText('Profile saved on this device.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await page.locator('.app-body').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await page.locator('label[for="appearance-dark"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await page.locator('.app-body').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await page.locator('.mobile-nav').getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: /Check my surroundings/ }).click();
  quickSafetyDialog = page.getByRole('dialog', { name: 'Around you' });
  await expect(quickSafetyDialog).toBeVisible();
  await expect.poll(() => isWithinViewport(quickSafetyDialog.locator('.quick-safety-sheet'))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await quickSafetyDialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: /Emergency Toolkit/ }).click();
  emergencyDialog = page.getByRole('dialog', { name: 'Emergency Toolkit' });
  await expect(emergencyDialog).toBeVisible();
  await expect(emergencyDialog).toHaveCSS('background-color', /rgb/);
  await expect.poll(() => isWithinViewport(emergencyDialog.locator('.emergency-toolkit-sheet'))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await emergencyDialog.getByRole('button', { name: 'Close Emergency Toolkit' }).click();
  await page.locator('.mobile-nav').getByRole('button', { name: 'Profile', exact: true }).click();

  const resetButton = page.getByRole('button', { name: 'Reset Demo Data' });
  await resetButton.scrollIntoViewIfNeeded();
  await expect(resetButton).toBeVisible();
  expect(await isWithinViewport(resetButton)).toBe(true);
  await resetButton.click();
  const resetDialog = page.getByRole('dialog', { name: 'Reset demo data?' });
  await expect(resetDialog).toBeVisible();
  await expect.poll(() => isWithinViewport(resetDialog)).toBe(true);
  await resetDialog.getByRole('button', { name: 'Cancel' }).click();

  await page.locator('.mobile-nav').getByRole('button', { name: 'Safety Map', exact: true }).click();
  await expect(page.locator('.leaflet-map')).toBeVisible();
  await expect(page.locator('.geo-toast')).toBeVisible();
  await expect(page.locator('.map-legend')).toBeVisible();
  await expect(page.locator('.recenter-btn')).toBeVisible();
  await expect(page.locator('.report-btn')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  for (const control of ['.map-legend', '.nearby-count-stack', '.recenter-btn', '.report-btn']) {
    expect(await isWithinViewport(page.locator(control))).toBe(true);
    const statusBox = await page.locator('.geo-toast').boundingBox();
    const controlBox = await page.locator(control).boundingBox();
    expect(statusBox).not.toBeNull();
    expect(controlBox).not.toBeNull();
    expect(overlaps(statusBox!, controlBox!)).toBe(false);
  }
});
