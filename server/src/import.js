/**
 * CSV parsing for bulk customer import
 */

const MAX_IMPORT_ROWS = 500;

// Accepted header names (lowercased) for each Customer Info field
const COLUMN_ALIASES = {
  name: ['name', 'company name', 'company'],
  region: ['location', 'region'],
  industry: ['segment', 'industry']
};
const COLUMN_LABELS = { name: 'name', region: 'location', industry: 'segment' };

/**
 * Minimal RFC 4180 parser: quoted fields, "" escapes, CRLF/LF, optional BOM. Blank lines are skipped.
 * @param {string} text
 * @returns {string[][]}
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => {
    endField();
    if (row.some(f => f.trim() !== '')) rows.push(row);
    row = [];
  };

  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') endField();
    else if (ch === '\n') endRow();
    else if (ch !== '\r') field += ch;
  }
  endRow();
  return rows;
}

/**
 * Parses a customer CSV into rows of raw { name, region, industry } values (validated later).
 * @param {string} text
 * @returns {{ rows?: Array<{name: string, region: string, industry: string}>, error?: string }}
 */
function parseCustomerCsv(text) {
  const records = parseCsv(typeof text === 'string' ? text : '');
  if (records.length === 0) return { error: 'The CSV is empty' };

  const header = records[0].map(h => h.trim().toLowerCase());
  const index = {};
  const missing = [];
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    index[field] = header.findIndex(h => aliases.includes(h));
    if (index[field] === -1) missing.push(COLUMN_LABELS[field]);
  }
  if (missing.length) return { error: `Missing column(s): ${missing.join(', ')}. Expected headers: name, location, segment` };

  const data = records.slice(1);
  if (data.length === 0) return { error: 'The CSV has a header but no customer rows' };
  if (data.length > MAX_IMPORT_ROWS) return { error: `Too many rows: the maximum is ${MAX_IMPORT_ROWS} per import` };

  return {
    rows: data.map(r => ({ name: r[index.name] ?? '', region: r[index.region] ?? '', industry: r[index.industry] ?? '' }))
  };
}

module.exports = { MAX_IMPORT_ROWS, parseCsv, parseCustomerCsv };
