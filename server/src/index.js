const { randomUUID } = require('crypto');
const express = require('express');
const cors = require('cors');
const store = require('./data/store');
const { LOCATIONS, SEGMENTS, createCustomer, createDefaultOnboardingSteps, validateCustomerInfo } = require('./models');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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

// Create customer (name, location = region, segment = industry) and queue it for onboarding
app.post('/api/customers', (req, res) => {
  const { values, errors } = validateCustomerInfo(req.body, store.getCustomers());
  if (Object.keys(errors).length) {
    return res.status(400).json({ error: 'Validation failed', fields: errors });
  }
  const customer = store.addCustomer(createCustomer({ ...values, id: `cust_${randomUUID()}` }));
  store.addOnboardingState({ customerId: customer.id, steps: createDefaultOnboardingSteps(), progressPercent: 0 });
  res.status(201).json(customer);
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
  
  // Join customer info with onboarding state
  const dashboard = states.map(state => {
    const customer = customers.find(c => c.id === state.customerId);
    return {
      ...state,
      customerName: customer?.name || 'Unknown',
      customerIndustry: customer?.industry || '',
      customerRegion: customer?.region || ''
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
  res.json(tenant);
});

// Data Mapping
app.use('/api', require('./mapping/routes'));

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Onboarding API server running at http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
