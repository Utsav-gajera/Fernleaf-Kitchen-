'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../../../lib/api';

type Dish = {
  id: string;
  name: string;
  sku: string;
  description?: string | null;
  image?: string | null;
  temperature?: 'HOT' | 'COLD';
  costPriceMinor?: number;
  station?: { id: string; name: string } | null;
  minQuantity?: number | null;
  isActive: boolean;
  allergies?: { allergen: { id: string; name: string } }[];
  dietaryTags?: { dietaryTag: { id: string; name: string } }[];
  categories?: { category: { id: string; name: string }; displayOrder: number; isActive: boolean }[];
  optionGroups?: {
    displayOrder: number;
    optionGroup: { id: string; name: string; isRequired: boolean };
  }[];
};

type ReferenceData = {
  allergens: { id: string; name: string }[];
  dietaryTags: { id: string; name: string }[];
  kitchenStations: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  optionGroups: { id: string; name: string }[];
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

const emptyDishForm = {
  id: '',
  name: '',
  description: '',
  imageUrl: '',
  sku: '',
  temperature: 'HOT',
  costPriceMinor: '0.00',
  stationId: '',
  minQuantity: '0',
  isActive: true,
  allergenIds: [] as string[],
  dietaryTagIds: [] as string[],
  categoryIds: [] as string[],
  categoryOrders: {} as Record<string, string>,
  optionGroupIds: [] as string[],
  optionGroupOrders: {} as Record<string, string>,
};

export default function DishesCataloguePage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [referenceData, setReferenceData] = useState<ReferenceData>({
    allergens: [],
    dietaryTags: [],
    kitchenStations: [],
    categories: [],
    optionGroups: [],
  });
  const [dishForm, setDishForm] = useState(emptyDishForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [dishData, reference] = await Promise.all([
        apiRequest<{ items: Dish[] }>('/catalogue/dishes?page=1&limit=50'),
        apiRequest<ReferenceData>('/catalogue/reference-data'),
      ]);
      setDishes(dishData.items ?? []);
      setReferenceData(reference);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dishes');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleItemList = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const saveDish = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const cost = Number(dishForm.costPriceMinor);
      if (!Number.isFinite(cost) || cost < 0) throw new Error('Enter a valid cost in dollars.');
      const payload = {
        name: dishForm.name.trim(),
        description: dishForm.description.trim() || undefined,
        imageUrl: dishForm.imageUrl.trim() || undefined,
        sku: dishForm.sku.trim() || undefined,
        temperature: dishForm.temperature,
        costPriceMinor: Math.round(cost * 100),
        stationId: dishForm.stationId || undefined,
        minQuantity: Number(dishForm.minQuantity) || undefined,
        isActive: dishForm.isActive,
        allergenIds: dishForm.allergenIds,
        dietaryTagIds: dishForm.dietaryTagIds,
        categoryAssignments: dishForm.categoryIds.map((id) => ({
          categoryId: id,
          displayOrder: Number(dishForm.categoryOrders[id] ?? 0),
          isActive: true,
        })),
        optionGroups: dishForm.optionGroupIds.map((id) => ({
          optionGroupId: id,
          displayOrder: Number(dishForm.optionGroupOrders[id] ?? 0),
        })),
      };

      if (!payload.name) throw new Error('Dish name is required.');
      if (!payload.sku) throw new Error('Dish SKU is required.');

      if (dishForm.id) {
        await apiRequest(`/catalogue/dishes/${dishForm.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/catalogue/dishes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setDishForm(emptyDishForm);
      await loadData();
      setMessage(dishForm.id ? 'Dish updated. Your changes are saved.' : 'Dish created. Add another dish or choose one to edit.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save dish');
    }
  };

  const toggleDishActive = async (dishId: string) => {
    try {
      setError('');
      setMessage('');
      await apiRequest(`/catalogue/dishes/${dishId}/toggle-active`, { method: 'PATCH' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update dish status');
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Menu catalogue</span>
          <h1 className="page-title">Dishes</h1>
          <p className="page-subtitle">Add the basics, then connect each dish to categories and the choices employees can make.</p>
        </div>
        <Link href="/dashboard/catalogue" className="btn-secondary btn-sm">Back to catalogue</Link>
      </div>

      {error ? <div className="notice error" role="alert" style={{ marginBottom: '1.2rem' }}>{error}</div> : null}
      {message ? <div className="notice" role="status" style={{ marginBottom: '1.2rem' }}>{message}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <form onSubmit={saveDish} style={{ display: 'grid', gap: '0.9rem' }}>
            <div><h2 style={{ fontSize: '1.15rem' }}>{dishForm.id ? 'Edit dish' : 'Create a dish'}</h2><p className="help-note">A name and unique dish code are required. The rest can be updated later.</p></div>
            <label className="form-label">Dish name<input value={dishForm.name} onChange={(e) => setDishForm({ ...dishForm, name: e.target.value })} style={fieldStyle} placeholder="For example, Garden lunch bowl" required /></label>
            <label className="form-label">Dish code<input value={dishForm.sku} onChange={(e) => setDishForm({ ...dishForm, sku: e.target.value })} style={fieldStyle} placeholder="For example, BOWL-001" required /><span className="help-note">Use a unique code to identify this dish.</span></label>
            <label className="form-label">Description<textarea value={dishForm.description} onChange={(e) => setDishForm({ ...dishForm, description: e.target.value })} style={{ ...fieldStyle, minHeight: '90px' }} placeholder="What is in this dish?" /></label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gap: '0.3rem' }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Temperature</label>
                <select value={dishForm.temperature} onChange={(e) => setDishForm({ ...dishForm, temperature: e.target.value as 'HOT' | 'COLD' })} style={fieldStyle}>
                  <option value="HOT">HOT</option>
                  <option value="COLD">COLD</option>
                </select>
              </div>
              <div style={{ display: 'grid', gap: '0.3rem' }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Cost to make ($)</label>
                <input type="number" min="0" step="0.01" value={dishForm.costPriceMinor} onChange={(e) => setDishForm({ ...dishForm, costPriceMinor: e.target.value })} style={fieldStyle} placeholder="0.00" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gap: '0.3rem' }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Kitchen station</label>
                <select value={dishForm.stationId} onChange={(e) => setDishForm({ ...dishForm, stationId: e.target.value })} style={fieldStyle}>
                  <option value="">No station</option>
                  {referenceData.kitchenStations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gap: '0.3rem' }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Minimum order quantity</label>
                <input type="number" value={dishForm.minQuantity} onChange={(e) => setDishForm({ ...dishForm, minQuantity: e.target.value })} style={fieldStyle} placeholder="0" />
              </div>
            </div>
            <label className="form-label">Dish image link (optional)<input type="url" value={dishForm.imageUrl} onChange={(e) => setDishForm({ ...dishForm, imageUrl: e.target.value })} style={fieldStyle} placeholder="https://…" /></label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input type="checkbox" checked={dishForm.isActive} onChange={(e) => setDishForm({ ...dishForm, isActive: e.target.checked })} />
              <span>Available on the menu</span>
            </label>

            <div style={{ display: 'grid', gap: '0.4rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Allergens</div>
              <div style={{ display: 'grid', gap: '0.45rem', maxHeight: '170px', overflow: 'auto' }}>
                {referenceData.allergens.map((item) => (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <input type="checkbox" checked={dishForm.allergenIds.includes(item.id)} onChange={() => setDishForm({ ...dishForm, allergenIds: toggleItemList(dishForm.allergenIds, item.id) })} />
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
                    <input type="checkbox" checked={dishForm.dietaryTagIds.includes(item.id)} onChange={() => setDishForm({ ...dishForm, dietaryTagIds: toggleItemList(dishForm.dietaryTagIds, item.id) })} />
                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '0.4rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Categories</div>
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                {referenceData.categories.map((category) => (
                  <label key={category.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 70px', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="checkbox" checked={dishForm.categoryIds.includes(category.id)} onChange={() => setDishForm({ ...dishForm, categoryIds: toggleItemList(dishForm.categoryIds, category.id) })} />
                    <span>{category.name}</span>
                    <input type="number" min={0} value={dishForm.categoryOrders[category.id] ?? '0'} onChange={(e) => setDishForm({ ...dishForm, categoryOrders: { ...dishForm.categoryOrders, [category.id]: e.target.value } })} style={{ ...fieldStyle, padding: '0.5rem 0.5rem' }} />
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '0.4rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Option groups</div>
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                {referenceData.optionGroups.map((group) => (
                  <label key={group.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 70px', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="checkbox" checked={dishForm.optionGroupIds.includes(group.id)} onChange={() => setDishForm({ ...dishForm, optionGroupIds: toggleItemList(dishForm.optionGroupIds, group.id) })} />
                    <span>{group.name}</span>
                    <input type="number" min={0} value={dishForm.optionGroupOrders[group.id] ?? '0'} onChange={(e) => setDishForm({ ...dishForm, optionGroupOrders: { ...dishForm.optionGroupOrders, [group.id]: e.target.value } })} style={{ ...fieldStyle, padding: '0.5rem 0.5rem' }} />
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn-primary">{dishForm.id ? 'Save changes' : 'Create dish'}</button>
              <button type="button" className="btn-secondary" onClick={() => setDishForm(emptyDishForm)}>Clear form</button>
            </div>
          </form>
        </div>

        <div style={{ display: 'grid', gap: '0.8rem' }}>
          {dishes.map((dish) => (
            <div key={dish.id} className="glass-panel" style={{ padding: '0.9rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{dish.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{dish.sku}</div>
                </div>
                <span className={`badge ${dish.isActive ? 'badge-admin' : 'badge-user'}`}>{dish.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.4rem' }}>{dish.description || 'No description'}</div>
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setDishForm({
                  id: dish.id,
                  name: dish.name,
                  description: dish.description ?? '',
                  imageUrl: dish.image ?? '',
                  sku: dish.sku,
                  temperature: dish.temperature ?? 'HOT',
                  costPriceMinor: ((dish.costPriceMinor ?? 0) / 100).toFixed(2),
                  stationId: dish.station?.id ?? '',
                  minQuantity: String(dish.minQuantity ?? 0),
                  isActive: dish.isActive,
                  allergenIds: dish.allergies?.map((item) => item.allergen.id) ?? [],
                  dietaryTagIds: dish.dietaryTags?.map((item) => item.dietaryTag.id) ?? [],
                  categoryIds: dish.categories?.map((entry) => entry.category.id) ?? [],
                  categoryOrders: Object.fromEntries((dish.categories ?? []).map((entry) => [entry.category.id, String(entry.displayOrder ?? 0)])),
                  optionGroupIds: dish.optionGroups?.map((entry) => entry.optionGroup.id) ?? [],
                  optionGroupOrders: Object.fromEntries((dish.optionGroups ?? []).map((entry) => [entry.optionGroup.id, String(entry.displayOrder ?? 0)])),
                })}>Edit</button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => toggleDishActive(dish.id)}>{dish.isActive ? 'Deactivate' : 'Reactivate'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
