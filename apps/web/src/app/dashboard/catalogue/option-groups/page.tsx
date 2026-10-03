'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../../../lib/api';

type OptionGroup = {
  id: string;
  name: string;
  isRequired: boolean;
  allowPortions: boolean;
  options?: { option: { id: string; name: string }; displayOrder: number; extraChargeMinor: number }[];
};

type ReferenceData = {
  options: { id: string; name: string }[];
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
  isRequired: false,
  allowPortions: false,
  optionIds: [] as string[],
  optionOrderMap: {} as Record<string, string>,
  optionExtraMap: {} as Record<string, string>,
};

export default function OptionGroupsCataloguePage() {
  const [items, setItems] = useState<OptionGroup[]>([]);
  const [referenceData, setReferenceData] = useState<ReferenceData>({ options: [] });
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [groupsResponse, reference] = await Promise.all([
        apiRequest<{ items?: OptionGroup[] } | OptionGroup[]>('/catalogue/option-groups?page=1&limit=100'),
        apiRequest<ReferenceData>('/catalogue/reference-data'),
      ]);

      const nextItems = Array.isArray(groupsResponse)
        ? groupsResponse
        : (groupsResponse?.items ?? []);

      setItems(nextItems);
      setReferenceData(reference);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load option groups');
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveItem = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    try {
      const payload = {
        name: form.name.trim(),
        isRequired: form.isRequired,
        allowPortions: form.allowPortions,
        optionIds: form.optionIds.map((optionId) => ({
          optionId,
          displayOrder: Number(form.optionOrderMap[optionId] ?? 0),
          extraChargeMinor: Number(form.optionExtraMap[optionId] ?? 0),
        })),
      };

      if (!payload.name) throw new Error('Option group name is required.');

      if (form.id) {
        await apiRequest(`/catalogue/option-groups/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/catalogue/option-groups', { method: 'POST', body: JSON.stringify(payload) });
      }

      setForm(emptyForm);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save option group');
    }
  };

  const toggleItemList = (list: string[], value: string) => list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  return (
    <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>Option Groups</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Group related options and set selection rules.</p>
        </div>
        <Link href="/dashboard/catalogue" className="btn-secondary btn-sm">Back to catalogue</Link>
      </div>

      {error ? <div className="glass-panel" style={{ padding: '0.9rem 1rem', marginBottom: '1.2rem', color: '#fda4af' }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.9fr', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <form onSubmit={saveItem} style={{ display: 'grid', gap: '0.9rem' }}>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Option group name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={fieldStyle} placeholder="Enter option group name" required />
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={form.isRequired} onChange={(e) => setForm({ ...form, isRequired: e.target.checked })} />
                <span>Required</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={form.allowPortions} onChange={(e) => setForm({ ...form, allowPortions: e.target.checked })} />
                <span>Allow portions</span>
              </label>
            </div>

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Assigned options</div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {referenceData.options.map((item) => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 90px 90px', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="checkbox" checked={form.optionIds.includes(item.id)} onChange={() => setForm({ ...form, optionIds: toggleItemList(form.optionIds, item.id) })} />
                    <span>{item.name}</span>
                    <div style={{ display: 'grid', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Order</span>
                      <input type="number" min={0} value={form.optionOrderMap[item.id] ?? '0'} onChange={(e) => setForm({ ...form, optionOrderMap: { ...form.optionOrderMap, [item.id]: e.target.value } })} style={{ ...fieldStyle, padding: '0.5rem 0.5rem' }} />
                    </div>
                    <div style={{ display: 'grid', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Extra</span>
                      <input type="number" min={0} value={form.optionExtraMap[item.id] ?? '0'} onChange={(e) => setForm({ ...form, optionExtraMap: { ...form.optionExtraMap, [item.id]: e.target.value } })} style={{ ...fieldStyle, padding: '0.5rem 0.5rem' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn-primary">{form.id ? 'Update Group' : 'Create Group'}</button>
              <button type="button" className="btn-secondary" onClick={() => setForm(emptyForm)}>Reset</button>
            </div>
          </form>
        </div>

        <div style={{ display: 'grid', gap: '0.8rem' }}>
          {items.map((item) => (
            <div key={item.id} className="glass-panel" style={{ padding: '0.9rem 1rem' }}>
              <div style={{ fontWeight: 700 }}>{item.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>{item.isRequired ? 'Required' : 'Optional'} · {item.allowPortions ? 'Portions allowed' : 'No portions'}</div>
              <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.options?.map((entry) => entry.option.name).join(', ') || 'No assigned options'}</div>
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.7rem' }}>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setForm({
                  id: item.id,
                  name: item.name,
                  isRequired: item.isRequired,
                  allowPortions: item.allowPortions,
                  optionIds: item.options?.map((entry) => entry.option.id) ?? [],
                  optionOrderMap: Object.fromEntries((item.options ?? []).map((entry) => [entry.option.id, String(entry.displayOrder ?? 0)])),
                  optionExtraMap: Object.fromEntries((item.options ?? []).map((entry) => [entry.option.id, String(entry.extraChargeMinor ?? 0)])),
                })}>Edit</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
