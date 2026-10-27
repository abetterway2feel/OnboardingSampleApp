const { randomUUID } = require('crypto');
const express = require('express');
const cors = require('cors');
const store = require('../data/store');
const { LOCATIONS, SEGMENTS, createCustomer, createDefaultOnboardingSteps, validateCustomerInfo } = require('../models');
const { parseCustomerCsv } = require('../import');
const { createProvisioningService } = require('../services/tenantProvisioning');

const HTTP_STATUS_BY_ERROR_CODE = {
  CUSTOMER_NOT_FOUND: 404,
  INVALID_PLAN: 400
};

// The attempt counter is internal to the provisioning simulator
function publicTenant({ attempts, ...tenant }) {
  return tenant;
}

function createDefaultProvisioning() {
  return createProvisioningService({
    store,
    delayMs: Number(process.env.PROVISIONING_DELAY_MS ?? 1500)
  });
}

function createApp({ provisioning = createDefaultProvisioning() } = {}) {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '1mb' })); // CSV imports are sent as text in the JSON body

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get all customers
  app.get('/api/customers', (req, res) => {
    res.json(store.getCustomers());
  });

  // Allowed values for the Customer Info form
  app.get('/api/customer-options', (req, res) => {
    res.json({ locations: LOCATIONS, segments: SEGMENTS });
  });

  // Save a validated customer and queue it for onboarding
  function queueCustomer(values) {
    const customer = store.addCustomer(createCustomer({ ...values, id: `cust_${randomUUID()}` }));
    store.addOnboardingState({ customerId: customer.id, steps: createDefaultOnboardingSteps(), progressPercent: 0 });
    return customer;
  }

  // Create customer (name, location = region, segment = industry) and queue it for onboarding
  app.post('/api/customers', (req, res) => {
    const { values, errors } = validateCustomerInfo(req.body, store.getCustomers());
    if (Object.keys(errors).length) {
      return res.status(400).json({ error: 'Validation failed', fields: errors });
    }
    res.status(201).json(queueCustomer(values));
  });

  // Bulk import from CSV text: valid rows are queued, invalid ones are reported by row (1 = first row after the header)
  app.post('/api/customers/import', (req, res) => {
    const { rows, error } = parseCustomerCsv(req.body?.csv);
    if (error) return res.status(400).json({ error });

    const imported = [];
    const skipped = [];
    rows.forEach((row, i) => {
      const { values, errors } = validateCustomerInfo(row, store.getCustomers());
      if (Object.keys(errors).length) skipped.push({ row: i + 1, name: values.name, errors });
      else imported.push(queueCustomer(values));
    });
    res.json({ imported, skipped });
  });

  // Update customer info
  app.put('/api/customers/:id', (req, res) => {
    if (!store.getCustomerById(req.params.id)) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const { values, errors } = validateCustomerInfo(req.body, store.getCustomers(), req.params.id);
    if (Object.keys(errors).length) {
      return res.status(400).json({ error: 'Validation failed', fields: errors });
    }
    res.json(store.updateCustomer(req.params.id, values));
  });

  // Get customer by ID
  app.get('/api/customers/:id', (req, res) => {
    const customer = store.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  });

  // Get onboarding state for a customer
  app.get('/api/customers/:id/onboarding', (req, res) => {
    const state = store.getOnboardingState(req.params.id);
    if (!state) {
      return res.status(404).json({ error: 'Onboarding state not found' });
    }
    res.json(state);
  });

  // Get all onboarding states (dashboard view)
  app.get('/api/onboarding', (req, res) => {
    const states = store.getAllOnboardingStates();
    const customers = store.getCustomers();

    // Join customer info and tenant with onboarding state
    const dashboard = states.map(state => {
      const customer = customers.find(c => c.id === state.customerId);
      const tenant = store.getTenantByCustomerId(state.customerId);
      return {
        ...state,
        customerName: customer?.name || 'Unknown',
        customerIndustry: customer?.industry || '',
        customerRegion: customer?.region || '',
        tenantStatus: tenant?.status || null,
        tenantPlan: tenant?.plan || null
      };
    });

    res.json(dashboard);
  });

  // Get tenant by customer ID
  app.get('/api/tenants/:customerId', (req, res) => {
    const tenant = store.getTenantByCustomerId(req.params.customerId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json(publicTenant(tenant));
  });

  function respond(res, result) {
    if (result.error) {
      const status = HTTP_STATUS_BY_ERROR_CODE[result.error.code] || 409;
      return res.status(status).json({ error: result.error.message });
    }
    res.status(202).json(publicTenant(result.tenant));
  }

  // Start provisioning a tenant with the chosen plan
  app.post('/api/tenants/:customerId/provision', (req, res) => {
    respond(res, provisioning.provision(req.params.customerId, req.body?.plan));
  });

  // Retry a failed provisioning
  app.post('/api/tenants/:customerId/retry', (req, res) => {
    respond(res, provisioning.retry(req.params.customerId));
  });

  return app;
}

module.exports = { createApp };
