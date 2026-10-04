'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChefHat, CirclePlay, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';

type KitchenUnit = {
  id: string;
  orderId: string;
  combinationId: string;
  dishNameSnapshot: string;
  skuSnapshot: string;
  optionsSnapshot: string;
  stationId?: string | null;
  stationNameSnapshot?: string | null;
  quantity: number;
  status: 'PENDING' | 'STARTED' | 'DONE';
  startedAt?: string | null;
  completedAt?: string | null;
  plannedDispatchAt: string;
  plannedKitchenReadyAt: string;
  late: boolean;
  atRisk: boolean;
  order: {
    id: string;
    deliveryDate: string;
    deliveryTime: string;
    kitchenStartedAt?: string | null;
    kitchenReadyAt?: string | null;
  };
};
type KitchenStation = { id: string; name: string };

const formatTime = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function KitchenPage() {
  const { user } = useAuth();
  const [date, setDate] = useState('');
  const [station, setStation] = useState('');
  const [units, setUnits] = useState<KitchenUnit[]>([]);
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState('');
  const [message, setMessage] = useState('');

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams({ date });
      if (station) params.set('station', station);
      const [board, stationList] = await Promise.all([
        apiRequest<KitchenUnit[]>(`/kitchen-board?${params.toString()}`),
        apiRequest<KitchenStation[]>('/kitchen/stations'),
      ]);
      setUnits(board);
      setStations(stationList);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load the kitchen board.');
    } finally {
      setLoading(false);
    }
  }, [date, station]);

  useEffect(() => {
    if (!user) return;
    void apiRequest<{ date?: string }>('/dashboard')
      .then((dashboard) => setDate(dashboard.date ?? ''))
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to determine kitchen date.'));
  }, [user]);

  useEffect(() => {
    if (user && date) void loadBoard();
  }, [user, date, loadBoard]);

  const columns = ['PENDING', 'STARTED', 'DONE'] as const;

  const updateStatus = async (unit: KitchenUnit, status: 'STARTED' | 'DONE') => {
    setWorkingId(unit.id);
    setMessage('');
    try {
      await apiRequest(`/kitchen/units/${unit.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadBoard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update the kitchen unit.');
    } finally {
      setWorkingId('');
    }
  };

  return (
    <main className="container kitchen-container">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow"><ChefHat size={15} /> Food preparation</span>
          <h1 className="page-title">Kitchen board</h1>
          <p className="page-subtitle">Start dishes in “To prepare” and move them to “Completed” when they are ready.</p>
        </div>
        <button className="btn-secondary" onClick={() => void loadBoard()} disabled={loading} style={{ minHeight: 42 }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <section className="kitchen-toolbar" style={{ marginBottom: '1.25rem' }}>
        <label style={{ minWidth: 180 }}>
          Delivery date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label style={{ minWidth: 180 }}>
          Station
          <select value={station} onChange={(event) => setStation(event.target.value)}>
            <option value="">All stations</option>
            {stations.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
          </select>
        </label>
        {message && <p style={{ color: '#fb7185', margin: 0 }}>{message}</p>}
      </section>

      {loading ? <div className="empty-state">Loading kitchen work…</div> : (
        <div className="kitchen-columns">
          {columns.map((column) => (
            <section className={`kitchen-column ${column.toLowerCase()}`} key={column}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{column === 'PENDING' ? 'To prepare' : column === 'STARTED' ? 'In progress' : 'Completed'}</h2>
                <span className="badge">{units.filter((unit) => unit.status === column).length}</span>
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                {units.filter((unit) => unit.status === column).map((unit) => (
                  <article className="kitchen-unit" key={unit.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong>{unit.dishNameSnapshot}</strong>
                      {unit.status !== 'DONE' && (unit.late || unit.atRisk) && (
                        <span className="badge" style={{ color: unit.late ? '#fb7185' : '#fbbf24' }}>
                          {unit.late ? 'Late' : 'At risk'}
                        </span>
                      )}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: 5 }}>
                      {unit.stationNameSnapshot || 'No station assigned'} · {unit.quantity} {unit.quantity === 1 ? 'serving' : 'servings'}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: 5 }}>
                      Ready by {formatTime(unit.plannedKitchenReadyAt)} · Leaves kitchen by {formatTime(unit.plannedDispatchAt)}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                      {unit.status === 'PENDING' && (
                        <button className="btn-primary btn-sm" onClick={() => void updateStatus(unit, 'STARTED')} disabled={workingId === unit.id}>
                          <CirclePlay size={14} /> Start
                        </button>
                      )}
                      {unit.status !== 'DONE' && (
                        <button className="btn-secondary btn-sm" onClick={() => void updateStatus(unit, 'DONE')} disabled={workingId === unit.id}>
                          <CheckCircle2 size={14} /> Complete
                        </button>
                      )}
                    </div>
                  </article>
                ))}
                {units.every((unit) => unit.status !== column) && (
                  <p className="text-muted">
                    {column === 'PENDING' && units.length === 0
                      ? 'No dishes to prepare for this date.'
                      : column === 'DONE' ? 'Completed dishes will appear here.' : 'Nothing here yet.'}
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
