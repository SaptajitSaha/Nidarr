import type { Page } from '@playwright/test';
import { buildTelephoneHref } from '../src/utils/telephoneHandoff';
import { expect, test } from './fixtures';

const PROFILE_STORAGE_KEY = 'nidarr_user_profile_v1';
const WALK_STORAGE_KEY = 'nidarr_walk_session_v1';
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

type GeoMode = 'success' | 'denied' | 'timeout';
type ShareMode = 'native' | 'cancel' | 'unavailable';

interface EmergencyTestState {
  watchCalls: number;
  clearCalls: number;
  activeWatchers: number[];
  audioStarts: number;
  audioStops: number;
  audioCloses: number;
  shareCalls: number;
  clipboardWrites: number;
}

async function stubMapTiles(page: Page) {
  await page.route('https://*.tile.openstreetmap.org/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG });
  });
}

async function mockEmergencyApis(
  page: Page,
  options: { geo?: GeoMode; share?: ShareMode; clipboardFails?: boolean } = {}
) {
  const geoMode = options.geo ?? 'success';
  const shareMode = options.share ?? 'unavailable';
  const clipboardFails = options.clipboardFails ?? false;

  await page.addInitScript(({ selectedGeoMode, selectedShareMode, shouldClipboardFail }) => {
    const state: EmergencyTestState = {
      watchCalls: 0,
      clearCalls: 0,
      activeWatchers: [],
      audioStarts: 0,
      audioStops: 0,
      audioCloses: 0,
      shareCalls: 0,
      clipboardWrites: 0,
    };
    const testWindow = window as typeof window & { __emergencyTestState?: EmergencyTestState };
    testWindow.__emergencyTestState = state;
    let nextWatcherId = 1;

    const position = {
      coords: {
        latitude: 22.5726,
        longitude: 88.3639,
        accuracy: 14,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    } as GeolocationPosition;

    const locationError = {
      code: selectedGeoMode === 'denied' ? 1 : 3,
      message: 'Mock location error',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError;

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback, error?: PositionErrorCallback | null) =>
          window.setTimeout(() => selectedGeoMode === 'success' ? success(position) : error?.(locationError), 0),
        watchPosition: (success: PositionCallback, error?: PositionErrorCallback | null) => {
          const watcherId = nextWatcherId++;
          state.watchCalls += 1;
          state.activeWatchers.push(watcherId);
          window.setTimeout(() => selectedGeoMode === 'success' ? success(position) : error?.(locationError), 0);
          return watcherId;
        },
        clearWatch: (watcherId: number) => {
          state.clearCalls += 1;
          state.activeWatchers = state.activeWatchers.filter((id) => id !== watcherId);
        },
      },
    });

    class MockAudioContext {
      state: AudioContextState = 'running';
      currentTime = 0;
      destination = {} as AudioDestinationNode;

      createOscillator() {
        return {
          type: 'sine',
          frequency: {
            setValueAtTime: () => undefined,
            setTargetAtTime: () => undefined,
          },
          connect: () => undefined,
          disconnect: () => undefined,
          start: () => { state.audioStarts += 1; },
          stop: () => { state.audioStops += 1; },
        } as unknown as OscillatorNode;
      }

      createGain() {
        return {
          gain: { setValueAtTime: () => undefined },
          connect: () => undefined,
          disconnect: () => undefined,
        } as unknown as GainNode;
      }

      resume() { return Promise.resolve(); }
      close() {
        this.state = 'closed';
        state.audioCloses += 1;
        return Promise.resolve();
      }
    }

    Object.defineProperty(window, 'AudioContext', { configurable: true, value: MockAudioContext });

    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: selectedShareMode === 'unavailable'
        ? undefined
        : async () => {
            state.shareCalls += 1;
            if (selectedShareMode === 'cancel') throw new DOMException('Cancelled', 'AbortError');
          },
    });

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          state.clipboardWrites += 1;
          if (shouldClipboardFail) throw new Error('Mock clipboard failure');
        },
      },
    });
  }, { selectedGeoMode: geoMode, selectedShareMode: shareMode, shouldClipboardFail: clipboardFails });
}

async function seedTrustedContact(page: Page) {
  await page.addInitScript(({ key }) => {
    localStorage.setItem(key, JSON.stringify({
      displayName: '',
      trustedContactName: 'Ananya',
      trustedContactPhone: '+91 98765 43210',
      homeArea: '',
    }));
  }, { key: PROFILE_STORAGE_KEY });
}

async function openToolkit(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Emergency Toolkit/ }).click();
  const toolkit = page.getByRole('dialog', { name: 'Emergency Toolkit' });
  await expect(toolkit).toBeVisible();
  return toolkit;
}

async function emergencyState(page: Page) {
  return page.evaluate(() => (window as typeof window & { __emergencyTestState?: EmergencyTestState }).__emergencyTestState!);
}

test.beforeEach(async ({ page }) => {
  await stubMapTiles(page);
});

