const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const store = require('../data/store');
const { createProvisioningService } = require('../services/tenantProvisioning');
const { createApp } = require('./app');

describe('Tenant API', () => {
  let server;
  let baseUrl;
  let jobs;

  async function call(method, path, body) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json() };
  }

  function runProvisioning() {
    jobs.splice(0).forEach(fn => fn());
  }

  before(async () => {
    jobs = [];
    const provisioning = createProvisioningService({ store, schedule: fn => jobs.push(fn) });
    server = createApp({ provisioning, enableTestHooks: true }).listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server.close());

  beforeEach(async () => {
    jobs.length = 0;
    await call('POST', '/api/test/reset');
  });

  describe('POST /api/tenants/:customerId/provision', () => {
    it('returns 202 with a provisioning tenant, then the tenant becomes active', async () => {
      const res = await call('POST', '/api/tenants/cust_001/provision', { plan: 'starter' });
      assert.strictEqual(res.status, 202);
      assert.strictEqual(res.body.status, 'provisioning');

      assert.strictEqual((await call('GET', '/api/tenants/cust_001')).body.status, 'provisioning');
      runProvisioning();
      const tenant = (await call('GET', '/api/tenants/cust_001')).body;
      assert.strictEqual(tenant.status, 'active');
      assert.strictEqual(tenant.plan, 'starter');
    });

    it('returns 404 "Customer not found" for an unknown customer', async () => {
      const res = await call('POST', '/api/tenants/cust_nope/provision', { plan: 'starter' });
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error, 'Customer not found');
    });

    it('returns 400 for a missing or invalid plan', async () => {
      assert.strictEqual((await call('POST', '/api/tenants/cust_001/provision', {})).status, 400);
      assert.strictEqual((await call('POST', '/api/tenants/cust_001/provision', { plan: 'gold' })).status, 400);
    });

    it('returns 409 once the tenant is active', async () => {
      await call('POST', '/api/tenants/cust_001/provision', { plan: 'starter' });
      runProvisioning();
      const res = await call('POST', '/api/tenants/cust_001/provision', { plan: 'enterprise' });
      assert.strictEqual(res.status, 409);
    });

    it('returns 202 and starts one run when called twice', async () => {
      await call('POST', '/api/tenants/cust_001/provision', { plan: 'starter' });
      const second = await call('POST', '/api/tenants/cust_001/provision', { plan: 'starter' });
      assert.strictEqual(second.status, 202);
      assert.strictEqual(jobs.length, 1);
    });
  });

  describe('POST /api/tenants/:customerId/retry', () => {
    it('shows a failure reason, then a retry reaches active', async () => {
      await call('POST', '/api/tenants/cust_001/provision', { plan: 'enterprise' });
      runProvisioning();
      const failed = (await call('GET', '/api/tenants/cust_001')).body;
      assert.strictEqual(failed.status, 'failed');
      assert.ok(failed.failureReason);

      const retry = await call('POST', '/api/tenants/cust_001/retry');
      assert.strictEqual(retry.status, 202);
      runProvisioning();
      assert.strictEqual((await call('GET', '/api/tenants/cust_001')).body.status, 'active');
    });

    it('returns 409 when the tenant has not failed and 404 for an unknown customer', async () => {
      assert.strictEqual((await call('POST', '/api/tenants/cust_001/retry')).status, 409);
      assert.strictEqual((await call('POST', '/api/tenants/cust_nope/retry')).status, 404);
    });
  });

  describe('GET /api/onboarding', () => {
    it('includes tenant status and plan and the updated step and progress', async () => {
      let [row] = (await call('GET', '/api/onboarding')).body;
      assert.strictEqual(row.tenantStatus, 'pending');

      await call('POST', '/api/tenants/cust_001/provision', { plan: 'professional' });
      runProvisioning();
      [row] = (await call('GET', '/api/onboarding')).body;
      assert.strictEqual(row.tenantStatus, 'active');
      assert.strictEqual(row.tenantPlan, 'professional');
      assert.strictEqual(row.steps.find(s => s.name === 'Tenant Setup').status, 'completed');
      assert.strictEqual(row.progressPercent, 25);
    });
  });

  describe('test hooks', () => {
    it('are not available unless enabled', async () => {
      const app = createApp({ provisioning: createProvisioningService({ store }) });
      const disabled = app.listen(0);
      await new Promise(resolve => disabled.once('listening', resolve));
      const res = await fetch(`http://127.0.0.1:${disabled.address().port}/api/test/reset`, { method: 'POST' });
      disabled.close();
      assert.strictEqual(res.status, 404);
    });
  });
});
