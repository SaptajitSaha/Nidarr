import { expect, test as base } from '@playwright/test';

const isExpectedConsoleError = (message: string, sourceUrl: string) =>
  sourceUrl.includes('fonts.googleapis.com') ||
  sourceUrl.includes('fonts.gstatic.com') ||
  sourceUrl.includes('tile.openstreetmap.org') ||
  message.includes('tile.openstreetmap.org');

export const test = base.extend({
  page: async ({ page }, runTest) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !isExpectedConsoleError(message.text(), message.location().url)) {
        consoleErrors.push(message.text());
      }
    });

    await runTest(page);

    expect(pageErrors, 'Unexpected uncaught page errors').toEqual([]);
    expect(consoleErrors, 'Unexpected browser console errors').toEqual([]);
  },
});

export { expect };