test('opens from Home and keeps call handoffs confirmation-only and privacy-safe', async ({ page }) => {
  await seedTrustedContact(page);
  await mockEmergencyApis(page);
  const toolkit = await openToolkit(page);

  await expect(toolkit).toContainText('Nidarr does not automatically call, message or contact emergency services.');
  await expect(toolkit.getByText('******3210')).toBeVisible();
  await expect(toolkit.getByText('+91 98765 43210')).toHaveCount(0);

  await toolkit.getByRole('button', { name: /Call 112/ }).click();
  let confirmation = page.getByRole('dialog', { name: 'Open emergency dialer?' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText('will not place the call automatically');
  await expect(confirmation.getByRole('button', { name: 'Close confirmation' })).toBeFocused();
  await expect(confirmation.getByRole('button', { name: 'Open dialer with 112' })).not.toBeFocused();
  expect(buildTelephoneHref('112')).toBe('tel:112');
  await confirmation.getByRole('button', { name: 'Cancel' }).click();

  await toolkit.getByRole('button', { name: /Call trusted contact/ }).click();
  confirmation = page.getByRole('dialog', { name: 'Open trusted-contact dialer?' });
  await expect(confirmation).toContainText('******3210');
  await expect(confirmation).not.toContainText('+91 98765 43210');
  expect(buildTelephoneHref('+91 98765 43210')).toBe('tel:+919876543210');
  await confirmation.getByRole('button', { name: 'Cancel' }).click();

  await page.keyboard.press('Escape');
  await expect(toolkit).toHaveCount(0);
  await page.locator('.mobile-nav').getByRole('button', { name: 'Profile', exact: true }).click();
  await page.locator('#profile-contact-phone').fill('');
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await page.locator('.mobile-nav').getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: /Emergency Toolkit/ }).click();
  await expect(page.getByRole('button', { name: /Call trusted contact/ })).toBeDisabled();
  await expect(page.getByText('Add a trusted contact in Profile')).toBeVisible();
});

test('requires siren confirmation, recreates audio, and stops it while location persists on map navigation', async ({ page }) => {
  await mockEmergencyApis(page);
  const toolkit = await openToolkit(page);

  await toolkit.getByRole('button', { name: /Start emergency siren/ }).click();
  const sirenConfirmation = page.getByRole('dialog', { name: 'Start emergency siren?' });
  await expect(sirenConfirmation).toContainText('conservative level');
  expect((await emergencyState(page)).audioStarts).toBe(0);
  await sirenConfirmation.getByRole('button', { name: 'Start emergency siren' }).click();
  await expect(toolkit.getByText('Emergency siren active')).toBeVisible();
  expect((await emergencyState(page)).audioStarts).toBe(1);

  await toolkit.getByRole('button', { name: 'Stop Siren' }).click();
  await expect.poll(async () => (await emergencyState(page)).audioStops).toBe(1);
  await expect.poll(async () => (await emergencyState(page)).audioCloses).toBe(1);

  await toolkit.getByRole('button', { name: /Start emergency siren/ }).click();
  await page.getByRole('dialog', { name: 'Start emergency siren?' })
    .getByRole('button', { name: 'Start emergency siren' }).click();
  await expect.poll(async () => (await emergencyState(page)).audioStarts).toBe(2);
  await toolkit.getByRole('button', { name: 'Close Emergency Toolkit' }).click();
  await expect.poll(async () => (await emergencyState(page)).audioStops).toBe(2);
  await page.getByRole('button', { name: /Emergency Toolkit/ }).click();
  const reopenedToolkit = page.getByRole('dialog', { name: 'Emergency Toolkit' });
  await reopenedToolkit.getByRole('button', { name: /Start emergency siren/ }).click();
  await page.getByRole('dialog', { name: 'Start emergency siren?' })
    .getByRole('button', { name: 'Start emergency siren' }).click();
  await expect.poll(async () => (await emergencyState(page)).audioStarts).toBe(3);

  await reopenedToolkit.getByRole('button', { name: /Start foreground location/ }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(reopenedToolkit.getByText('Foreground location tracking active')).toBeVisible();
  await expect.poll(async () => (await emergencyState(page)).watchCalls).toBe(1);

  await reopenedToolkit.getByRole('button', { name: 'View current position on Safety Map' }).click();
  await expect(page.locator('.leaflet-map')).toBeVisible();
  await expect(page.getByRole('button', { name: /Emergency location active/ })).toBeVisible();
  await expect.poll(async () => (await emergencyState(page)).audioStops).toBe(3);
  expect((await emergencyState(page)).activeWatchers).toHaveLength(1);
  await expect.poll(() => page.locator('.leaflet-overlay-pane path[fill="#3B82F6"]').count()).toBeGreaterThan(0);

  await page.getByRole('button', { name: /Emergency location active/ }).click();
  await page.getByRole('dialog', { name: 'Emergency Toolkit' })
    .getByRole('button', { name: 'Stop foreground location' }).click();
  await expect.poll(async () => (await emergencyState(page)).activeWatchers.length).toBe(0);
});

test('shares a latest snapshot, treats native cancellation neutrally, and retains a selectable fallback', async ({ page }) => {
  await mockEmergencyApis(page, { share: 'cancel' });
  let toolkit = await openToolkit(page);
  await toolkit.getByRole('button', { name: /Start foreground location/ }).click();
  await expect(toolkit.getByText('Foreground location tracking active')).toBeVisible();
  await expect(toolkit.getByText('This shares the latest location snapshot. It is not a continuously updating link and does not share foreground location tracking.')).toBeVisible();
  await toolkit.getByRole('button', { name: 'Share latest location' }).click();
  await expect.poll(async () => (await emergencyState(page)).shareCalls).toBe(1);
  await expect(toolkit.locator('.emergency-error')).toHaveCount(0);
  await page.evaluate(() => {
    const testWindow = window as typeof window & { __emergencyTestState?: EmergencyTestState };
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => { testWindow.__emergencyTestState!.shareCalls += 1; },
    });
  });
  await toolkit.getByRole('button', { name: 'Share latest location' }).click();
  await expect(toolkit.getByText('Location snapshot shared.')).toBeVisible();

  await page.reload();
  await mockEmergencyApis(page, { share: 'unavailable' });
  toolkit = await openToolkit(page);
  await toolkit.getByRole('button', { name: /Start foreground location/ }).click();
  await expect(toolkit.getByText('Foreground location tracking active')).toBeVisible();
  await toolkit.getByRole('button', { name: 'Copy location link' }).click();
  await expect(toolkit.getByText('Location snapshot copied.')).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { throw new Error('Mock clipboard failure'); } },
    });
  });
  await toolkit.getByRole('button', { name: 'Copy location link' }).click();
  await expect(toolkit.getByText('Automatic copying was unavailable. Select and copy the location link below.')).toBeVisible();
  const fallback = toolkit.getByLabel('Select and copy this location link');
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveValue(/openstreetmap\.org/);
});

