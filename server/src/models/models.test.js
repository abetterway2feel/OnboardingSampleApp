const { describe, it } = require('node:test');
const assert = require('node:assert');
const { 
  createCustomer, 
  createTenant, 
  createDefaultOnboardingSteps, 
  calculateProgress,
  validateCustomerInfo
} = require('./index');

describe('Domain Models', () => {
  describe('createCustomer', () => {
    it('should create a customer with provided data', () => {
      const customer = createCustomer({
        id: 'test_123',
        name: 'Test Corp',
        industry: 'Tech',
        region: 'EMEA'
      });

      assert.strictEqual(customer.id, 'test_123');
      assert.strictEqual(customer.name, 'Test Corp');
      assert.strictEqual(customer.industry, 'Tech');
      assert.strictEqual(customer.region, 'EMEA');
    });

    it('should generate default values for missing fields', () => {
      const customer = createCustomer({});

      assert.ok(customer.id.startsWith('cust_'));
      assert.strictEqual(customer.name, '');
      assert.ok(customer.createdAt);
    });
  });

  describe('validateCustomerInfo', () => {
    const valid = { name: 'Globex', region: 'EMEA', industry: 'Retail' };

    it('should accept valid values and trim whitespace', () => {
      const { values, errors } = validateCustomerInfo({ name: '  Globex  ', region: ' EMEA ', industry: ' Retail ' });
      assert.deepStrictEqual(errors, {});
      assert.deepStrictEqual(values, valid);
    });

    it('should reject empty and whitespace-only fields, naming each field', () => {
      const { errors } = validateCustomerInfo({ name: '   ', region: '', industry: undefined });
      assert.deepStrictEqual(Object.keys(errors).sort(), ['industry', 'name', 'region']);
    });

    it('should reject names over 100 characters but allow exactly 100', () => {
      assert.ok(validateCustomerInfo({ ...valid, name: 'a'.repeat(101) }).errors.name);
      assert.deepStrictEqual(validateCustomerInfo({ ...valid, name: 'a'.repeat(100) }).errors, {});
    });

    it('should reject location and segment outside the fixed lists', () => {
      const { errors } = validateCustomerInfo({ ...valid, region: 'Mars', industry: 'Mining' });
      assert.ok(errors.region);
      assert.ok(errors.industry);
    });

    it('should reject duplicate names case-insensitively, except for the customer being edited', () => {
      const existing = [{ id: 'c1', name: 'Globex' }];
      assert.ok(validateCustomerInfo({ ...valid, name: 'GLOBEX' }, existing).errors.name);
      assert.deepStrictEqual(validateCustomerInfo({ ...valid, name: 'GLOBEX' }, existing, 'c1').errors, {});
    });
  });

  describe('calculateProgress', () => {
    it('should return 0 for empty steps', () => {
      assert.strictEqual(calculateProgress([]), 0);
      assert.strictEqual(calculateProgress(null), 0);
    });

    it('should calculate correct percentage', () => {
      const steps = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'pending' },
        { status: 'pending' }
      ];
      assert.strictEqual(calculateProgress(steps), 50);
    });

    it('should return 100 when all steps completed', () => {
      const steps = [
        { status: 'completed' },
        { status: 'completed' }
      ];
      assert.strictEqual(calculateProgress(steps), 100);
    });
  });

  describe('createDefaultOnboardingSteps', () => {
    it('should create 4 default steps', () => {
      const steps = createDefaultOnboardingSteps();
      
      assert.strictEqual(steps.length, 4);
      assert.strictEqual(steps[0].name, 'Customer Info');
      assert.strictEqual(steps[3].name, 'Import');
    });

    it('should set all steps to pending status', () => {
      const steps = createDefaultOnboardingSteps();
      
      steps.forEach(step => {
        assert.strictEqual(step.status, 'pending');
      });
    });
  });
});
