'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Truck, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { hasCapability } from '../../../lib/access';
import { statusLabel } from '../../../lib/presentation';

type Driver = { id: string; name?: string | null; email: string };
type Drop = {
  id: string;
  status: 'KITCHEN_READY' | 'DISPATCH_READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  company: { id: string; name: string };
  driver?: Driver | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  postalCode: string;
  deliveryTime: string;
  deliveryAt: string;
  orders: Array<{ order: { id: string; totalMinor: number; employee: { id: string; name: string } } }>;
};

const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;

export default function DispatchPage() {
  const { user } = useAuth();
  const canOverrideOrders = user ? hasCapability(user.role, 'ORDER_OVERRIDE') : false;
  const [date, setDate] = useState('');
  const [drops, setDrops] = useState<Drop[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [dropList, driverList] = await Promise.all([
        apiRequest<Drop[]>(`/dispatch-board?date=${encodeURIComponent(date)}`),
        apiRequest<Driver[]>('/dispatch-drivers'),
      ]);
      setDrops(dropList);
      setDrivers(driverList);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load dispatch board.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (!user) return;
    void apiRequest<{ date?: string }>('/dashboard')
      .then((dashboard) => setDate(dashboard.date ?? ''))
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to determine kitchen date.'));
  }, [user]);

  useEffect(() => {
    if (user && date) void load();
  }, [user, date, load]);

  const command = async (id: string, action: 'assign-driver' | 'dispatch-ready' | 'out-for-delivery' | 'delivered', driverId?: string) => {
    try {
      await apiRequest(`/drops/${id}/${action}`, {
        method: 'POST',
        body: action === 'assign-driver' ? JSON.stringify({ driverId }) : undefined,
      });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update this delivery.');
    }
  };

  return (
    <main className="container" style={{ paddingBottom: '5rem' }}>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow"><Truck size={15} /> Delivery operations</span>
          <h1 className="page-title">Dispatch board</h1>
          <p className="page-subtitle">Each delivery card brings together orders going to the same place at the same time.</p>
        </div>
        <button className="btn-secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Refresh</button>
      </div>
      <section className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'end', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <label className="form-label">Delivery date<input className="form-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        {message && <p style={{ color: '#fb7185', margin: 0 }}>{message}</p>}
      </section>
      {loading ? <div className="empty-state">Loading deliveries…</div> : !drops.length ? <div className="empty-state">No deliveries are ready for this date. Try another date or check the kitchen board.</div> : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {drops.map((drop) => (
            <article className="glass-panel" key={drop.id} style={{ padding: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{drop.company.name} · {drop.deliveryTime}</h2>
                  <p className="text-muted" style={{ margin: '0.4rem 0' }}>{drop.addressLine1}{drop.addressLine2 ? `, ${drop.addressLine2}` : ''}, {drop.city}, {drop.postalCode}</p>
                </div>
                <span className="badge badge-cloud">{statusLabel(drop.status)}</span>
              </div>
              <div className="text-muted" style={{ margin: '0.6rem 0' }}>
                {drop.orders.length} {drop.orders.length === 1 ? 'order' : 'orders'} · {money(drop.orders.reduce((total, item) => total + item.order.totalMinor, 0))}
                {drop.driver ? ` · Driver: ${drop.driver.name || drop.driver.email}` : ' · Driver needed'}
              </div>
              <div style={{ display: 'grid', gap: 4, marginBottom: '0.8rem' }}>
                {drop.orders.map(({ order }) => <span className="text-muted" key={order.id}>{order.employee.name}</span>)}
              </div>
              {drop.status === 'KITCHEN_READY' && <p className="help-note" style={{ marginBottom: 10 }}>Next: choose a driver, then mark this delivery ready to send.</p>}
              {drop.status === 'DISPATCH_READY' && <p className="help-note" style={{ marginBottom: 10 }}>{drop.driver ? 'Ready to leave. Send this delivery out when the driver departs.' : 'Choose a driver before this delivery can leave.'}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {drop.status === 'KITCHEN_READY' && (
                  <>
                    <select className="form-input" style={{ maxWidth: 260 }} value={drop.driver?.id ?? ''} onChange={(event) => { if (event.target.value) void command(drop.id, 'assign-driver', event.target.value); }}>
                      <option value="">Assign driver</option>
                      {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name || driver.email}</option>)}
                    </select>
                    <button className="btn-secondary btn-sm" onClick={() => void command(drop.id, 'dispatch-ready')}>Ready to dispatch</button>
                  </>
                )}
                {drop.status === 'DISPATCH_READY' && (
                  <>
                    <select className="form-input" style={{ maxWidth: 260 }} value={drop.driver?.id ?? ''} onChange={(event) => { if (event.target.value) void command(drop.id, 'assign-driver', event.target.value); }}>
                      <option value="">Assign driver</option>
                      {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name || driver.email}</option>)}
                    </select>
                    <button className="btn-primary btn-sm" disabled={!drop.driver} title={drop.driver ? undefined : 'Assign a driver before sending this drop out for delivery.'} onClick={() => void command(drop.id, 'out-for-delivery')}>Out for delivery</button>
                  </>
                )}
                {drop.status === 'OUT_FOR_DELIVERY' && canOverrideOrders && <button className="btn-secondary btn-sm" onClick={() => void command(drop.id, 'delivered')}>Mark delivered for driver</button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
