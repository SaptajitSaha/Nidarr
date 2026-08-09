import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const USER_PROFILE_STORAGE_KEY = 'nidarr_user_profile_v1';
const WALK_SESSION_STORAGE_KEY = 'nidarr_walk_session_v1';

async function mockGeolocation(page: Page) {
  await page.addInitScript(() => {
    const state = { getCalls: 0, watchCalls: 0 };
    (window as typeof window & { __profileGeoState?: typeof state }).__profileGeoState = state;

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
        getCurrentPosition: (success: PositionCallback) => {
          state.getCalls += 1;
          window.setTimeout(() => success(position), 0);
        },
        watchPosition: (success: PositionCallback) => {
          state.watchCalls += 1;
          window.setTimeout(() => success(position), 0);
          return 1;
        },
        clearWatch: () => undefined,
      },
    });
  });
}

async function locationRequestCount(page: Page) {
  return page.evaluate(() =>
    (window as typeof window & { __profileGeoState?: { getCalls: number } }).__profileGeoState?.getCalls ?? 0
  );
}

async function openProfile(page: Page) {
  await page.locator('.mobile-nav').getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your Profile' })).toBeVisible();
}

async function saveProfile(page: Page, profile: {
  displayName: string;
  trustedContactName: string;
  trustedContactPhone: string;
  homeArea: string;
}) {
  await page.locator('#profile-display-name').fill(profile.displayName);
  await page.locator('#profile-contact-name').fill(profile.trustedContactName);
  await page.locator('#profile-contact-phone').fill(profile.trustedContactPhone);
  await page.locator('#profile-home-area').fill(profile.homeArea);
  await page.getByRole('button', { name: 'Save Profile' }).click();
}

test.beforeEach(async ({ page }) => {
  await mockGeolocation(page);
});

test('creates, edits, persists, and personalises Home with short-lived save feedback', async ({ page }) => {
  await page.addInitScript(() => {
    Date.prototype.getHours = () => 9;
  });
  await page.goto('/');
  await openProfile(page);

  await expect(page.getByText('Location available', { exact: true })).toBeVisible();
  await expect.poll(() => locationRequestCount(page)).toBe(1);
  await saveProfile(page, {
    displayName: '  Saptajit  ',
    trustedContactName: '  Ananya  ',
    trustedContactPhone: '  +91 98765 43210  ',
    homeArea: '  South Kolkata  ',
  });

  await expect(page.getByText('Profile saved on this device.')).toBeVisible();
  await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), USER_PROFILE_STORAGE_KEY)).toEqual({
    displayName: 'Saptajit',
    trustedContactName: 'Ananya',
    trustedContactPhone: '+91 98765 43210',
    homeArea: 'South Kolkata',
  });
  await expect(page.getByText('Profile saved on this device.')).toBeHidden({ timeout: 5_000 });

  await page.locator('.mobile-nav').getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Good morning, Saptajit' })).toBeVisible();
  await expect(page.getByText('+91 98765 43210')).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Good morning, Saptajit' })).toBeVisible();
  await openProfile(page);
  await expect(page.locator('#profile-display-name')).toHaveValue('Saptajit');
  await expect(page.locator('#profile-contact-name')).toHaveValue('Ananya');
  await expect(page.locator('#profile-contact-phone')).toHaveValue('+91 98765 43210');
  await expect(page.locator('#profile-home-area')).toHaveValue('South Kolkata');

  await page.locator('#profile-display-name').fill('Mira');
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await page.locator('.mobile-nav').getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Good morning, Mira' })).toBeVisible();
});

test('recovers from malformed and schema-invalid stored profiles', async ({ page }) => {
  await page.goto('/');

  await page.evaluate((key) => localStorage.setItem(key, '{malformed'), USER_PROFILE_STORAGE_KEY);
  await page.reload();
  await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), USER_PROFILE_STORAGE_KEY)).toBeNull();
  await openProfile(page);
  await expect(page.locator('#profile-display-name')).toHaveValue('');

  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({
    displayName: 'A'.repeat(61),
    trustedContactName: 'Ananya',
    trustedContactPhone: '1234',
    homeArea: 'Kolkata',
    unexpected: true,
  })), USER_PROFILE_STORAGE_KEY);
  await page.reload();
  await expect.poll(async () => page.evaluate((key) => localStorage.getItem(key), USER_PROFILE_STORAGE_KEY)).toBeNull();
  await expect(page.getByRole('heading', { name: 'Your safety tools, in one place.' })).toBeVisible();
});

