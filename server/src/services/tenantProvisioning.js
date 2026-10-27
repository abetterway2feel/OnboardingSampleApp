/**
 * Tenant Provisioning Service
 * Owns the tenant lifecycle: pending -> provisioning -> active | failed (retry: failed -> provisioning).
 * Provisioning is simulated; the outcome is applied after a delay.
 */

const { PLANS, createTenant, calculateProgress } = require('../models');

const TENANT_SETUP_STEP = 'Tenant Setup';

const STEP_STATUS_BY_TENANT_STATUS = {
  pending: 'pending',
  provisioning: 'in_progress',
  active: 'completed',
  failed: 'failed'
};

/**
 * Deterministic simulation: the enterprise plan fails on its first attempt
 * and succeeds on retry; every other plan succeeds.
 * @param {import('../models').Tenant} tenant
 * @returns {{ ok: boolean, reason?: string }}
 */
function defaultSimulator(tenant) {
  if (tenant.plan === 'enterprise' && tenant.attempts === 1) {
    return { ok: false, reason: 'Capacity allocation for the enterprise plan failed. Retry provisioning.' };
  }
  return { ok: true };
}

function fail(code, message) {
  return { error: { code, message } };
}

function createProvisioningService({
  store,
  simulate = defaultSimulator,
  delayMs = 0,
  schedule = (fn, ms) => setTimeout(fn, ms)
}) {
  // customerId -> id of the run allowed to complete; a reset or newer run invalidates older ones
  const activeRuns = new Map();
  let nextRunId = 1;

  function syncOnboardingStep(customerId, tenantStatus) {
    const state = store.getOnboardingState(customerId);
    if (!state) return;
    const steps = state.steps.map(step =>
      step.name === TENANT_SETUP_STEP
        ? { ...step, status: STEP_STATUS_BY_TENANT_STATUS[tenantStatus] }
        : step
    );
    store.updateOnboardingState(customerId, { steps, progressPercent: calculateProgress(steps) });
  }

  function startRun(tenant, plan) {
    const runId = nextRunId++;
    activeRuns.set(tenant.customerId, runId);
    const updated = store.updateTenant(tenant.customerId, {
      plan,
      status: 'provisioning',
      failureReason: null,
      attempts: tenant.attempts + 1
    });
    syncOnboardingStep(tenant.customerId, 'provisioning');
    schedule(() => completeRun(tenant.customerId, runId), delayMs);
    return { tenant: updated };
  }

  function completeRun(customerId, runId) {
    if (activeRuns.get(customerId) !== runId) return;
    activeRuns.delete(customerId);
    const tenant = store.getTenantByCustomerId(customerId);
    if (!tenant || tenant.status !== 'provisioning') return;

    const outcome = simulate(tenant);
    const status = outcome.ok ? 'active' : 'failed';
    store.updateTenant(customerId, { status, failureReason: outcome.ok ? null : outcome.reason });
    syncOnboardingStep(customerId, status);
  }

  function provision(customerId, plan) {
    if (!store.getCustomerById(customerId)) return fail('CUSTOMER_NOT_FOUND', 'Customer not found');
    if (!PLANS.includes(plan)) return fail('INVALID_PLAN', `Plan must be one of: ${PLANS.join(', ')}`);

    let tenant = store.getTenantByCustomerId(customerId);
    if (tenant?.status === 'provisioning') return { tenant };
    if (tenant?.status === 'active') return fail('ALREADY_ACTIVE', 'Tenant is already active');
    if (tenant?.status === 'failed') return fail('ALREADY_FAILED', 'Provisioning failed; retry instead');

    if (!tenant) tenant = store.addTenant(createTenant({ customerId, status: 'pending' }));
    return startRun(tenant, plan);
  }

  function retry(customerId) {
    if (!store.getCustomerById(customerId)) return fail('CUSTOMER_NOT_FOUND', 'Customer not found');

    const tenant = store.getTenantByCustomerId(customerId);
    if (tenant?.status === 'provisioning') return { tenant };
    if (tenant?.status !== 'failed') return fail('NOT_FAILED', 'Only a failed tenant can be retried');

    return startRun(tenant, tenant.plan);
  }

  function reset() {
    activeRuns.clear();
  }

  return { provision, retry, reset };
}

module.exports = { createProvisioningService, defaultSimulator };
