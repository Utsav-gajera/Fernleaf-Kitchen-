'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, FileText, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';

type Company = { id: string; name: string };
type Order = { id: string; deliveryDate: string; deliveryTime: string; totalMinor: number; status: string };
type Invoice = {
  id: string;
  status: 'UNPAID' | 'PAID';
  totalMinor: number;
  createdAt: string;
  paidAt?: string | null;
  company: Company;
  orders: Array<{ order: { id: string; totalMinor: number; status: string } }>;
};

const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;

export default function BillingPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadInvoices = useCallback(async () => {
    setInvoices(await apiRequest<Invoice[]>('/invoices'));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await apiRequest<{ items: Company[] }>('/companies?page=1&limit=100');
      setCompanies(response.items ?? []);
      await loadInvoices();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load billing data.');
    } finally {
      setLoading(false);
    }
  }, [loadInvoices]);

  const loadUninvoiced = useCallback(async (id: string) => {
    setCompanyId(id);
    setSelected([]);
    setMessage('');
    if (!id) {
      setOrders([]);
      return;
    }
    try {
      setOrders(await apiRequest<Order[]>(`/billing/companies/${id}/uninvoiced`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load uninvoiced orders.');
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const selectedTotal = useMemo(
    () => orders.filter((order) => selected.includes(order.id)).reduce((sum, order) => sum + order.totalMinor, 0),
    [orders, selected],
  );

  const createInvoice = async () => {
    if (!companyId || !selected.length) return;
    setMessage('');
    try {
      await apiRequest('/invoices', {
        method: 'POST',
        body: JSON.stringify({ companyId, orderIds: selected }),
      });
      setSelected([]);
      await Promise.all([loadUninvoiced(companyId), loadInvoices()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create invoice.');
    }
  };

  const markPaid = async (id: string) => {
    try {
      await apiRequest(`/invoices/${id}/paid`, { method: 'POST' });
      await loadInvoices();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to mark invoice paid.');
    }
  };

  const removeOrder = async (invoiceId: string, orderId: string) => {
    try {
      await apiRequest(`/invoices/${invoiceId}/orders/${orderId}`, { method: 'DELETE' });
      await loadInvoices();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to remove order from invoice.');
    }
  };

  return (
    <main className="container" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><FileText size={28} color="var(--accent-primary)" /><h1 style={{ margin: 0 }}>Billing</h1></div>
          <p className="text-muted" style={{ marginBottom: 0 }}>Create company invoices from confirmed billable orders.</p>
        </div>
        <button className="btn-secondary btn-sm" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Refresh</button>
      </div>

      <section className="glass-panel" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Create invoice</h2>
        <label className="form-label">Company
          <select className="form-input" value={companyId} onChange={(event) => void loadUninvoiced(event.target.value)}>
            <option value="">Select company</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </label>
        {companyId && <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
          {!orders.length ? <p className="text-muted">No uninvoiced billable orders for this company.</p> : orders.map((order) => (
            <label key={order.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}>
              <span><input type="checkbox" checked={selected.includes(order.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))} /> <strong>{order.id.slice(0, 8)}</strong> · {order.status} · {new Date(order.deliveryDate).toLocaleDateString()} {order.deliveryTime}</span>
              <strong>{money(order.totalMinor)}</strong>
            </label>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <strong>Selected total: {money(selectedTotal)}</strong>
            <button className="btn-primary" onClick={() => void createInvoice()} disabled={!selected.length}><FileText size={16} /> Create invoice</button>
          </div>
        </div>}
      </section>

      {message && <p style={{ color: '#fb7185' }}>{message}</p>}
      <section>
        <h2 style={{ fontSize: '1.2rem' }}>Invoices</h2>
        {!invoices.length ? <p className="text-muted">No invoices created yet.</p> : <div style={{ display: 'grid', gap: 12 }}>
          {invoices.map((invoice) => (
            <article className="glass-panel" key={invoice.id} style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div><strong>{invoice.company.name}</strong><div className="text-muted">{invoice.id.slice(0, 8)} · {new Date(invoice.createdAt).toLocaleDateString()} · {invoice.orders.length} order(s)</div><div style={{ display: 'grid', gap: 4, marginTop: 6 }}>{invoice.orders.map(({ order }) => <span className="text-muted" key={order.id}>{order.id.slice(0, 8)} · {money(order.totalMinor)} {invoice.status === 'UNPAID' && <button className="btn-secondary btn-sm" onClick={() => void removeOrder(invoice.id, order.id)}>Remove</button>}</span>)}</div></div>
                <span className="badge">{invoice.status}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}><strong>{money(invoice.totalMinor)}</strong>{invoice.status === 'UNPAID' && <button className="btn-primary btn-sm" onClick={() => void markPaid(invoice.id)}><Check size={15} /> Mark paid</button>}</div>
            </article>
          ))}
        </div>}
      </section>
    </main>
  );
}
