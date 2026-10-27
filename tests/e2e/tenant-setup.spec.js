// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Tenant Setup', () => {
  let name;

  // Each test provisions its own uniquely named customer, so tests don't share tenant state
  test.beforeEach(async ({ page, request }, testInfo) => {
    name = `Tenant E2E ${testInfo.testId}-${Date.now()}`;
    const created = await request.post('/api/customers', {
      data: { name, region: 'EMEA', industry: 'Retail' }
    });
    expect(created.ok()).toBeTruthy();

    await page.goto('/');
    await page.getByRole('button', { name: 'Tenant Setup' }).click();
    await page.getByLabel('Customer').selectOption({ label: name });
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
    const card = page.locator('.customer-card', { hasText: name });
    await expect(card.getByTestId('tenant-summary')).toContainText('active (enterprise)');
    await expect(card.locator('.checklist li', { hasText: 'Tenant Setup' })).toContainText('completed');
    await expect(card.locator('.progress-bar')).toContainText('25%');
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
    await page.getByLabel('Customer').selectOption({ label: name });
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