test('autofills a fresh Walk setup while keeping journey edits out of the saved profile', async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      displayName: 'Saptajit',
      trustedContactName: 'Ananya',
      trustedContactPhone: '+91 98765 43210',
      homeArea: 'South Kolkata',
    }));
  }, USER_PROFILE_STORAGE_KEY);
  await page.goto('/');
  await page.locator('.mobile-nav').getByRole('button', { name: 'Walk With Me', exact: true }).click();

  await expect(page.locator('#walk-contact-name')).toHaveValue('Ananya');
  await expect(page.locator('#walk-contact-phone')).toHaveValue('+91 98765 43210');
  await page.locator('#walk-contact-name').fill('Journey contact');
  await page.locator('#walk-contact-phone').fill('555 000 2468');
  await page.locator('#walk-destination').fill('Jadavpur 8B');

  // An unrelated App rerender must not replace an in-progress setup draft.
  await expect.poll(() => locationRequestCount(page)).toBe(1);
  await expect(page.locator('#walk-contact-name')).toHaveValue('Journey contact');
  await expect(page.locator('#walk-contact-phone')).toHaveValue('555 000 2468');
  await page.getByRole('button', { name: 'Start Walk With Me' }).click();

  await expect(page.getByRole('heading', { name: 'Walk With Me Active' })).toBeVisible();
  await expect(page.getByText('Journey contact')).toBeVisible();
  await expect(page.getByText('******2468')).toBeVisible();
  await expect(page.getByText('555 000 2468')).toHaveCount(0);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), USER_PROFILE_STORAGE_KEY)).toEqual({
    displayName: 'Saptajit',
    trustedContactName: 'Ananya',
    trustedContactPhone: '+91 98765 43210',
    homeArea: 'South Kolkata',
  });

  await page.getByRole('button', { name: 'End Session' }).click();
  await page.getByRole('button', { name: 'Start another session' }).click();
  await expect(page.locator('#walk-contact-name')).toHaveValue('Ananya');
  await expect(page.locator('#walk-contact-phone')).toHaveValue('+91 98765 43210');
});

test('changing Profile does not mutate an active or restored Walk session', async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      displayName: 'Saptajit',
      trustedContactName: 'Ananya',
      trustedContactPhone: '9876543210',
      homeArea: '',
    }));
  }, USER_PROFILE_STORAGE_KEY);
  await page.goto('/');
  await page.locator('.mobile-nav').getByRole('button', { name: 'Walk With Me', exact: true }).click();
  await page.locator('#walk-destination').fill('Park Street');
  await page.getByRole('button', { name: 'Start Walk With Me' }).click();
  await expect(page.getByRole('heading', { name: 'Walk With Me Active' })).toBeVisible();

  await openProfile(page);
  await page.locator('#profile-contact-name').fill('Mira');
  await page.locator('#profile-contact-phone').fill('111122223333');
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await page.locator('.mobile-nav').getByRole('button', { name: 'Walk With Me', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Walk With Me Active' })).toBeVisible();
  await expect(page.getByText('Ananya')).toBeVisible();
  await expect(page.getByText('******3210')).toBeVisible();
  await expect(page.getByText('9876543210')).toHaveCount(0);
  await expect(page.getByText('111122223333')).toHaveCount(0);
  await expect.poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null')?.trustedContact, WALK_SESSION_STORAGE_KEY)).toEqual({
    name: 'Ananya',
    phone: '9876543210',
  });

  await page.reload();
  await page.locator('.mobile-nav').getByRole('button', { name: 'Walk With Me', exact: true }).click();
  await expect(page.getByText('Ananya')).toBeVisible();
  await expect(page.getByText('******3210')).toBeVisible();
});

test('storage failure keeps the form draft and does not update in-memory personalisation', async ({ page }) => {
  await page.goto('/');
  await openProfile(page);
  await page.locator('#profile-display-name').fill('Unsaved name');
  await page.locator('#profile-contact-name').fill('Unsaved contact');

  await page.evaluate((profileKey) => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === profileKey) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    };
  }, USER_PROFILE_STORAGE_KEY);
  await page.getByRole('button', { name: 'Save Profile' }).click();

  await expect(page.getByRole('alert')).toContainText('Local storage is unavailable. Your profile was not saved.');
  await expect(page.locator('#profile-display-name')).toHaveValue('Unsaved name');
  await expect(page.locator('#profile-contact-name')).toHaveValue('Unsaved contact');
  expect(await page.evaluate((key) => localStorage.getItem(key), USER_PROFILE_STORAGE_KEY)).toBeNull();

  await page.locator('.mobile-nav').getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your safety tools, in one place.' })).toBeVisible();
});
