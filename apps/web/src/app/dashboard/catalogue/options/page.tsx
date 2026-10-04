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
  costPriceMinor: '0',
  isActive: true,
  allergenIds: [] as string[],
  dietaryTagIds: [] as string[],
};

export default function OptionsCataloguePage() {
  const [items, setItems] = useState<Option[]>([]);
  const [referenceData, setReferenceData] = useState<ReferenceData>({ allergens: [], dietaryTags: [] });
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

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

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        costPriceMinor: Number(form.costPriceMinor) || 0,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>Options</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Manage reusable add-ons.</p>
        </div>
        <Link href="/dashboard/catalogue" className="btn-secondary btn-sm">Back to catalogue</Link>
      </div>

      {error ? <div className="glass-panel" style={{ padding: '0.9rem 1rem', marginBottom: '1.2rem', color: '#fda4af' }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.9fr', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <form onSubmit={saveItem} style={{ display: 'grid', gap: '0.9rem' }}>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Option name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={fieldStyle} placeholder="Enter option name" required />
            </div>

            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...fieldStyle, minHeight: '90px' }} placeholder="Add a short description" />
            </div>

            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Cost price (minor)</label>
              <input type="number" value={form.costPriceMinor} onChange={(e) => setForm({ ...form, costPriceMinor: e.target.value })} style={fieldStyle} placeholder="0" />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span>Active</span>
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
              <button type="submit" className="btn-primary">{form.id ? 'Update Option' : 'Create Option'}</button>
              <button type="button" className="btn-secondary" onClick={() => setForm(emptyForm)}>Reset</button>
            </div>
          </form>
        </div>

        <div style={{ display: 'grid', gap: '0.8rem' }}>
          {items.map((item) => (
            <div key={item.id} className="glass-panel" style={{ padding: '0.9rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{item.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Cost: {item.costPriceMinor ?? 0}</div>
                </div>
                <span className={`badge ${item.isActive ? 'badge-admin' : 'badge-user'}`}>{item.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.7rem' }}>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setForm({ id: item.id, name: item.name, description: item.description ?? '', costPriceMinor: String(item.costPriceMinor ?? 0), isActive: item.isActive, allergenIds: item.allergies?.map((entry) => entry.allergen.id) ?? [], dietaryTagIds: item.dietaryTags?.map((entry) => entry.dietaryTag.id) ?? [] })}>Edit</button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => toggleActive(item.id)}>{item.isActive ? 'Deactivate' : 'Reactivate'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
