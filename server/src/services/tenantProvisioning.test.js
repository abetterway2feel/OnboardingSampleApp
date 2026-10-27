const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const store = require('../data/store');
const { createProvisioningService } = require('./tenantProvisioning');

// Manual scheduler: provisioning only completes when the test runs the queued jobs
function createManualScheduler() {
  const jobs = [];
  return {
    schedule: fn => jobs.push(fn),
    runAll: () => jobs.splice(0).forEach(fn => fn())
  };
}

function tenantSetupStep(customerId) {
  return store.getOnboardingState(customerId).steps.find(s => s.name === 'Tenant Setup');
}

describe('Tenant provisioning service', () => {
  let scheduler;
  let service;

  beforeEach(() => {
    store.reset();
    scheduler = createManualScheduler();
    service = createProvisioningService({ store, schedule: scheduler.schedule });
  });

  describe('provision', () => {
    it('moves a non-failing plan through provisioning to active', () => {
      const started = service.provision('cust_001', 'starter');
      assert.strictEqual(started.tenant.status, 'provisioning');
      assert.strictEqual(started.tenant.plan, 'starter');

      scheduler.runAll();
      const tenant = store.getTenantByCustomerId('cust_001');
      assert.strictEqual(tenant.status, 'active');
      assert.strictEqual(tenant.failureReason, null);
    });

    it('creates a tenant for a customer that has none', () => {
      store.addCustomer({ id: 'cust_002', name: 'Beta Ltd' });
      store.addOnboardingState({ customerId: 'cust_002', steps: [], progressPercent: 0 });

      const result = service.provision('cust_002', 'professional');
      assert.strictEqual(result.tenant.customerId, 'cust_002');
      assert.strictEqual(result.tenant.status, 'provisioning');
    });

    it('fails the enterprise plan on the first attempt with a reason', () => {
      service.provision('cust_001', 'enterprise');
      scheduler.runAll();

      const tenant = store.getTenantByCustomerId('cust_001');
      assert.strictEqual(tenant.status, 'failed');
      assert.ok(tenant.failureReason.length > 0);
    });

    it('rejects an unknown customer', () => {
      const result = service.provision('cust_missing', 'starter');
      assert.strictEqual(result.error.code, 'CUSTOMER_NOT_FOUND');
      assert.strictEqual(result.error.message, 'Customer not found');
    });

    it('rejects a missing or unknown plan', () => {
      assert.strictEqual(service.provision('cust_001', undefined).error.code, 'INVALID_PLAN');
      assert.strictEqual(service.provision('cust_001', 'platinum').error.code, 'INVALID_PLAN');
      assert.strictEqual(store.getTenantByCustomerId('cust_001').status, 'pending');
    });

    it('starts only one provisioning when called twice', () => {
      service.provision('cust_001', 'starter');
      const second = service.provision('cust_001', 'starter');

      assert.strictEqual(second.tenant.status, 'provisioning');
      assert.strictEqual(store.getTenantByCustomerId('cust_001').attempts, 1);
    });

    it('does not offer provisioning for an active tenant and keeps its plan', () => {
      service.provision('cust_001', 'starter');
      scheduler.runAll();

      const result = service.provision('cust_001', 'enterprise');
      assert.strictEqual(result.error.code, 'ALREADY_ACTIVE');
      assert.strictEqual(store.getTenantByCustomerId('cust_001').plan, 'starter');
    });

    it('uses the plan chosen at provision time for a pending tenant', () => {
      // The seeded tenant is pending with the professional plan
      service.provision('cust_001', 'starter');
      assert.strictEqual(store.getTenantByCustomerId('cust_001').plan, 'starter');
    });
  });

  describe('retry', () => {
    it('retries a failed tenant to active with the plan unchanged', () => {
      service.provision('cust_001', 'enterprise');
      scheduler.runAll();

      const retried = service.retry('cust_001');
      assert.strictEqual(retried.tenant.status, 'provisioning');
      assert.strictEqual(retried.tenant.failureReason, null);

      scheduler.runAll();
      const tenant = store.getTenantByCustomerId('cust_001');
      assert.strictEqual(tenant.status, 'active');
      assert.strictEqual(tenant.plan, 'enterprise');
    });

    it('only retries failed tenants', () => {
      assert.strictEqual(service.retry('cust_001').error.code, 'NOT_FAILED');
      assert.strictEqual(service.retry('cust_missing').error.code, 'CUSTOMER_NOT_FOUND');
    });

    it('does not start a second run while one is in progress', () => {
      service.provision('cust_001', 'enterprise');
      scheduler.runAll();
      service.retry('cust_001');
      const again = service.retry('cust_001');

      assert.strictEqual(again.tenant.status, 'provisioning');
      assert.strictEqual(store.getTenantByCustomerId('cust_001').attempts, 2);
    });
  });

  describe('onboarding step sync', () => {
    it('follows the tenant status and updates progress', () => {
      assert.strictEqual(tenantSetupStep('cust_001').status, 'pending');

      service.provision('cust_001', 'enterprise');
      assert.strictEqual(tenantSetupStep('cust_001').status, 'in_progress');

      scheduler.runAll();
      assert.strictEqual(tenantSetupStep('cust_001').status, 'failed');
      assert.strictEqual(store.getOnboardingState('cust_001').progressPercent, 0);

      service.retry('cust_001');
      scheduler.runAll();
      assert.strictEqual(tenantSetupStep('cust_001').status, 'completed');
      assert.strictEqual(store.getOnboardingState('cust_001').progressPercent, 25);
    });
  });
});
