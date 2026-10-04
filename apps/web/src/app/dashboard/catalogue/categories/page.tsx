'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../../../lib/api';

type Category = {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  isSecret: boolean;
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
  displayOrder: '0',
  isActive: true,
  isSecret: false,
};

export default function CategoriesCataloguePage() {
  const [items, setItems] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    try {
      const data = await apiRequest<Category[]>('/catalogue/categories');
      setItems(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load categories');
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
        displayOrder: Number(form.displayOrder) || 0,
        isActive: form.isActive,
        isSecret: form.isSecret,
      };

      if (!payload.name) throw new Error('Category name is required.');

      if (form.id) {
        await apiRequest(`/catalogue/categories/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/catalogue/categories', { method: 'POST', body: JSON.stringify(payload) });
      }

      setForm(emptyForm);
      await loadData();
      setMessage(form.id ? 'Category updated.' : 'Category created. You can now assign dishes to it.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save category');
    }
  };

  const toggleActive = async (categoryId: string) => {
    try {
      setError('');
      setMessage('');
      await apiRequest(`/catalogue/categories/${categoryId}/toggle-active`, { method: 'PATCH' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update category status');
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Menu catalogue</span><h1 className="page-title">Categories</h1>
          <p className="page-subtitle">Create sections to help employees find dishes on the menu.</p>
        </div>
        <Link href="/dashboard/catalogue" className="btn-secondary btn-sm">Back to catalogue</Link>
      </div>

      {error ? <div className="notice error" role="alert" style={{ marginBottom: '1.2rem' }}>{error}</div> : null}
      {message ? <div className="notice" role="status" style={{ marginBottom: '1.2rem' }}>{message}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <form onSubmit={saveItem} style={{ display: 'grid', gap: '0.9rem' }}>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Category name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={fieldStyle} placeholder="Enter category name" required />
            </div>

            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Menu position (lower numbers appear first)</label>
              <input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} style={fieldStyle} placeholder="0" />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span>Show on the menu</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input type="checkbox" checked={form.isSecret} onChange={(e) => setForm({ ...form, isSecret: e.target.checked })} />
              <span>Hidden unless opened directly</span>
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn-primary">{form.id ? 'Save changes' : 'Create category'}</button>
              <button type="button" className="btn-secondary" onClick={() => setForm(emptyForm)}>Clear form</button>
            </div>
          </form>
        </div>

        <div style={{ display: 'grid', gap: '0.8rem' }}>
          {items.map((item) => (
            <div key={item.id} className="glass-panel" style={{ padding: '0.9rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontWeight: 700 }}>{item.name}</div>
                <span className={`badge ${item.isActive ? 'badge-admin' : 'badge-user'}`}>{item.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.3rem' }}>Order: {item.displayOrder}</div>
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.7rem' }}>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setForm({ id: item.id, name: item.name, displayOrder: String(item.displayOrder), isActive: item.isActive, isSecret: item.isSecret })}>Edit</button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => toggleActive(item.id)}>{item.isActive ? 'Deactivate' : 'Reactivate'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
