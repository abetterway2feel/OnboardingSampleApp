import React, { useState, useEffect, useCallback } from 'react';

const PLANS = ['starter', 'professional', 'enterprise'];
const POLL_INTERVAL_MS = 500;

async function readError(res) {
  try {
    return (await res.json()).error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function TenantSetupTab({ customers, onTenantChanged }) {
  const [customerId, setCustomerId] = useState(customers[0]?.customerId || '');
  const [tenant, setTenant] = useState(null);
  const [plan, setPlan] = useState(PLANS[0]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Returns the tenant (null when none exists yet); throws on request failure
  const fetchTenant = useCallback(async (id) => {
    const res = await fetch(`/api/tenants/${id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await readError(res));
    return res.json();
  }, []);

  // The customer list may arrive after the tab opens
  useEffect(() => {
    if (!customerId && customers.length > 0) setCustomerId(customers[0].customerId);
  }, [customerId, customers]);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTenant(customerId)
      .then(found => {
        if (cancelled) return;
        setTenant(found);
        if (found) setPlan(found.plan);
      })
      .catch(err => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [customerId, fetchTenant]);

  // Poll while provisioning; refresh the dashboard once it settles
  const status = tenant?.status;
  useEffect(() => {
    if (status !== 'provisioning') return;
    const timer = setInterval(() => {
      fetchTenant(customerId)
        .then(found => {
          if (!found) return;
          setTenant(found);
          if (found.status !== 'provisioning') onTenantChanged();
        })
        .catch(err => setError(err.message));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [status, customerId, fetchTenant, onTenantChanged]);

  async function start(action) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${customerId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'provision' ? JSON.stringify({ plan }) : undefined
      });
      if (!res.ok) throw new Error(await readError(res));
      setTenant(await res.json());
      onTenantChanged();
    } catch (err) {
      // The selected plan stays in the form so the user can try again
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (customers.length === 0) {
    return <div className="placeholder"><p>No customers in the onboarding queue</p></div>;
  }

  const canChoosePlan = !tenant || tenant.status === 'pending';
  const canProvision = canChoosePlan;
  const canRetry = tenant?.status === 'failed';

  return (
    <div className="tenant-setup">
      <h2>Tenant Setup</h2>
      <p style={{ color: '#6b7280', marginBottom: '20px' }}>Provision and configure the customer tenant</p>

      <div className="form-row">
        <label htmlFor="tenant-customer">Customer</label>
        <select
          id="tenant-customer"
          value={customerId}
          onChange={e => setCustomerId(e.target.value)}
        >
          {customers.map(c => (
            <option key={c.customerId} value={c.customerId}>{c.customerName}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <div className="form-row">
            <label htmlFor="tenant-plan">Plan</label>
            <select
              id="tenant-plan"
              value={plan}
              disabled={!canChoosePlan}
              onChange={e => setPlan(e.target.value)}
            >
              {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <p data-testid="tenant-status">
            Status: <span className={`tenant-status ${tenant?.status || 'pending'}`}>{tenant?.status || 'pending'}</span>
          </p>

          {tenant?.status === 'failed' && (
            <p className="tenant-failure" role="alert">
              Provisioning failed: {tenant.failureReason}
            </p>
          )}
          {tenant?.status === 'active' && (
            <p className="tenant-active">Tenant is active on the {tenant.plan} plan.</p>
          )}

          {canProvision && (
            <button className="action-button" disabled={submitting} onClick={() => start('provision')}>
              Provision
            </button>
          )}
          {canRetry && (
            <button className="action-button" disabled={submitting} onClick={() => start('retry')}>
              Retry
            </button>
          )}
          {tenant?.status === 'provisioning' && (
            <button className="action-button" disabled>Provisioning...</button>
          )}
        </>
      )}

      {error && <p className="form-error" role="alert">⚠️ {error}</p>}
    </div>
  );
}

export default TenantSetupTab;
