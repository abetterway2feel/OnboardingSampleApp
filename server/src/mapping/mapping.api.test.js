const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const app = require('../index');

const csvB = fs.readFileSync(path.join(__dirname, '../../../sample-data/CustomerB_XYZFinancialServices/clients.csv'), 'utf8');

describe('Data Mapping API', () => {
  let server, base;
  before(async () => {
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://localhost:${server.address().port}`;
  });
  after(() => server.close());

  const send = (method, p, body) =>
    fetch(base + p, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const progress = async (id) => (await (await fetch(`${base}/api/customers/${id}/onboarding`)).json()).progressPercent;
  const newCustomer = async (name) =>
    (await (await send('POST', '/api/customers', { name, region: 'EMEA', industry: 'Retail' })).json()).id;

  it('lists the standard client fields (AC-2)', async () => {
    const fields = await (await fetch(base + '/api/mapping-fields')).json();
    assert.strictEqual(fields.length, 10);
    assert.deepStrictEqual(fields.filter(f => f.required).map(f => f.key), ['clientName']);
  });

  it('suggests matches for Customer B without saving anything (AC-1)', async () => {
    const id = await newCustomer('Suggest Co');
    const res = await send('POST', `/api/customers/${id}/mapping/suggest`, { filename: 'clients.csv', csv: csvB });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.suggestions.clientName, 'companyName');
    assert.strictEqual(body.headers.length, 10);
    assert.strictEqual((await fetch(`${base}/api/customers/${id}/mapping`)).status, 404);
    assert.strictEqual(await progress(id), 0);
  });

  it('rejects empty, non-CSV and duplicate-header files with a message (AC-8, AC-9)', async () => {
    const id = await newCustomer('Reject Co');
    for (const body of [{ csv: '' }, { csv: 'a,b', filename: 'x.pdf' }, { csv: 'a,A\n1,2' }, {}]) {
      const res = await send('POST', `/api/customers/${id}/mapping/suggest`, body);
      assert.strictEqual(res.status, 400);
      assert.ok((await res.json()).fields.file);
    }
  });

  it('saves a corrected mapping, completes the step and updates progress (AC-2, AC-6)', async () => {
    const id = await newCustomer('Save Co');
    const columns = { clientName: 'companyName', status: 'clientStatus', industry: 'sectorCode' };
    const headers = ['clientCode', 'companyName', 'clientStatus', 'sectorCode'];
    const res = await send('PUT', `/api/customers/${id}/mapping`, { headers, columns });
    assert.strictEqual(res.status, 200);
    const saved = await (await fetch(`${base}/api/customers/${id}/mapping`)).json();
    assert.strictEqual(saved.columns.industry, 'sectorCode');
    assert.strictEqual(saved.columns.taxId, null);
    assert.strictEqual(await progress(id), 25);
  });

  it('blocks a save without Client Name or with a shared column, leaving progress unchanged (AC-2, AC-3, AC-6)', async () => {
    const id = await newCustomer('Blocked Co');
    const headers = ['a', 'b'];
    const noName = await send('PUT', `/api/customers/${id}/mapping`, { headers, columns: { status: 'a' } });
    assert.strictEqual(noName.status, 400);
    assert.match((await noName.json()).fields.clientName, /Client Name/);
    const shared = await send('PUT', `/api/customers/${id}/mapping`, { headers, columns: { clientName: 'a', status: 'a' } });
    assert.strictEqual(shared.status, 400);
    assert.strictEqual((await fetch(`${base}/api/customers/${id}/mapping`)).status, 404);
    assert.strictEqual(await progress(id), 0);
  });

  it('replaces an existing mapping on edit (AC-5)', async () => {
    const id = await newCustomer('Edit Co');
    const headers = ['a', 'b'];
    await send('PUT', `/api/customers/${id}/mapping`, { headers, columns: { clientName: 'a' } });
    await send('PUT', `/api/customers/${id}/mapping`, { headers, columns: { clientName: 'b' } });
    assert.strictEqual((await (await fetch(`${base}/api/customers/${id}/mapping`)).json()).columns.clientName, 'b');
    assert.strictEqual(await progress(id), 25);
  });

  it('returns 404 for an unknown customer (AC-2)', async () => {
    assert.strictEqual((await send('GET', '/api/customers/nope/mapping')).status, 404);
    assert.strictEqual((await send('PUT', '/api/customers/nope/mapping', { headers: ['a'], columns: { clientName: 'a' } })).status, 404);
    assert.strictEqual((await send('POST', '/api/customers/nope/mapping/suggest', { csv: 'a' })).status, 404);
  });
});
