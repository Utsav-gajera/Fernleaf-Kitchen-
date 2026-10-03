'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, MapPin, RefreshCw, Truck } from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';

type Drop = {
  id: string;
  status: 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'KITCHEN_READY' | 'DISPATCH_READY';
  company: { name: string };
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  postalCode: string;
  deliveryTime: string;
  deliveryAt: string;
  deliveredAt?: string | null;
  onTime?: boolean | null;
  orders: Array<{ order: { addressInstructions?: string | null } }>;
};

export default function DriverPage() {
  const { user } = useAuth();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      setDrops(await apiRequest<Drop[]>('/driver/drops/today'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load your drops.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const remaining = drops.filter((drop) => drop.status !== 'DELIVERED');
  const completed = drops.filter((drop) => drop.status === 'DELIVERED');
  const next = remaining[0];

  const deliver = async (dropId: string) => {
    setWorkingId(dropId);
    setMessage('');
    try {
      await apiRequest(`/driver/drops/${dropId}/deliver`, { method: 'POST' });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to mark this drop delivered.');
    } finally {
      setWorkingId('');
    }
  };

  const instructions = (drop: Drop) => drop.orders
    .map(({ order }) => order.addressInstructions)
    .filter(Boolean)
    .join(' · ');

  const formatTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <main className="container" style={{ maxWidth: 680, paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Truck size={28} color="var(--accent-primary)" />
            <h1 style={{ margin: 0 }}>My deliveries</h1>
          </div>
          <p className="text-muted" style={{ marginBottom: 0 }}>Today · {drops.length} assigned drop(s)</p>
        </div>
        <button className="btn-secondary btn-sm" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Refresh</button>
      </div>

      {message && <p style={{ color: '#fb7185' }}>{message}</p>}
      <section className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <strong>Next delivery</strong>
          <span className="badge">{remaining.length} remaining</span>
        </div>
        {next ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{next.deliveryTime} · {next.company.name}</div>
            <p style={{ margin: '0.5rem 0' }}><MapPin size={15} style={{ verticalAlign: 'middle' }} /> {next.addressLine1}{next.addressLine2 ? `, ${next.addressLine2}` : ''}, {next.city}, {next.postalCode}</p>
            {instructions(next) && <p className="text-muted" style={{ margin: 0 }}>Instructions: {instructions(next)}</p>}
          </div>
        ) : <p className="text-muted" style={{ marginBottom: 0 }}>No remaining deliveries.</p>}
      </section>

      {loading ? <p className="text-muted">Loading your drops...</p> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {drops.map((drop) => (
            <article className="glass-panel" key={drop.id} style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <strong>{drop.deliveryTime} · {drop.company.name}</strong>
                  <p style={{ margin: '0.35rem 0' }}>{drop.addressLine1}{drop.addressLine2 ? `, ${drop.addressLine2}` : ''}, {drop.city}, {drop.postalCode}</p>
                </div>
                <span className="badge">{drop.status.replaceAll('_', ' ')}</span>
              </div>
              {instructions(drop) && <p className="text-muted" style={{ margin: '0.4rem 0' }}>{instructions(drop)}</p>}
              {drop.status === 'OUT_FOR_DELIVERY' && <button className="btn-primary" style={{ width: '100%', marginTop: 8, minHeight: 46 }} onClick={() => void deliver(drop.id)} disabled={workingId === drop.id}><CheckCircle2 size={17} /> Deliver</button>}
              {drop.status === 'DELIVERED' && <p style={{ color: '#86efac', margin: '0.5rem 0 0' }}>Delivered {drop.deliveredAt ? formatTime(drop.deliveredAt) : ''}{drop.onTime === true ? ' · On time' : drop.onTime === false ? ' · Late' : ''}</p>}
            </article>
          ))}
          {!drops.length && <p className="text-muted">No drops assigned to you today.</p>}
        </div>
      )}
      <p className="text-muted" style={{ marginTop: 16 }}>Completed: {completed.length} · Remaining: {remaining.length}</p>
    </main>
  );
}
