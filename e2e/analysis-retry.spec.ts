import { expect, test } from './fixtures';

test('analysis times out once, preserves the report, prevents duplicates, and retries', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/analyse', async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await new Promise((resolve) => setTimeout(resolve, 19_500));
      try {
        await route.fulfill({ status: 504, contentType: 'application/json', body: JSON.stringify({ error: 'Late test response' }) });
      } catch {
        // The frontend is expected to abort this first request at 18 seconds.
      }
      return;
    }

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
  await page.locator('.mobile-nav').getByRole('button', { name: 'Report', exact: true }).click();
  await page.getByRole('button', { name: 'Stalking', exact: true }).click();
  const description = 'A person followed me from the metro station for several blocks after 9 PM.';
  await page.locator('#description').fill(description);
  await page.locator('#location').fill('Park Street Metro Gate 2');

  await page.getByRole('button', { name: 'Analyse Report' }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect.poll(() => attempts).toBe(1);

  await expect(page.getByText('Analysis took too long. Please check your connection and try again.')).toBeVisible({ timeout: 22_000 });
  await expect(page.locator('#description')).toHaveValue(description);
  await expect(page.getByRole('button', { name: 'Retry Analysis' })).toBeVisible();

  await page.getByRole('button', { name: 'Retry Analysis' }).click();
  await expect(page.getByRole('heading', { name: 'Safety Analysis Complete' })).toBeVisible();
  expect(attempts).toBe(2);
});
