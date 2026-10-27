const express = require('express');
const store = require('../data/store');
const { FIELDS, parseHeaders, suggestMapping, validateMapping, getMapping, saveMapping } = require('./index');

const router = express.Router();

// Standard client fields a file column can be mapped to
router.get('/mapping-fields', (req, res) => {
  res.json(FIELDS.map(({ key, label, required }) => ({ key, label, required: !!required })));
});

router.use('/customers/:id/mapping', (req, res, next) => {
  if (!store.getCustomerById(req.params.id)) return res.status(404).json({ error: 'Customer not found' });
  next();
});

// Saved mapping for a customer
router.get('/customers/:id/mapping', (req, res) => {
  const mapping = getMapping(req.params.id);
  if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
  res.json(mapping);
});

// Suggest matches from a sample file's header row; saves nothing
router.post('/customers/:id/mapping/suggest', (req, res) => {
  const parsed = parseHeaders(req.body?.csv, req.body?.filename);
  if (parsed.error) return res.status(400).json({ error: 'Validation failed', fields: { file: parsed.error } });
  res.json({ headers: parsed.headers, suggestions: suggestMapping(parsed.headers) });
});

// Create or replace the customer's mapping and complete the Data Mapping step
router.put('/customers/:id/mapping', (req, res) => {
  const { values, errors } = validateMapping(req.body);
  if (Object.keys(errors).length) {
    return res.status(400).json({ error: 'Validation failed', fields: errors });
  }
  res.json(saveMapping(req.params.id, values));
});

module.exports = router;
