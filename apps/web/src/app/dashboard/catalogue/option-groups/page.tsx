'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../../../lib/api';

type OptionGroup = {
  id: string;
  name: string;
  isRequired: boolean;
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
  optionIds: [] as string[],
  optionOrderMap: {} as Record<string, string>,
};

export default function OptionGroupsCataloguePage() {
  const [items, setItems] = useState<OptionGroup[]>([]);
  const [referenceData, setReferenceData] = useState<ReferenceData>({ options: [] });
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
    setMessage('');

    try {
      const payload = {
        name: form.name.trim(),
        isRequired: form.isRequired,
        optionIds: form.optionIds.map((optionId) => ({
          optionId,
          displayOrder: Number(form.optionOrderMap[optionId] ?? 0),
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
      setMessage(form.id ? 'Group updated.' : 'Group created. You can now add it to a dish.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save option group');
    }
  };

  const toggleItemList = (list: string[], value: string) => list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  return (
    <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Menu catalogue</span><h1 className="page-title">Add-on groups</h1>
          <p className="page-subtitle">Put related add-ons together so employees can choose one when ordering a dish.</p>
        </div>
        <Link href="/dashboard/catalogue" className="btn-secondary btn-sm">Back to catalogue</Link>
      </div>

      {error ? <div className="notice error" role="alert" style={{ marginBottom: '1.2rem' }}>{error}</div> : null}
      {message ? <div className="notice" role="status" style={{ marginBottom: '1.2rem' }}>{message}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <form onSubmit={saveItem} style={{ display: 'grid', gap: '0.9rem' }}>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Group name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={fieldStyle} placeholder="For example, Choose a side" required />
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={form.isRequired} onChange={(e) => setForm({ ...form, isRequired: e.target.checked })} />
                <span>Employee must choose from this group</span>
              </label>
            </div>

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Add-ons in this group</div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {referenceData.options.map((item) => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 90px', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="checkbox" checked={form.optionIds.includes(item.id)} onChange={() => setForm({ ...form, optionIds: toggleItemList(form.optionIds, item.id) })} />
                    <span>{item.name}</span>
                    <div style={{ display: 'grid', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Position</span>
                      <input type="number" min={0} value={form.optionOrderMap[item.id] ?? '0'} onChange={(e) => setForm({ ...form, optionOrderMap: { ...form.optionOrderMap, [item.id]: e.target.value } })} style={{ ...fieldStyle, padding: '0.5rem 0.5rem' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn-primary">{form.id ? 'Save changes' : 'Create group'}</button>
              <button type="button" className="btn-secondary" onClick={() => setForm(emptyForm)}>Clear form</button>
            </div>
          </form>
        </div>

        <div style={{ display: 'grid', gap: '0.8rem' }}>
          {items.map((item) => (
            <div key={item.id} className="glass-panel" style={{ padding: '0.9rem 1rem' }}>
              <div style={{ fontWeight: 700 }}>{item.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>{item.isRequired ? 'Required' : 'Optional'}</div>
              <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.options?.map((entry) => entry.option.name).join(', ') || 'No assigned options'}</div>
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.7rem' }}>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setForm({
                  id: item.id,
                  name: item.name,
                  isRequired: item.isRequired,
                  optionIds: item.options?.map((entry) => entry.option.id) ?? [],
                  optionOrderMap: Object.fromEntries((item.options ?? []).map((entry) => [entry.option.id, String(entry.displayOrder ?? 0)])),
                })}>Edit</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
