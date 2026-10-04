'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../../../lib/api';

type Option = {
  id: string;
  name: string;
  description?: string | null;
  costPriceMinor?: number;
  isActive: boolean;
  allergies?: { allergen: { id: string; name: string } }[];
  dietaryTags?: { dietaryTag: { id: string; name: string } }[];
};

type ReferenceData = {
  allergens: { id: string; name: string }[];
  dietaryTags: { id: string; name: string }[];
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 0.9rem',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(15,23,42,0.3)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box',
};

const emptyForm = {
  id: '',
  name: '',
  description: '',
  costPriceMinor: '0.00',
  isActive: true,
  allergenIds: [] as string[],
  dietaryTagIds: [] as string[],
};

export default function OptionsCataloguePage() {
  const [items, setItems] = useState<Option[]>([]);
  const [referenceData, setReferenceData] = useState<ReferenceData>({ allergens: [], dietaryTags: [] });
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [optionsResponse, reference] = await Promise.all([
        apiRequest<{ items?: Option[] } | Option[]>('/catalogue/options?page=1&limit=100'),
        apiRequest<ReferenceData>('/catalogue/reference-data'),
      ]);

      const nextItems = Array.isArray(optionsResponse)
        ? optionsResponse
        : (optionsResponse?.items ?? []);

      setItems(nextItems);
      setReferenceData(reference);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load options');
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveItem = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const cost = Number(form.costPriceMinor);
      if (!Number.isFinite(cost) || cost < 0) throw new Error('Enter a valid cost in dollars.');
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        costPriceMinor: Math.round(cost * 100),
        isActive: form.isActive,
        allergenIds: form.allergenIds,
        dietaryTagIds: form.dietaryTagIds,
      };

      if (!payload.name) throw new Error('Option name is required.');

      if (form.id) {
        await apiRequest(`/catalogue/options/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/catalogue/options', { method: 'POST', body: JSON.stringify(payload) });
      }

      setForm(emptyForm);
      await loadData();
      setMessage(form.id ? 'Add-on updated.' : 'Add-on created. Add another or choose one to edit.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save option');
    }
  };

  const toggleItemList = (list: string[], value: string) => list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const toggleActive = async (optionId: string) => {
    try {
      setError('');
      await apiRequest(`/catalogue/options/${optionId}/toggle-active`, { method: 'PATCH' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update option status');
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Menu catalogue</span><h1 className="page-title">Add-ons</h1>
          <p className="page-subtitle">Create extras such as sides and drinks, then add them to groups for dishes.</p>
        </div>
        <Link href="/dashboard/catalogue" className="btn-secondary btn-sm">Back to catalogue</Link>
      </div>

      {error ? <div className="notice error" role="alert" style={{ marginBottom: '1.2rem' }}>{error}</div> : null}
      {message ? <div className="notice" role="status" style={{ marginBottom: '1.2rem' }}>{message}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <form onSubmit={saveItem} style={{ display: 'grid', gap: '0.9rem' }}>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Add-on name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={fieldStyle} placeholder="For example, Side salad" required />
            </div>

            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...fieldStyle, minHeight: '90px' }} placeholder="Add a short description" />
            </div>

            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Cost to make ($)</label>
              <input type="number" min="0" step="0.01" value={form.costPriceMinor} onChange={(e) => setForm({ ...form, costPriceMinor: e.target.value })} style={fieldStyle} placeholder="0.00" />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span>Available as an add-on</span>
            </label>

            <div style={{ display: 'grid', gap: '0.4rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Allergens</div>
              <div style={{ display: 'grid', gap: '0.45rem', maxHeight: '170px', overflow: 'auto' }}>
                {referenceData.allergens.map((item) => (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <input type="checkbox" checked={form.allergenIds.includes(item.id)} onChange={() => setForm({ ...form, allergenIds: toggleItemList(form.allergenIds, item.id) })} />
                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '0.4rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Dietary tags</div>
              <div style={{ display: 'grid', gap: '0.45rem', maxHeight: '170px', overflow: 'auto' }}>
                {referenceData.dietaryTags.map((item) => (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <input type="checkbox" checked={form.dietaryTagIds.includes(item.id)} onChange={() => setForm({ ...form, dietaryTagIds: toggleItemList(form.dietaryTagIds, item.id) })} />
                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn-primary">{form.id ? 'Save changes' : 'Create add-on'}</button>
              <button type="button" className="btn-secondary" onClick={() => setForm(emptyForm)}>Clear form</button>
            </div>
          </form>
        </div>

        <div style={{ display: 'grid', gap: '0.8rem' }}>
          {items.map((item) => (
            <div key={item.id} className="glass-panel" style={{ padding: '0.9rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{item.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Cost to make: ${((item.costPriceMinor ?? 0) / 100).toFixed(2)}</div>
                </div>
                <span className={`badge ${item.isActive ? 'badge-admin' : 'badge-user'}`}>{item.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.7rem' }}>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setForm({ id: item.id, name: item.name, description: item.description ?? '', costPriceMinor: ((item.costPriceMinor ?? 0) / 100).toFixed(2), isActive: item.isActive, allergenIds: item.allergies?.map((entry) => entry.allergen.id) ?? [], dietaryTagIds: item.dietaryTags?.map((entry) => entry.dietaryTag.id) ?? [] })}>Edit</button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => toggleActive(item.id)}>{item.isActive ? 'Deactivate' : 'Reactivate'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
