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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save category');
    }
  };

  const toggleActive = async (categoryId: string) => {
    await apiRequest(`/catalogue/categories/${categoryId}/toggle-active`, { method: 'PATCH' });
    await loadData();
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>Categories</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Organize menu sections and display order.</p>
        </div>
        <Link href="/dashboard/catalogue" className="btn-secondary btn-sm">Back to catalogue</Link>
      </div>

      {error ? <div className="glass-panel" style={{ padding: '0.9rem 1rem', marginBottom: '1.2rem', color: '#fda4af' }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.9fr', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <form onSubmit={saveItem} style={{ display: 'grid', gap: '0.9rem' }}>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Category name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={fieldStyle} placeholder="Enter category name" required />
            </div>

            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Display order</label>
              <input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} style={fieldStyle} placeholder="0" />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span>Active</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input type="checkbox" checked={form.isSecret} onChange={(e) => setForm({ ...form, isSecret: e.target.checked })} />
              <span>Secret category</span>
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn-primary">{form.id ? 'Update Category' : 'Create Category'}</button>
              <button type="button" className="btn-secondary" onClick={() => setForm(emptyForm)}>Reset</button>
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
