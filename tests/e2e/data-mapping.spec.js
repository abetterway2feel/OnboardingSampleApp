// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

const sampleFile = (dir) => path.join(__dirname, '../../sample-data', dir, 'clients.csv');

test.describe('Data Mapping tab', () => {
  test.skip(true, 'red-test-AC-1..AC-9');

  test('suggests Customer B columns, flags a shared column and saves, completing the step (AC-1, AC-2, AC-3, AC-6)', async ({ page }) => {
    const name = `Mapping Corp ${Date.now()}`;
    await page.goto('/');
    await page.getByRole('button', { name: 'Customer Info' }).click();
    await page.getByLabel('Company name').fill(name);
    await page.getByLabel('Location').selectOption('EMEA');
    await page.getByLabel('Segment').selectOption('Retail');
    await page.getByRole('button', { name: 'Add customer' }).click();
    await expect(page.getByText('Customer saved')).toBeVisible();

    await page.getByRole('button', { name: 'Data Mapping' }).click();
    await expect(page.locator('.placeholder')).toHaveCount(0);
    await page.getByLabel('Customer', { exact: true }).selectOption({ label: name });
    await page.getByLabel('Sample clients file').setInputFiles(sampleFile('CustomerB_XYZFinancialServices'));

    await expect(page.getByLabel('Client Name')).toHaveValue('companyName');
    await expect(page.getByLabel('Status')).toHaveValue('clientStatus');

    // Picking a column already used by another field moves it, so no column maps twice
    await page.getByLabel('Industry').selectOption('federalTaxId');
    await expect(page.getByLabel('Tax ID')).toHaveValue('');
    await page.getByLabel('Industry').selectOption('sectorCode');
    await page.getByLabel('Tax ID').selectOption('federalTaxId');

    await page.getByRole('button', { name: 'Save mapping' }).click();
    await expect(page.getByText('Mapping saved')).toBeVisible();

    await page.getByRole('button', { name: 'Dashboard' }).click();
    await expect(page.locator('.customer-card', { hasText: name })).toContainText('25%');
  });

  test('blocks saving without Client Name and rejects non-CSV files (AC-2, AC-8)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Data Mapping' }).click();
    await page.getByLabel('Customer', { exact: true }).selectOption({ label: 'Acme Corporation' });
    await page.getByLabel('Sample clients file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(page.getByRole('alert')).toContainText('CSV');

    await page.getByLabel('Sample clients file').setInputFiles({ name: 'x.csv', mimeType: 'text/csv', buffer: Buffer.from('foo,bar\n1,2') });
    await page.getByRole('button', { name: 'Save mapping' }).click();
    await expect(page.getByRole('alert')).toContainText('Client Name');
  });
});
