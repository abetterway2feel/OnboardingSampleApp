/**
 * Domain Models for Customer Onboarding
 */

/**
 * @typedef {Object} Customer
 * @property {string} id - Unique customer identifier
 * @property {string} name - Customer/company name
 * @property {string} industry - Industry vertical
 * @property {string} region - Geographic region
 * @property {string} contactEmail - Primary contact email
 * @property {string} createdAt - ISO timestamp
 */

/**
 * @typedef {Object} Tenant
 * @property {string} id - Unique tenant identifier
 * @property {string} customerId - Associated customer ID
 * @property {string} status - 'pending' | 'provisioning' | 'active' | 'failed'
 * @property {string} plan - 'starter' | 'professional' | 'enterprise'
 * @property {string} createdAt - ISO timestamp
 */

/**
 * @typedef {Object} OnboardingStep
 * @property {string} id - Step identifier
 * @property {string} name - Human-readable step name
 * @property {string} status - 'pending' | 'in_progress' | 'completed' | 'failed'
 * @property {number} order - Step sequence number
 */

/**
 * @typedef {Object} OnboardingState
 * @property {string} customerId - Associated customer ID
 * @property {OnboardingStep[]} steps - Array of onboarding steps
 * @property {number} progressPercent - Overall progress (0-100)
 */

/**
 * Creates a new Customer object
 * @param {Partial<Customer>} data 
 * @returns {Customer}
 */
function createCustomer(data) {
  return {
    id: data.id || `cust_${Date.now()}`,
    name: data.name || '',
    industry: data.industry || '',
    region: data.region || '',
    contactEmail: data.contactEmail || '',
    createdAt: data.createdAt || new Date().toISOString()
  };
}

const LOCATIONS = ['North America', 'EMEA', 'APAC', 'LATAM'];
const SEGMENTS = ['Manufacturing', 'Technology', 'Healthcare', 'Financial Services', 'Retail', 'Education'];
const MAX_NAME_LENGTH = 100;

/**
 * Validates and trims the Customer Info fields (name, region = location, industry = segment).
 * @param {Object} data
 * @param {Customer[]} existing - customers to check name uniqueness against
 * @param {string} [excludeId] - customer being edited (ignored in the duplicate check)
 * @returns {{ values: {name: string, region: string, industry: string}, errors: Object }}
 */
function validateCustomerInfo(data, existing = [], excludeId) {
  const trim = v => (typeof v === 'string' ? v.trim() : '');
  const values = { name: trim(data?.name), region: trim(data?.region), industry: trim(data?.industry) };
  const errors = {};

  if (!values.name) errors.name = 'Company name is required';
  else if (values.name.length > MAX_NAME_LENGTH) errors.name = `Company name must be ${MAX_NAME_LENGTH} characters or fewer`;
  else if (existing.some(c => c.id !== excludeId && c.name.toLowerCase() === values.name.toLowerCase())) {
    errors.name = 'A customer with this company name already exists';
  }

  if (!values.region) errors.region = 'Location is required';
  else if (!LOCATIONS.includes(values.region)) errors.region = 'Location must be one of: ' + LOCATIONS.join(', ');

  if (!values.industry) errors.industry = 'Segment is required';
  else if (!SEGMENTS.includes(values.industry)) errors.industry = 'Segment must be one of: ' + SEGMENTS.join(', ');

  return { values, errors };
}

/**
 * Creates a new Tenant object
 * @param {Partial<Tenant>} data 
 * @returns {Tenant}
 */
function createTenant(data) {
  return {
    id: data.id || `tenant_${Date.now()}`,
    customerId: data.customerId || '',
    status: data.status || 'pending',
    plan: data.plan || 'starter',
    createdAt: data.createdAt || new Date().toISOString()
  };
}

/**
 * Creates default onboarding steps
 * @returns {OnboardingStep[]}
 */
function createDefaultOnboardingSteps() {
  return [
    { id: 'step_1', name: 'Customer Info', status: 'pending', order: 1 },
    { id: 'step_2', name: 'Data Mapping', status: 'pending', order: 2 },
    { id: 'step_3', name: 'Tenant Setup', status: 'pending', order: 3 },
    { id: 'step_4', name: 'Import', status: 'pending', order: 4 }
  ];
}

/**
 * Calculates progress percentage from steps
 * @param {OnboardingStep[]} steps 
 * @returns {number}
 */
function calculateProgress(steps) {
  if (!steps || steps.length === 0) return 0;
  const completed = steps.filter(s => s.status === 'completed').length;
  return Math.round((completed / steps.length) * 100);
}

module.exports = {
  LOCATIONS,
  SEGMENTS,
  validateCustomerInfo,
  createCustomer,
  createTenant,
  createDefaultOnboardingSteps,
  calculateProgress
};