test('handles location denial and opens from Walk With Me Help requested without changing its disclosure', async ({ page }) => {
  await mockEmergencyApis(page, { geo: 'denied' });
  await page.addInitScript(({ key }) => {
    const startedAt = new Date(Date.now() - 60_000).toISOString();
    localStorage.setItem(key, JSON.stringify({
      id: 'help-session',
      destination: 'Jadavpur 8B',
      startedAt,
      expectedArrivalAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      trustedContact: { name: 'Ananya' },
      status: 'HELP_REQUESTED',
    }));
  }, { key: WALK_STORAGE_KEY });
  await page.goto('/');
  await page.locator('.mobile-nav').getByRole('button', { name: 'Walk With Me', exact: true }).click();
  await expect(page.getByText('Simulated status only — no trusted-contact alert was sent.')).toBeVisible();
  await page.getByRole('button', { name: 'Open Emergency Toolkit' }).click();
  const toolkit = page.getByRole('dialog', { name: 'Emergency Toolkit' });
  await toolkit.getByRole('button', { name: /Start foreground location/ }).click();
  await expect(toolkit.getByText('Location access denied')).toBeVisible();
  await expect(toolkit.getByText('Location access was denied. Foreground location tracking did not start.')).toBeVisible();
  await expect.poll(async () => (await emergencyState(page)).activeWatchers.length).toBe(0);
});

test('Stop Emergency Mode and Reset Demo Data clean up emergency resources without persisting emergency state', async ({ page }) => {
  await mockEmergencyApis(page);
  let toolkit = await openToolkit(page);
  await toolkit.getByRole('button', { name: /Start foreground location/ }).click();
  await expect(toolkit.getByText('Foreground location tracking active')).toBeVisible();
  await toolkit.getByRole('button', { name: /Start emergency siren/ }).click();
  await page.getByRole('dialog', { name: 'Start emergency siren?' })
    .getByRole('button', { name: 'Start emergency siren' }).click();
  await toolkit.getByRole('button', { name: 'Stop Emergency Mode' }).click();
  await expect(toolkit).toHaveCount(0);
  await expect.poll(async () => (await emergencyState(page)).activeWatchers.length).toBe(0);
  await expect.poll(async () => (await emergencyState(page)).audioStops).toBe(1);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes('emergency')))).toEqual([]);

  await page.getByRole('button', { name: /Emergency Toolkit/ }).click();
  toolkit = page.getByRole('dialog', { name: 'Emergency Toolkit' });
  await toolkit.getByRole('button', { name: /Start foreground location/ }).click();
  await expect(toolkit.getByText('Foreground location tracking active')).toBeVisible();
  await toolkit.getByRole('button', { name: 'Close Emergency Toolkit' }).click();
  await page.locator('.mobile-nav').getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Reset Demo Data' }).click();
  await page.getByRole('dialog', { name: 'Reset demo data?' })
    .getByRole('button', { name: 'Reset Demo Data' }).click();
  await expect.poll(async () => (await emergencyState(page)).activeWatchers.length).toBe(0);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes('emergency')))).toEqual([]);
});
