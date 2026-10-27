const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('./index');

describe('Customer Info API', () => {
  let server, base;
  before(async () => {
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://localhost:${server.address().port}`;
  });
  after(() => server.close());

  const send = (method, path, body) =>
    fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  it('creates a trimmed customer that appears on the dashboard', async () => {
    const res = await send('POST', '/api/customers', { name: '  Initech  ', region: 'APAC', industry: 'Technology' });
    assert.strictEqual(res.status, 201);
    const customer = await res.json();
    assert.strictEqual(customer.name, 'Initech');

    const dashboard = await (await fetch(base + '/api/onboarding')).json();
    const item = dashboard.find(d => d.customerId === customer.id);
    assert.deepStrictEqual(
      [item.customerName, item.customerRegion, item.customerIndustry],
      ['Initech', 'APAC', 'Technology']
    );
  });

  it('rejects blank fields with field-level messages and saves nothing', async () => {
    const count = async () => (await (await fetch(base + '/api/customers')).json()).length;
    const before = await count();
    const res = await send('POST', '/api/customers', { name: ' ', region: '', industry: '' });
    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(Object.keys((await res.json()).fields).sort(), ['industry', 'name', 'region']);
    assert.strictEqual(await count(), before);
  });

  it('rejects duplicate names case-insensitively', async () => {
    const res = await send('POST', '/api/customers', { name: 'acme corporation', region: 'EMEA', industry: 'Retail' });
    assert.strictEqual(res.status, 400);
    assert.ok((await res.json()).fields.name);
  });

  it('updates a customer and persists the change', async () => {
    const res = await send('PUT', '/api/customers/cust_001', { name: 'Acme Corporation', region: 'LATAM', industry: 'Manufacturing' });
    assert.strictEqual(res.status, 200);
    const customer = await (await fetch(base + '/api/customers/cust_001')).json();
    assert.strictEqual(customer.region, 'LATAM');
  });

  describe('bulk import', () => {
    const importCsv = (csv) => send('POST', '/api/customers/import', { csv });

    it('imports valid rows into the queue and reports invalid, duplicate and blank rows', async () => {
      const csv = [
        'name,location,segment',
        '  Bulk One  ,EMEA,Retail',
        'Bulk Two,APAC,Technology',
        'bulk one,EMEA,Retail', // duplicate of an earlier row in the file
        'Acme Corporation,EMEA,Retail', // duplicate of an existing customer
        'Bulk Bad,Mars,',
      ].join('\n');
      const res = await importCsv(csv);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.deepStrictEqual(body.imported.map(c => c.name), ['Bulk One', 'Bulk Two']);
      assert.deepStrictEqual(body.skipped.map(s => s.row), [3, 4, 5]);
      assert.ok(body.skipped[0].errors.name);
      assert.ok(body.skipped[1].errors.name);
      assert.deepStrictEqual(Object.keys(body.skipped[2].errors).sort(), ['industry', 'region']);

      const dashboard = await (await fetch(base + '/api/onboarding')).json();
      const item = dashboard.find(d => d.customerName === 'Bulk One');
      assert.strictEqual(item.progressPercent, 0);
      assert.strictEqual(item.steps.length, 4);
    });

    it('is idempotent: importing the same file again skips every row as a duplicate', async () => {
      const csv = 'name,location,segment\nBulk Idem,EMEA,Retail';
      assert.strictEqual((await (await importCsv(csv)).json()).imported.length, 1);
      const again = await (await importCsv(csv)).json();
      assert.strictEqual(again.imported.length, 0);
      assert.strictEqual(again.skipped.length, 1);
    });

    it('returns 400 and imports nothing for a missing column or empty file', async () => {
      const count = async () => (await (await fetch(base + '/api/customers')).json()).length;
      const before = await count();
      const noColumn = await importCsv('name,location\nX,EMEA');
      assert.strictEqual(noColumn.status, 400);
      assert.match((await noColumn.json()).error, /segment/i);
      assert.strictEqual((await send('POST', '/api/customers/import', {})).status, 400);
      assert.strictEqual(await count(), before);
    });
  });

  it('rejects an invalid update and returns 404 for an unknown id', async () => {
    const bad = await send('PUT', '/api/customers/cust_001', { name: '', region: 'LATAM', industry: 'Manufacturing' });
    assert.strictEqual(bad.status, 400);
    const missing = await send('PUT', '/api/customers/nope', { name: 'X', region: 'EMEA', industry: 'Retail' });
    assert.strictEqual(missing.status, 404);
    assert.strictEqual((await missing.json()).error, 'Customer not found');
  });
});
