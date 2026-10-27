const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parseCsv, parseCustomerCsv, MAX_IMPORT_ROWS } = require('./import');

describe('parseCsv', () => {
  it('splits rows and fields, handling CRLF, BOM and blank lines', () => {
    assert.deepStrictEqual(parseCsv('﻿a,b\r\n1,2\r\n\r\n3,4\n'), [['a', 'b'], ['1', '2'], ['3', '4']]);
  });

  it('handles quoted fields with commas, escaped quotes and newlines', () => {
    assert.deepStrictEqual(parseCsv('"Acme, Inc.","say ""hi""","line1\nline2"'), [['Acme, Inc.', 'say "hi"', 'line1\nline2']]);
  });
});

describe('parseCustomerCsv', () => {
  it('maps name/location/segment headers case-insensitively, with aliases', () => {
    const { rows, error } = parseCustomerCsv('Company Name, LOCATION ,Segment\nInitech,APAC,Technology');
    assert.strictEqual(error, undefined);
    assert.deepStrictEqual(rows, [{ name: 'Initech', region: 'APAC', industry: 'Technology' }]);
    assert.deepStrictEqual(parseCustomerCsv('name,region,industry\nA,EMEA,Retail').rows, [{ name: 'A', region: 'EMEA', industry: 'Retail' }]);
  });

  it('reports missing columns', () => {
    assert.match(parseCustomerCsv('name,location\nA,EMEA').error, /segment/i);
  });

  it('rejects empty input and files with a header but no rows', () => {
    assert.ok(parseCustomerCsv('').error);
    assert.ok(parseCustomerCsv('   ').error);
    assert.ok(parseCustomerCsv('name,location,segment\n').error);
  });

  it('rejects more than the maximum number of rows', () => {
    const csv = 'name,location,segment\n' + Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `C${i},EMEA,Retail`).join('\n');
    assert.match(parseCustomerCsv(csv).error, new RegExp(String(MAX_IMPORT_ROWS)));
  });

  it('treats non-string input as empty', () => {
    assert.ok(parseCustomerCsv(undefined).error);
  });
});
