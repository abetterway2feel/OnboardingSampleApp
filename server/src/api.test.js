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

  it('rejects an invalid update and returns 404 for an unknown id', async () => {
    const bad = await send('PUT', '/api/customers/cust_001', { name: '', region: 'LATAM', industry: 'Manufacturing' });
    assert.strictEqual(bad.status, 400);
    const missing = await send('PUT', '/api/customers/nope', { name: 'X', region: 'EMEA', industry: 'Retail' });
    assert.strictEqual(missing.status, 404);
    assert.strictEqual((await missing.json()).error, 'Customer not found');
  });
});
