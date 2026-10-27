// @ts-check
const { test, expect } = require('@playwright/test');

// All tests share the single seeded customer and the in-memory server state
test.describe.configure({ mode: 'serial' });

test.describe('Tenant Setup', () => {
  test.beforeEach(async ({ page, request }) => {
    const reset = await request.post('/api/test/reset');
    expect(
      reset.ok(),
      'Reset hook unavailable: start the server with ENABLE_TEST_HOOKS=true (or stop the running dev server)'
    ).toBeTruthy();
    await page.goto('/');
    await page.getByRole('button', { name: 'Tenant Setup' }).click();
  });

  test('provisions a failing plan, shows the reason, and retries to active', async ({ page }) => {
    const status = page.getByTestId('tenant-status');
    await expect(status).toContainText('pending');

    await page.getByLabel('Plan').selectOption('enterprise');
    await page.getByRole('button', { name: 'Provision' }).click();
    await expect(status).toContainText('provisioning');
    await expect(page.getByRole('button', { name: 'Provisioning...' })).toBeDisabled();

    await expect(status).toContainText('failed');
    await expect(page.locator('.tenant-failure')).toContainText('Provisioning failed:');
    await expect(page.getByLabel('Plan')).toBeDisabled();

    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(status).toContainText('provisioning');
    await expect(status).toContainText('active');
    await expect(page.getByLabel('Plan')).toBeDisabled();
    await expect(page.getByLabel('Plan')).toHaveValue('enterprise');
    await expect(page.getByRole('button', { name: 'Provision' })).toHaveCount(0);

    // Dashboard reflects the tenant and the completed step
    await page.getByRole('button', { name: 'Dashboard' }).click();
    await expect(page.getByTestId('tenant-summary')).toContainText('active (enterprise)');
    await expect(page.locator('.checklist li', { hasText: 'Tenant Setup' })).toContainText('completed');
    await expect(page.locator('.progress-bar')).toContainText('25%');
  });

  test('provisions a non-failing plan straight to active', async ({ page }) => {
    await page.getByLabel('Plan').selectOption('starter');
    await page.getByRole('button', { name: 'Provision' }).click();

    await expect(page.getByTestId('tenant-status')).toContainText('active');
    await expect(page.locator('.tenant-failure')).toHaveCount(0);
  });

  test('shows the true status after reloading mid-provisioning', async ({ page }) => {
    await page.getByLabel('Plan').selectOption('starter');
    await page.getByRole('button', { name: 'Provision' }).click();
    await expect(page.getByTestId('tenant-status')).toContainText('provisioning');

    await page.reload();
    await page.getByRole('button', { name: 'Tenant Setup' }).click();
    await expect(page.getByTestId('tenant-status')).toContainText('provisioning');
    await expect(page.getByLabel('Plan')).toHaveValue('starter');
    await expect(page.getByTestId('tenant-status')).toContainText('active');
  });

  test('keeps the selected plan and shows an error when starting fails', async ({ page }) => {
    await page.route('**/api/tenants/*/provision', route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server unavailable' }) })
    );

    await page.getByLabel('Plan').selectOption('enterprise');
    await page.getByRole('button', { name: 'Provision' }).click();

    await expect(page.locator('.form-error')).toContainText('Server unavailable');
    await expect(page.getByLabel('Plan')).toHaveValue('enterprise');
    await expect(page.getByTestId('tenant-status')).toContainText('pending');
    await expect(page.getByRole('button', { name: 'Provision' })).toBeEnabled();
  });
});
