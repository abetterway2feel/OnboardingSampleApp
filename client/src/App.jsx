import React, { useState, useEffect, useCallback } from 'react';
import TenantSetupTab from './TenantSetupTab.jsx';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'customer-info', label: 'Customer Info' },
  { id: 'data-mapping', label: 'Data Mapping' },
  { id: 'tenant-setup', label: 'Tenant Setup' },
  { id: 'import', label: 'Import' }
];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [onboardingData, setOnboardingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = useCallback(() =>
    fetch('/api/onboarding')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Invalid response format');
        return data;
      })
      .then(data => {
        setOnboardingData(data);
        setError(null);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch onboarding data:', err);
        setError(err.message);
        setOnboardingData([]);
        setLoading(false);
      }), []);

  // Load on mount and whenever the user switches tabs, so tenant changes show up
  useEffect(() => { loadDashboard(); }, [activeTab, loadDashboard]);

  return (
    <div className="app">
      <header>
        <h1>Onboarding Dashboard</h1>
        <p>Customer Success Team - Internal Tool</p>
      </header>

      <nav className="tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {activeTab === 'dashboard' && (
          <DashboardTab data={onboardingData} loading={loading} error={error} />
        )}
        {activeTab === 'customer-info' && (
          <CustomerInfoTab customers={onboardingData} onSaved={loadDashboard} />
        )}
        {activeTab === 'data-mapping' && (
          <PlaceholderTab title="Data Mapping" description="Map customer data to platform configuration" />
        )}
        {activeTab === 'tenant-setup' && (
          <TenantSetupTab customers={onboardingData} onTenantChanged={loadDashboard} />
        )}
        {activeTab === 'import' && <ImportTab onImported={loadDashboard} />}
      </main>
    </div>
  );
}

function DashboardTab({ data, loading, error }) {
  if (loading) {
    return <div className="placeholder"><p>Loading...</p></div>;
  }

  if (error) {
    return (
      <div className="placeholder">
        <p style={{ color: '#dc2626' }}>⚠️ Failed to load onboarding data</p>
        <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="placeholder"><p>No customers in the onboarding queue</p></div>;
  }

  return (
    <div>
      <h2>Onboarding Queue</h2>
      <p style={{ color: '#6b7280', marginBottom: '20px' }}>
        {data.length} customer(s) awaiting onboarding
      </p>

      {data.map(item => (
        <div key={item.customerId} className="customer-card">
          <h3>{item.customerName}</h3>
          <div className="customer-meta">
            <span>📍 {item.customerRegion}</span>
            <span>🏭 {item.customerIndustry}</span>
            <span data-testid="tenant-summary">
              🏢 Tenant: {item.tenantStatus || 'none'}{item.tenantPlan ? ` (${item.tenantPlan})` : ''}
            </span>
          </div>

          <div className="progress-section">
            <ProgressBar percent={item.progressPercent} />
            <Checklist steps={item.steps} />
          </div>
        </div>
      ))}
    </div>
  );
}

const NEW_CUSTOMER = '';
const EMPTY_FORM = { name: '', region: '', industry: '' };

function CustomerInfoTab({ customers, onSaved }) {
  const [options, setOptions] = useState({ locations: [], segments: [] });
  const [selectedId, setSelectedId] = useState(NEW_CUSTOMER);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetch('/api/customer-options')
      .then(res => res.json())
      .then(setOptions)
      .catch(err => console.error('Failed to fetch customer options:', err));
  }, []);

  const select = (id) => {
    const c = customers.find(item => item.customerId === id);
    setSelectedId(id);
    setForm(c ? { name: c.customerName, region: c.customerRegion, industry: c.customerIndustry } : EMPTY_FORM);
    setFieldErrors({});
    setMessage(null);
  };

  const change = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setFieldErrors({});
    setMessage(null);
    try {
      const res = await fetch(selectedId ? `/api/customers/${selectedId}` : '/api/customers', {
        method: selectedId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFieldErrors(body.fields || {});
        setMessage({ error: true, text: body.fields ? 'Please fix the highlighted fields' : (body.error || `HTTP ${res.status}`) });
        return;
      }
      await onSaved();
      setSelectedId(body.id);
      setForm({ name: body.name, region: body.region, industry: body.industry });
      setMessage({ error: false, text: 'Customer saved' });
    } catch (err) {
      // Entered values stay in the form
      setMessage({ error: true, text: `Failed to save: ${err.message}` });
    }
  };

  const fieldError = (field) =>
    fieldErrors[field] && <p role="alert" style={{ color: '#dc2626', fontSize: '0.85rem' }}>{fieldErrors[field]}</p>;

  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: '12px', maxWidth: '420px' }}>
      <h2>Customer Info</h2>

      <label>
        Customer
        <select value={selectedId} onChange={(e) => select(e.target.value)} style={{ display: 'block', width: '100%' }}>
          <option value={NEW_CUSTOMER}>New customer</option>
          {customers.map(c => <option key={c.customerId} value={c.customerId}>{c.customerName}</option>)}
        </select>
      </label>

      <label>
        Company name
        <input value={form.name} onChange={change('name')} style={{ display: 'block', width: '100%' }} />
      </label>
      {fieldError('name')}

      <label>
        Location
        <select value={form.region} onChange={change('region')} style={{ display: 'block', width: '100%' }}>
          <option value="">Select a location</option>
          {options.locations.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>
      {fieldError('region')}

      <label>
        Segment
        <select value={form.industry} onChange={change('industry')} style={{ display: 'block', width: '100%' }}>
          <option value="">Select a segment</option>
          {options.segments.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      {fieldError('industry')}

      <button type="submit">{selectedId ? 'Save changes' : 'Add customer'}</button>
      {message && (
        <p role="status" style={{ color: message.error ? '#dc2626' : '#16a34a' }}>{message.text}</p>
      )}
    </form>
  );
}

