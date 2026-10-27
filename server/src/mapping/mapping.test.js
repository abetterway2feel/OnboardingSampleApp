const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const store = require('../data/store');

// RED phase: module does not exist yet
let m = {};
try { m = require('./index'); } catch { /* red */ }

const sample = (dir) => fs.readFileSync(path.join(__dirname, '../../../sample-data', dir, 'clients.csv'), 'utf8');
const A = sample('CustomerA_ABCAccounting');
const B = sample('CustomerB_XYZFinancialServices');
const C = sample('CustomerC_PremierBookkeeping');
const headersOf = (csv) => m.parseHeaders(csv).headers;
const newCustomer = () => {
  const id = `cust_test_${Math.random().toString(36).slice(2)}`;
  store.addOnboardingState({ customerId: id, steps: [
    { id: 'step_1', name: 'Customer Info', status: 'pending', order: 1 },
    { id: 'step_2', name: 'Data Mapping', status: 'pending', order: 2 },
    { id: 'step_3', name: 'Tenant Setup', status: 'pending', order: 3 },
    { id: 'step_4', name: 'Import', status: 'pending', order: 4 }
  ], progressPercent: 0 });
  return id;
};
const SKIP = (ac) => ({ skip: `red-test-${ac}` });

describe('parseHeaders', () => {
  it('reads the header row of the real sample files (AC-1)', SKIP('AC-1'), () => {
    assert.strictEqual(headersOf(A).length, 10);
    assert.strictEqual(headersOf(B)[1], 'companyName');
    assert.strictEqual(headersOf(C)[1], 'business_name');
  });

  it('handles quoted headers containing commas, BOM and CRLF (AC-1)', SKIP('AC-1'), () => {
    assert.deepStrictEqual(headersOf('﻿"Name, full",Status\r\nx,y\r\n'), ['Name, full', 'Status']);
  });

  it('rejects empty files, no header row, non-CSV and binary content (AC-8)', SKIP('AC-8'), () => {
    for (const csv of ['', '   \n', '\n\nrow']) assert.ok(m.parseHeaders(csv).error, JSON.stringify(csv));
    assert.ok(m.parseHeaders('a,b\n1,2', 'clients.xlsx').error);
    assert.ok(m.parseHeaders('PK\u0000\u0003binary', 'clients.csv').error);
    assert.ok(m.parseHeaders('a,b\n1,2', 'clients.CSV').headers);
  });

  it('reports duplicate column names, ignoring case and whitespace (AC-9)', SKIP('AC-9'), () => {
    const r = m.parseHeaders('Name,status, NAME \n');
    assert.match(r.error, /duplicate/i);
    assert.match(r.error, /NAME/);
  });
});

describe('suggestMapping', () => {
  const expected = {
    A: ['Client ID', 'Client Name', 'Business Type', 'Status', 'Date Onboarded', 'Tax ID', 'Annual Revenue', 'Industry', 'Payment Terms', 'Primary Contact'],
    B: ['clientCode', 'companyName', 'entityType', 'clientStatus', 'startDate', 'federalTaxId', 'yearlyRevenue', 'sectorCode', 'billingTerms', 'mainContact'],
    C: ['customer_id', 'business_name', 'legal_structure', 'account_status', 'registration_date', 'tax_reference', 'gross_revenue', 'industry_sector', 'credit_terms', 'key_contact_name']
  };
  for (const [name, csv] of Object.entries({ A, B, C })) {
    it(`suggests every standard field for Customer ${name} sample headers (AC-1)`, SKIP('AC-1'), () => {
      const s = m.suggestMapping(headersOf(csv));
      assert.deepStrictEqual(m.FIELDS.map(f => s[f.key]), expected[name]);
    });
  }

  it('ignores case and whitespace and leaves unknown columns unmapped (AC-1)', SKIP('AC-1'), () => {
    const s = m.suggestMapping(['  COMPANYNAME ', 'favourite colour']);
    assert.strictEqual(s.clientName, '  COMPANYNAME ');
    assert.strictEqual(Object.values(s).filter(Boolean).length, 1);
  });

  it('shows everything as not mapped when nothing matches (AC-1)', SKIP('AC-1'), () => {
    const s = m.suggestMapping(['x', 'y']);
    assert.ok(m.FIELDS.every(f => s[f.key] === null));
  });
});

describe('validateMapping', () => {
  const headers = ['id', 'name', 'status'];

  it('accepts a mapping with Client Name and normalises missing fields to null (AC-2)', SKIP('AC-2'), () => {
    const { values, errors } = m.validateMapping({ headers, columns: { clientName: 'name' } });
    assert.deepStrictEqual(errors, {});
    assert.strictEqual(values.columns.clientName, 'name');
    assert.strictEqual(values.columns.status, null);
  });

  it('blocks a mapping without Client Name, naming the field (AC-2)', SKIP('AC-2'), () => {
    const { errors } = m.validateMapping({ headers, columns: { status: 'status' } });
    assert.match(errors.clientName, /Client Name/);
  });

  it('rejects a column mapped to two fields (AC-3)', SKIP('AC-3'), () => {
    const { errors } = m.validateMapping({ headers, columns: { clientName: 'name', industry: 'name' } });
    assert.ok(errors.industry);
  });

  it('rejects columns that are not in the file, unknown fields and duplicate headers (AC-2, AC-9)', SKIP('AC-2'), () => {
    assert.ok(m.validateMapping({ headers, columns: { clientName: 'nope' } }).errors.clientName);
    assert.ok(m.validateMapping({ headers, columns: { clientName: 'name', bogus: 'id' } }).errors.bogus);
    assert.ok(m.validateMapping({ headers: ['a', 'A'], columns: { clientName: 'a' } }).errors.headers);
    assert.ok(m.validateMapping({}).errors.headers);
  });
});

describe('saveMapping', () => {
  const headers = ['id', 'name', 'status'];

  it('stores one mapping per customer, completes Data Mapping and updates progress (AC-6)', SKIP('AC-6'), () => {
    const id = newCustomer();
    assert.strictEqual(m.getMapping(id), undefined);
    m.saveMapping(id, { headers, columns: { clientName: 'name' } });
    assert.strictEqual(m.getMapping(id).columns.clientName, 'name');
    const state = store.getOnboardingState(id);
    assert.strictEqual(state.steps.find(s => s.id === 'step_2').status, 'completed');
    assert.strictEqual(state.progressPercent, 25);
  });

  it('replaces the mapping on edit without double-counting progress (AC-5)', SKIP('AC-5'), () => {
    const id = newCustomer();
    m.saveMapping(id, { headers, columns: { clientName: 'name' } });
    m.saveMapping(id, { headers, columns: { clientName: 'id', status: 'status' } });
    assert.deepStrictEqual(
      [m.getMapping(id).columns.clientName, m.getMapping(id).columns.status],
      ['id', 'status']
    );
    assert.strictEqual(store.getOnboardingState(id).progressPercent, 25);
  });

  it('completeStep is generic and ignores unknown customers (AC-6)', SKIP('AC-6'), () => {
    const id = newCustomer();
    m.completeStep(id, 'step_1');
    assert.strictEqual(store.getOnboardingState(id).progressPercent, 25);
    assert.strictEqual(m.completeStep('missing', 'step_1'), null);
  });
});
