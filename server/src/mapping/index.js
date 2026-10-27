/**
 * Data Mapping: per-customer mapping of a customer's client-file columns to the standard client fields.
 * Mappings are stored in memory, one per customer. Nothing here applies a mapping to an import.
 */
const store = require('../data/store');
const { calculateProgress } = require('../models');

const FIELDS = [
  { key: 'clientId', label: 'Client ID', aliases: ['clientid', 'clientcode', 'customerid', 'customercode'] },
  { key: 'clientName', label: 'Client Name', required: true, aliases: ['clientname', 'companyname', 'businessname', 'customername'] },
  { key: 'businessType', label: 'Business Type', aliases: ['businesstype', 'entitytype', 'legalstructure'] },
  { key: 'status', label: 'Status', aliases: ['status', 'clientstatus', 'accountstatus'] },
  { key: 'dateOnboarded', label: 'Date Onboarded', aliases: ['dateonboarded', 'startdate', 'registrationdate'] },
  { key: 'taxId', label: 'Tax ID', aliases: ['taxid', 'federaltaxid', 'taxreference'] },
  { key: 'annualRevenue', label: 'Annual Revenue', aliases: ['annualrevenue', 'yearlyrevenue', 'grossrevenue'] },
  { key: 'industry', label: 'Industry', aliases: ['industry', 'sectorcode', 'industrysector'] },
  { key: 'paymentTerms', label: 'Payment Terms', aliases: ['paymentterms', 'billingterms', 'creditterms'] },
  { key: 'primaryContact', label: 'Primary Contact', aliases: ['primarycontact', 'maincontact', 'keycontactname'] }
];
const MAPPING_STEP_ID = 'step_2';

// Case, whitespace, underscore and dash insensitive comparison key
const norm = (s) => String(s).toLowerCase().replace(/[\s_-]+/g, '');

/** Split the first record of a CSV into trimmed cells (quoted values may contain commas, quotes and newlines). */
function firstRecord(text) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { cells.push(cell.trim()); cell = ''; }
    else if (ch === '\n' || ch === '\r') break;
    else cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

function duplicateHeaders(headers) {
  const seen = new Set();
  return headers.filter(h => { const k = norm(h); const dup = seen.has(k); seen.add(k); return dup; });
}

/** @returns {{headers: string[]} | {error: string}} */
function parseHeaders(csv, filename) {
  if (filename && !/\.csv$/i.test(filename)) return { error: 'The file must be a CSV (.csv)' };
  if (typeof csv !== 'string' || !csv.trim()) return { error: 'The file is empty' };
  if (csv.includes('\u0000')) return { error: 'The file must be a CSV (.csv), not a binary file' };
  const headers = firstRecord(csv.replace(/^﻿/, ''));
  if (headers.every(h => !h)) return { error: 'The file has no header row' };
  const dups = duplicateHeaders(headers);
  if (dups.length) return { error: `The file has duplicate column names: ${dups.map(d => `"${d}"`).join(', ')}. Rename them and upload again` };
  return { headers };
}

/** Obvious matches only: a header equal to a known name for the field, each header used once. */
function suggestMapping(headers) {
  const used = new Set();
  const suggestions = {};
  for (const f of FIELDS) {
    const match = headers.find(h => !used.has(h) && f.aliases.includes(norm(h)));
    if (match !== undefined) used.add(match);
    suggestions[f.key] = match ?? null;
  }
  return suggestions;
}

/** @returns {{values: {headers: string[], columns: Object}, errors: Object}} */
function validateMapping(data) {
  const errors = {};
  const headers = Array.isArray(data?.headers) ? data.headers : [];
  const input = data?.columns && typeof data.columns === 'object' ? data.columns : {};
  if (!headers.length || headers.some(h => typeof h !== 'string' || !h)) errors.headers = 'Column names from the sample file are required';
  else if (duplicateHeaders(headers).length) errors.headers = 'The sample file has duplicate column names';

  for (const key of Object.keys(input)) {
    if (!FIELDS.some(f => f.key === key)) errors[key] = `Unknown field: ${key}`;
  }

  const columns = {};
  const usedBy = {};
  for (const f of FIELDS) {
    const col = input[f.key] || null;
    columns[f.key] = col;
    if (col === null) continue;
    if (!headers.includes(col)) errors[f.key] = `${f.label}: column "${col}" is not in the sample file`;
    else if (usedBy[col]) errors[f.key] = `${f.label}: column "${col}" is already mapped to ${usedBy[col]}`;
    else usedBy[col] = f.label;
  }
  if (!columns.clientName && !errors.clientName) errors.clientName = 'Client Name must be mapped to a column';

  return { values: { headers, columns }, errors };
}

const mappings = new Map();

function getMapping(customerId) {
  return mappings.get(customerId);
}

/** Mark an onboarding step completed and recalculate progress. Returns null if the customer has no onboarding state. */
function completeStep(customerId, stepId) {
  const state = store.getOnboardingState(customerId);
  if (!state) return null;
  const steps = state.steps.map(s => (s.id === stepId ? { ...s, status: 'completed' } : s));
  return store.updateOnboardingState(customerId, { steps, progressPercent: calculateProgress(steps) });
}

/** Store (or replace) the customer's mapping from already validated values and complete Data Mapping. */
function saveMapping(customerId, values) {
  const mapping = { customerId, headers: values.headers, columns: values.columns, updatedAt: new Date().toISOString() };
  mappings.set(customerId, mapping);
  completeStep(customerId, MAPPING_STEP_ID);
  return mapping;
}

module.exports = { FIELDS, parseHeaders, suggestMapping, validateMapping, getMapping, saveMapping, completeStep };
