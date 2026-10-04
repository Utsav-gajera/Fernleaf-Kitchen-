'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../../../lib/api';

type ReferenceData = {
  allergens: { id: string; name: string; description?: string | null }[];
  dietaryTags: { id: string; name: string; description?: string | null }[];
  kitchenStations: { id: string; name: string; description?: string | null }[];
};

const emptyForm = { name: '', description: '' };

export default function ReferenceDataCataloguePage() {
  const [data, setData] = useState<ReferenceData>({ allergens: [], dietaryTags: [], kitchenStations: [] });
  const [allergenForm, setAllergenForm] = useState(emptyForm);
  const [dietaryForm, setDietaryForm] = useState(emptyForm);
  const [stationForm, setStationForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      const reference = await apiRequest<ReferenceData>('/catalogue/reference-data');
      setData(reference);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reference data');
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveItem = async (type: 'allergen' | 'dietary' | 'station', event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    try {
      const forms = {
        allergen: allergenForm,
        dietary: dietaryForm,
        station: stationForm,
      }[type];

      const endpoint = {
        allergen: '/catalogue/allergens',
        dietary: '/catalogue/dietary-tags',
        station: '/catalogue/kitchen-stations',
      }[type];

      const payload = {
        name: forms.name.trim(),
        description: forms.description.trim() || undefined,
      };

      if (!payload.name) throw new Error('Name is required.');
      await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(payload) });

      setAllergenForm(emptyForm);
      setDietaryForm(emptyForm);
      setStationForm(emptyForm);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save reference item');
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Menu catalogue</span><h1 className="page-title">Dietary &amp; kitchen details</h1>
          <p className="page-subtitle">Set up the labels and prep stations you can use when creating dishes and add-ons.</p>
        </div>
        <Link href="/dashboard/catalogue" className="btn-secondary btn-sm">Back to catalogue</Link>
      </div>

      {error ? <div className="notice error" role="alert" style={{ marginBottom: '1.2rem' }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>Allergens</h2><p className="help-note" style={{ marginBottom: '0.8rem' }}>Help people avoid ingredients they cannot eat.</p>
          <form onSubmit={(e) => saveItem('allergen', e)} style={{ display: 'grid', gap: '0.7rem' }}>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Allergen name</label>
              <input value={allergenForm.name} onChange={(e) => setAllergenForm({ ...allergenForm, name: e.target.value })} style={{ width: '100%', padding: '0.75rem 0.9rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.3)', color: 'var(--text-primary)' }} placeholder="Enter allergen name" />
            </div>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Description</label>
              <textarea value={allergenForm.description} onChange={(e) => setAllergenForm({ ...allergenForm, description: e.target.value })} style={{ width: '100%', minHeight: '70px', padding: '0.75rem 0.9rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.3)', color: 'var(--text-primary)' }} placeholder="Add a description" />
            </div>
            <button type="submit" className="btn-primary">Add allergen</button>
          </form>
          <ul style={{ margin: '0.9rem 0 0', paddingLeft: '1.2rem', color: 'var(--text-muted)' }}>
            {data.allergens.map((item) => <li key={item.id}>{item.name}</li>)}
          </ul>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>Dietary labels</h2><p className="help-note" style={{ marginBottom: '0.8rem' }}>Show which dishes fit a dietary preference.</p>
          <form onSubmit={(e) => saveItem('dietary', e)} style={{ display: 'grid', gap: '0.7rem' }}>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Dietary tag name</label>
              <input value={dietaryForm.name} onChange={(e) => setDietaryForm({ ...dietaryForm, name: e.target.value })} style={{ width: '100%', padding: '0.75rem 0.9rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.3)', color: 'var(--text-primary)' }} placeholder="Enter dietary tag" />
            </div>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Description</label>
              <textarea value={dietaryForm.description} onChange={(e) => setDietaryForm({ ...dietaryForm, description: e.target.value })} style={{ width: '100%', minHeight: '70px', padding: '0.75rem 0.9rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.3)', color: 'var(--text-primary)' }} placeholder="Add a description" />
            </div>
            <button type="submit" className="btn-primary">Add dietary tag</button>
          </form>
          <ul style={{ margin: '0.9rem 0 0', paddingLeft: '1.2rem', color: 'var(--text-muted)' }}>
            {data.dietaryTags.map((item) => <li key={item.id}>{item.name}</li>)}
          </ul>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>Kitchen stations</h2><p className="help-note" style={{ marginBottom: '0.8rem' }}>Route dishes to the right preparation area.</p>
          <form onSubmit={(e) => saveItem('station', e)} style={{ display: 'grid', gap: '0.7rem' }}>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Kitchen station name</label>
              <input value={stationForm.name} onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })} style={{ width: '100%', padding: '0.75rem 0.9rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.3)', color: 'var(--text-primary)' }} placeholder="Enter kitchen station" />
            </div>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Description</label>
              <textarea value={stationForm.description} onChange={(e) => setStationForm({ ...stationForm, description: e.target.value })} style={{ width: '100%', minHeight: '70px', padding: '0.75rem 0.9rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.3)', color: 'var(--text-primary)' }} placeholder="Add a description" />
            </div>
            <button type="submit" className="btn-primary">Add station</button>
          </form>
          <ul style={{ margin: '0.9rem 0 0', paddingLeft: '1.2rem', color: 'var(--text-muted)' }}>
            {data.kitchenStations.map((item) => <li key={item.id}>{item.name}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