function ImportTab({ onImported }) {
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState(null);

  const loadFile = async (e) => {
    const file = e.target.files[0];
    if (file) setCsv(await file.text());
    setResult(null);
    setMessage(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setResult(null);
    setMessage(null);
    try {
      const res = await fetch('/api/customers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(body.error || `HTTP ${res.status}`);
        return;
      }
      setResult(body);
      await onImported();
    } catch (err) {
      // The pasted CSV stays in the box so it can be retried
      setMessage(`Failed to import: ${err.message}`);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: '12px', maxWidth: '640px' }}>
      <h2>Import</h2>
      <p style={{ color: '#6b7280' }}>
        Add many customers at once from a CSV with the columns <code>name</code>, <code>location</code> and <code>segment</code>.
        Rows that fail validation are skipped and listed below; up to 500 rows per import.
      </p>

      <label>
        CSV file
        <input type="file" accept=".csv,text/csv" onChange={loadFile} style={{ display: 'block' }} />
      </label>

      <label>
        Or paste CSV
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={8}
          placeholder={'name,location,segment\nGlobex,EMEA,Manufacturing'}
          style={{ display: 'block', width: '100%', fontFamily: 'monospace' }}
        />
      </label>

      <button type="submit" disabled={!csv.trim()}>Import customers</button>

      {message && <p role="alert" style={{ color: '#dc2626' }}>{message}</p>}

      {result && (
        <div role="status">
          <p style={{ color: result.imported.length ? '#16a34a' : '#6b7280' }}>
            Imported {result.imported.length} customer(s), skipped {result.skipped.length}.
          </p>
          {result.skipped.length > 0 && (
            <ul style={{ color: '#dc2626', fontSize: '0.9rem' }}>
              {result.skipped.map(s => (
                <li key={s.row}>
                  Row {s.row}{s.name ? ` (${s.name})` : ''}: {Object.values(s.errors).join('; ')}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}

function ProgressBar({ percent }) {
  return (
    <div className="progress-bar-container">
      <div 
        className="progress-bar" 
        style={{ width: `${Math.max(percent, 0)}%` }}
      >
        {percent > 0 ? `${percent}%` : ''}
      </div>
    </div>
  );
}

function Checklist({ steps }) {
  return (
    <ul className="checklist">
      {steps.map(step => (
        <li key={step.id}>
          <span className={`step-status ${step.status}`}>
            {step.status === 'completed' ? '✓' : step.order}
          </span>
          <span>{step.name}</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#9ca3af' }}>
            {step.status.replace('_', ' ')}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PlaceholderTab({ title, description }) {
  return (
    <div className="placeholder">
      <h2>{title}</h2>
      <p>{description}</p>
      <p style={{ marginTop: '20px', fontSize: '0.9rem' }}>
        🚧 This section is ready to be built
      </p>
    </div>
  );
}

export default App;
