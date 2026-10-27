// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Onboarding Dashboard', () => {
  test('should display the dashboard heading', async ({ page }) => {
    await page.goto('/');

    // Verify the main heading is visible
    await expect(page.locator('h1')).toContainText('Onboarding Dashboard');
  });

  test('should show navigation tabs', async ({ page }) => {
    await page.goto('/');

    // Verify all navigation tabs are present
    await expect(page.locator('.tab')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Customer Info' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Data Mapping' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tenant Setup' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import' })).toBeVisible();
  });

  test('should display example customer in onboarding queue', async ({ page }) => {
    await page.goto('/');

    // Wait for data to load and verify example customer is shown
    await expect(page.locator('.customer-card').first()).toBeVisible();
    await expect(page.locator('.customer-card h3').first()).toContainText('Acme Corporation');
  });

  test('should show the Customer Info form instead of the placeholder', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Customer Info' }).click();

    await expect(page.locator('h2')).toContainText('Customer Info');
    await expect(page.getByLabel('Company name')).toBeVisible();
    await expect(page.getByLabel('Location')).toBeVisible();
    await expect(page.getByLabel('Segment')).toBeVisible();
    await expect(page.locator('.placeholder')).toHaveCount(0);
  });

  test('should name the missing fields when submitting an empty form', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Customer Info' }).click();
    await page.getByRole('button', { name: 'Add customer' }).click();

    await expect(page.getByText('Company name is required')).toBeVisible();
    await expect(page.getByText('Location is required')).toBeVisible();
    await expect(page.getByText('Segment is required')).toBeVisible();
  });

  test('should create a customer and show it on the dashboard, then edit it', async ({ page }) => {
    const name = `E2E Corp ${Date.now()}`;
    await page.goto('/');
    await page.getByRole('button', { name: 'Customer Info' }).click();
    await page.getByLabel('Company name').fill(`  ${name}  `);
    await page.getByLabel('Location').selectOption('EMEA');
    await page.getByLabel('Segment').selectOption('Retail');
    await page.getByRole('button', { name: 'Add customer' }).click();
    await expect(page.getByText('Customer saved')).toBeVisible();

    // Same form is now in edit mode for the saved customer
    await page.getByLabel('Location').selectOption('APAC');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Customer saved')).toBeVisible();

    await page.getByRole('button', { name: 'Dashboard' }).click();
    const card = page.locator('.customer-card', { hasText: name });
    await expect(card).toContainText('APAC');
    await expect(card).toContainText('Retail');
  });
});
