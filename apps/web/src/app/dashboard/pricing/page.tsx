'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../../lib/api';

type Tier = {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  derivedFromTierId?: string | null;
  multiplier?: number | null;
  markupPercent?: number | null;
};

type MissingData = {
  tier: { id: string; name: string; isDefault: boolean } | null;
  missingDishes: Array<{ id: string; name: string; sku: string; costPriceMinor: number; tierId: string; tierName: string }>;
  missingOptions: Array<{ id: string; name: string; costPriceMinor: number; tierId: string; tierName: string }>;
};

type TierPriceOverride = {
  id: string;
  priceTierId: string;
  dishId?: string;
  optionId?: string;
  name: string;
  sku?: string;
  priceMinor: number;
};

export default function PricingAdminPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [missing, setMissing] = useState<MissingData>({ tier: null, missingDishes: [], missingOptions: [] });
  const [dishList, setDishList] = useState<Array<{ id: string; name: string; sku: string }>>([]);
  const [optionList, setOptionList] = useState<Array<{ id: string; name: string }>>([]);
  const [overrideForm, setOverrideForm] = useState({ tierId: '', dishId: '', optionId: '', priceMinor: '0' });
  const [tierOverrides, setTierOverrides] = useState<{ dishPrices: TierPriceOverride[]; optionPrices: TierPriceOverride[] } | null>(null);
  const [tierForm, setTierForm] = useState({ id: '', name: '', description: '', strategy: 'explicit', parentId: '', value: '', isDefault: false });
  const [error, setError] = useState('');

  const loadMissing = useCallback(async (tierId: string) => {
    try {
      const response = await apiRequest<MissingData>(`/pricing/missing?tierId=${tierId}`);
      setMissing(response ?? { tier: null, missingDishes: [], missingOptions: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load missing prices');
    }
  }, []);

  const loadOverrides = useCallback(async (tierId: string) => {
    try {
      const response = await apiRequest<{ data?: { dishPrices?: TierPriceOverride[]; optionPrices?: TierPriceOverride[] } }>(`/pricing/overrides?tierId=${tierId}`);
      const nextOverrides = response?.data ?? { dishPrices: [], optionPrices: [] };
      setTierOverrides({
        dishPrices: nextOverrides.dishPrices ?? [],
        optionPrices: nextOverrides.optionPrices ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load override prices');
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const response = await apiRequest<{ data?: Tier[] } | Tier[]>('/pricing/tiers');
      const nextTiers = Array.isArray(response) ? response : response?.data ?? [];
      setTiers(nextTiers);

      const selectedTier = nextTiers.find((tier) => tier.isDefault) ?? nextTiers[0];
      if (selectedTier) {
        setOverrideForm((current) => ({ ...current, tierId: selectedTier.id }));
        await Promise.all([
          loadMissing(selectedTier.id),
          loadOverrides(selectedTier.id),
        ]);
      }

      const dishesResponse = await apiRequest<{ items?: Array<{ id: string; name: string; sku: string }> }>('/catalogue/dishes?page=1&limit=200');
      setDishList(dishesResponse.items ?? []);

      const optionResponse = await apiRequest<{ items?: Array<{ id: string; name: string }> }>('/catalogue/options?page=1&limit=200');
      setOptionList(optionResponse.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load pricing data');
    }
  }, [loadMissing, loadOverrides]);

  useEffect(() => { loadData(); }, [loadData]);

  const onTierChange = async (tierId: string) => {
    setOverrideForm((current) => ({ ...current, tierId }));
    await Promise.all([
      loadMissing(tierId),
      loadOverrides(tierId),
    ]);
  };

  const saveOverride = async () => {
    try {
      const { tierId, dishId, optionId, priceMinor } = overrideForm;
      const numericValue = Number(priceMinor);

      if (!tierId) {
        throw new Error('Please choose a price tier first.');
      }

      if (!dishId && !optionId) {
        throw new Error('Choose a dish or option to override.');
      }

      if (dishId) {
        await apiRequest('/pricing/dish-price', {
          method: 'POST',
          body: JSON.stringify({ tierId, dishId, priceMinor: numericValue }),
        });
      }

      if (optionId) {
        await apiRequest('/pricing/option-price', {
          method: 'POST',
          body: JSON.stringify({ tierId, optionId, priceMinor: numericValue }),
        });
      }

      setOverrideForm((current) => ({ ...current, dishId: '', optionId: '', priceMinor: '0' }));
      await loadOverrides(tierId);
      await loadMissing(tierId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save override');
    }
  };

  const editTier = (tier: Tier) => {
    setTierForm({
      id: tier.id,
      name: tier.name,
      description: tier.description ?? '',
      strategy: tier.derivedFromTierId ? 'markup' : tier.multiplier != null ? 'cost' : 'explicit',
      parentId: tier.derivedFromTierId ?? '',
      value: String(tier.derivedFromTierId ? tier.markupPercent ?? '' : tier.multiplier ?? ''),
      isDefault: tier.isDefault,
    });
  };

  const saveTier = async () => {
    try {
      setError('');
      const payload = {
        name: tierForm.name,
        description: tierForm.description || undefined,
        isDefault: tierForm.isDefault,
        derivedFromTierId: tierForm.strategy === 'markup' ? tierForm.parentId : null,
        multiplier: tierForm.strategy === 'cost' ? Number(tierForm.value) : null,
        markupPercent: tierForm.strategy === 'markup' ? Number(tierForm.value) : null,
      };
      await apiRequest(tierForm.id ? `/pricing/tiers/${tierForm.id}` : '/pricing/tiers', {
        method: tierForm.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setTierForm({ id: '', name: '', description: '', strategy: 'explicit', parentId: '', value: '', isDefault: false });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save price tier');
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>Pricing</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Review tier rules and missing dish pricing.</p>
        </div>
        <Link href="/dashboard" className="btn-secondary btn-sm">Back to dashboard</Link>
      </div>

      {error ? <div className="glass-panel" style={{ padding: '0.9rem 1rem', marginBottom: '1.2rem', color: '#fda4af' }}>{error}</div> : null}

      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Price tiers</h2>
          <select
            value={missing.tier?.id ?? tiers[0]?.id ?? ''}
            onChange={(event) => onTierChange(event.target.value)}
            style={{ width: '240px', padding: '0.7rem 0.9rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.3)', color: 'var(--text-primary)' }}
          >
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>{tier.name}{tier.isDefault ? ' (Default)' : ''}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr 1fr 110px auto', gap: '0.7rem', alignItems: 'end', marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Name<input className="form-input" value={tierForm.name} onChange={(event) => setTierForm({ ...tierForm, name: event.target.value })} /></label>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Description<input className="form-input" value={tierForm.description} onChange={(event) => setTierForm({ ...tierForm, description: event.target.value })} /></label>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rule<select className="form-input" value={tierForm.strategy} onChange={(event) => setTierForm({ ...tierForm, strategy: event.target.value, parentId: '', value: '' })}><option value="explicit">Explicit only</option><option value="cost">Cost multiplier</option><option value="markup">Tier markup</option></select></label>
          {tierForm.strategy === 'markup' ? <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Parent<select className="form-input" value={tierForm.parentId} onChange={(event) => setTierForm({ ...tierForm, parentId: event.target.value })}><option value="">Select tier</option>{tiers.filter((tier) => tier.id !== tierForm.id).map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label> : <span />}
          {tierForm.strategy !== 'explicit' ? <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tierForm.strategy === 'cost' ? 'Multiplier' : 'Markup %'}<input className="form-input" type="number" min="0.01" step="0.01" value={tierForm.value} onChange={(event) => setTierForm({ ...tierForm, value: event.target.value })} /></label> : <span />}
          <div style={{ display: 'flex', gap: 6 }}><button className="btn-primary btn-sm" type="button" onClick={() => void saveTier()} disabled={!tierForm.name.trim()}>{tierForm.id ? 'Update' : 'Add tier'}</button>{tierForm.id && <button className="btn-secondary btn-sm" type="button" onClick={() => setTierForm({ id: '', name: '', description: '', strategy: 'explicit', parentId: '', value: '', isDefault: false })}>Cancel</button>}</div>
          <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}><input type="checkbox" checked={tierForm.isDefault} onChange={(event) => setTierForm({ ...tierForm, isDefault: event.target.checked })} /> Default tier</label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
          {tiers.map((tier) => (
            <div key={tier.id} className="glass-panel" style={{ padding: '1rem', background: tier.isDefault ? 'rgba(34,197,94,0.08)' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <strong>{tier.name}</strong>
                {tier.isDefault ? <span className="badge badge-admin">Default</span> : null}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                {tier.description || 'No description'}
              </div>
              <div style={{ marginTop: '0.8rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {tier.derivedFromTierId ? `Derived from ${tier.derivedFromTierId}` : 'Standalone tier'}
              </div>
              <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {tier.multiplier != null ? `Multiplier: ${tier.multiplier}` : null}
                {tier.markupPercent != null ? `Markup: ${tier.markupPercent}%` : null}
              </div>
              <button type="button" className="btn-secondary btn-sm" style={{ marginTop: '0.75rem' }} onClick={() => editTier(tier)}>Edit tier</button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.2rem' }}>Set explicit price override</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px auto', gap: '0.75rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Tier</label>
            <select value={overrideForm.tierId} onChange={(event) => setOverrideForm({ ...overrideForm, tierId: event.target.value })} style={{ width: '100%', padding: '0.75rem 0.9rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.3)', color: 'var(--text-primary)' }}>
              <option value="">Select tier</option>
              {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Dish</label>
            <select value={overrideForm.dishId} onChange={(event) => setOverrideForm({ ...overrideForm, dishId: event.target.value, optionId: '' })} style={{ width: '100%', padding: '0.75rem 0.9rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.3)', color: 'var(--text-primary)' }}>
              <option value="">No dish</option>
              {dishList.map((dish) => <option key={dish.id} value={dish.id}>{dish.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Option</label>
            <select value={overrideForm.optionId} onChange={(event) => setOverrideForm({ ...overrideForm, optionId: event.target.value, dishId: '' })} style={{ width: '100%', padding: '0.75rem 0.9rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.3)', color: 'var(--text-primary)' }}>
              <option value="">No option</option>
              {optionList.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.45rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Price (minor)</label>
            <input type="number" min={0} value={overrideForm.priceMinor} onChange={(event) => setOverrideForm({ ...overrideForm, priceMinor: event.target.value })} style={{ width: '100%', padding: '0.75rem 0.9rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.3)', color: 'var(--text-primary)' }} />
          </div>

          <button type="button" onClick={saveOverride} className="btn-primary btn-sm">Save override</button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.2rem' }}>Missing prices for {missing.tier?.name ?? 'selected tier'}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <h3 style={{ marginBottom: '0.8rem', fontSize: '1rem' }}>Dishes</h3>
            {missing.missingDishes.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>No missing dish prices</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {missing.missingDishes.map((dish) => (
                  <div key={dish.id} style={{ padding: '0.75rem 0.9rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', background: 'rgba(15,23,42,0.2)' }}>
                    <div style={{ fontWeight: 700 }}>{dish.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{dish.sku}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>Cost: {dish.costPriceMinor}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 style={{ marginBottom: '0.8rem', fontSize: '1rem' }}>Options</h3>
            {missing.missingOptions.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>No missing option prices</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {missing.missingOptions.map((option) => (
                  <div key={option.id} style={{ padding: '0.75rem 0.9rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', background: 'rgba(15,23,42,0.2)' }}>
                    <div style={{ fontWeight: 700 }}>{option.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>Cost: {option.costPriceMinor}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.25rem', marginTop: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.2rem' }}>Current overrides for {missing.tier?.name ?? 'selected tier'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <h3 style={{ marginBottom: '0.8rem', fontSize: '1rem' }}>Dish overrides</h3>
            {(!tierOverrides?.dishPrices || tierOverrides.dishPrices.length === 0) ? (
              <div style={{ color: 'var(--text-muted)' }}>No dish override values yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {tierOverrides.dishPrices.map((override) => (
                  <div key={override.id} style={{ padding: '0.75rem 0.9rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', background: 'rgba(15,23,42,0.2)' }}>
                    <div style={{ fontWeight: 700 }}>{override.name}</div>
                    {override.sku ? <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{override.sku}</div> : null}
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>Override: {override.priceMinor}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 style={{ marginBottom: '0.8rem', fontSize: '1rem' }}>Option overrides</h3>
            {(!tierOverrides?.optionPrices || tierOverrides.optionPrices.length === 0) ? (
              <div style={{ color: 'var(--text-muted)' }}>No option override values yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {tierOverrides.optionPrices.map((override) => (
                  <div key={override.id} style={{ padding: '0.75rem 0.9rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', background: 'rgba(15,23,42,0.2)' }}>
                    <div style={{ fontWeight: 700 }}>{override.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>Override: {override.priceMinor}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
