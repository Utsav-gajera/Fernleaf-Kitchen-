'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type Company = {
  id: string;
  name: string;
  billingContactName?: string;
  billingContactEmail?: string;
  billingContactPhone?: string;
  ownerId?: string;
  owner?: { id: string; name?: string };
  priceTierId?: string;
  priceTier?: { id: string; name?: string };
  defaultDriverId?: string;
  defaultDriver?: { id: string; name?: string };
  defaultDeliveryTime?: string;
  deliveryLeadMinutes?: number;
  defaultPackaging?: string;
  standingInstructions?: string;
  domains?: { domain: string }[];
  addresses?: Array<{
    id: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postalCode: string;
    instructions?: string;
    isDefault?: boolean;
  }>;
  holidays?: Array<{ date: string; name: string }>;
  mon?: boolean;
  tue?: boolean;
  wed?: boolean;
  thu?: boolean;
  fri?: boolean;
  sat?: boolean;
  sun?: boolean;
};

type CompanyListResponse = {
  items: Company[];
  total: number;
  page: number;
  totalPages: number;
};

type MenuVisibility = {
  categories: Array<{ id: string; name: string; isSecret: boolean }>;
  dishes: Array<{ id: string; name: string; sku: string }>;
  hiddenCategoryIds: string[];
  hiddenDishIds: string[];
};

const emptyForm = {
  name: '',
  billingContactName: '',
  billingContactEmail: '',
  billingContactPhone: '',
  ownerId: '',
  priceTierId: '',
  defaultDriverId: '',
  defaultDeliveryTime: '12:00',
  deliveryLeadMinutes: '60',
  defaultPackaging: 'STANDARD',
  standingInstructions: '',
  domains: '',
  mon: true,
  tue: true,
  wed: true,
  thu: true,
  fri: true,
  sat: false,
  sun: false,
};

const emptyAddressForm = {
  id: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  instructions: '',
  isDefault: false,
};

const emptyHolidayForm = {
  date: '',
  name: '',
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.8rem 0.9rem',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(15,23,42,0.3)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box',
};

export default function CompanyAdminPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const [holidayForm, setHolidayForm] = useState(emptyHolidayForm);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [domainInput, setDomainInput] = useState('');
  const [priceTiers, setPriceTiers] = useState<Array<{ id: string; name: string }>>([]);
  const [drivers, setDrivers] = useState<Array<{ id: string; name?: string | null; email: string }>>([]);
  const [companyEmployees, setCompanyEmployees] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [menuVisibility, setMenuVisibility] = useState<MenuVisibility | null>(null);
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);

  const workingDaysSummary = useMemo(
    () =>
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        .filter((day) => form[day as keyof typeof form] === true)
        .map((day) => day.toUpperCase())
        .join(', ') || 'No working days selected',
    [form],
  );

  const loadCompanies = useCallback(async (nextPage: number) => {
    try {
      const response = await apiRequest<CompanyListResponse>(`/companies?page=${nextPage}&limit=10`);
      setCompanies(response.items ?? []);
      setTotalPages(response.totalPages ?? 1);
      setPage(response.page ?? nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load companies');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadCompanyEmployees = useCallback(async (companyId: string) => {
    try {
      const response = await apiRequest<{ items?: Array<{ id: string; name: string; email: string; company?: { id: string }; companyId?: string }> }>(`/employees?page=1&limit=100`);
      const employees = response.items ?? [];
      const filtered = employees.filter((employee) => employee.company?.id === companyId || employee.companyId === companyId);
      setCompanyEmployees(filtered.map((employee) => ({ id: employee.id, name: employee.name, email: employee.email })));
    } catch (err) {
      console.error('Unable to load company employees', err);
      setCompanyEmployees([]);
    }
  }, []);

  useEffect(() => {
    loadCompanies(1);
  }, [loadCompanies]);

  useEffect(() => {
    if (selectedCompanyId) {
      loadCompanyEmployees(selectedCompanyId);
    } else {
      setCompanyEmployees([]);
    }
  }, [selectedCompanyId, loadCompanyEmployees]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setMenuVisibility(null);
      return;
    }

    apiRequest<MenuVisibility>(`/companies/${selectedCompanyId}/menu-visibility`)
      .then(setMenuVisibility)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load menu visibility'));
  }, [selectedCompanyId]);

  useEffect(() => {
    const loadPriceTiers = async () => {
      try {
        const response = await apiRequest<{ data?: Array<{ id: string; name?: string }> } | Array<{ id: string; name?: string }>>('/pricing/tiers');
        const items = Array.isArray(response) ? response : response?.data ?? [];
        setPriceTiers(items.map((tier) => ({ id: tier.id, name: tier.name ?? 'Unnamed tier' })));
      } catch (err) {
        console.error('Unable to load price tiers', err);
      }
    };

    loadPriceTiers();
  }, []);

  useEffect(() => {
    apiRequest<Array<{ id: string; name?: string | null; email: string }>>('/dispatch-drivers')
      .then(setDrivers)
      .catch(() => setError('Could not load drivers. You can still save the company without a default driver.'));
  }, []);

  const selectCompany = (company: Company) => {
    setSelectedCompanyId(company.id);
    setForm({
      name: company.name ?? '',
      billingContactName: company.billingContactName ?? '',
      billingContactEmail: company.billingContactEmail ?? '',
      billingContactPhone: company.billingContactPhone ?? '',
      ownerId: company.ownerId ?? company.owner?.id ?? '',
      priceTierId: company.priceTierId ?? company.priceTier?.id ?? '',
      defaultDriverId: company.defaultDriverId ?? company.defaultDriver?.id ?? '',
      defaultDeliveryTime: company.defaultDeliveryTime ?? '12:00',
      deliveryLeadMinutes: String(company.deliveryLeadMinutes ?? 60),
      defaultPackaging: company.defaultPackaging ?? 'STANDARD',
      standingInstructions: company.standingInstructions ?? '',
      domains: (company.domains ?? []).map((domain) => domain.domain).join(', '),
      mon: Boolean(company.mon ?? true),
      tue: Boolean(company.tue ?? true),
      wed: Boolean(company.wed ?? true),
      thu: Boolean(company.thu ?? true),
      fri: Boolean(company.fri ?? true),
      sat: Boolean(company.sat ?? false),
      sun: Boolean(company.sun ?? false),
    });
    setDomainInput((company.domains ?? []).map((d) => d.domain).join(', '));
  };

  const companyDomains = form.domains
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const hasInitialAddress = Boolean(
    addressForm.addressLine1.trim() && addressForm.city.trim() && addressForm.postalCode.trim(),
  );
  const hasRequiredCompanyFields = Boolean(form.name.trim())
    && companyDomains.length > 0
    && (Boolean(selectedCompanyId) || hasInitialAddress);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    try {
      const payload = {
        name: form.name.trim(),
        billingContactName: form.billingContactName.trim() || undefined,
        billingContactEmail: form.billingContactEmail.trim() || undefined,
        billingContactPhone: form.billingContactPhone.trim() || undefined,
        ...(selectedCompanyId ? { ownerId: form.ownerId || undefined } : {}),
        priceTierId: form.priceTierId || undefined,
        defaultDriverId: form.defaultDriverId || undefined,
        defaultDeliveryTime: form.defaultDeliveryTime,
        deliveryLeadMinutes: Number(form.deliveryLeadMinutes) || 60,
        defaultPackaging: form.defaultPackaging,
        standingInstructions: form.standingInstructions.trim() || undefined,
        mon: Boolean(form.mon),
        tue: Boolean(form.tue),
        wed: Boolean(form.wed),
        thu: Boolean(form.thu),
        fri: Boolean(form.fri),
        sat: Boolean(form.sat),
        sun: Boolean(form.sun),
        domains: companyDomains,
        ...(!selectedCompanyId
          ? {
              addresses: [{
                addressLine1: addressForm.addressLine1.trim(),
                addressLine2: addressForm.addressLine2.trim() || undefined,
                city: addressForm.city.trim(),
                postalCode: addressForm.postalCode.trim(),
                instructions: addressForm.instructions.trim() || undefined,
                isDefault: true,
              }],
            }
          : {}),
      };

      if (!payload.name) {
        throw new Error('Company name is required.');
      }

      if (payload.domains.length === 0) {
        throw new Error('At least one company domain is required.');
      }

      if (!selectedCompanyId && !hasInitialAddress) {
        throw new Error('A primary delivery address is required.');
      }

      const response = selectedCompanyId
        ? await apiRequest(`/companies/${selectedCompanyId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiRequest('/companies', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      if (!selectedCompanyId && response?.id) {
        setSelectedCompanyId(response.id);
      }

      setForm(emptyForm);
      setAddressForm(emptyAddressForm);
      setSelectedCompanyId(selectedCompanyId ?? response?.id ?? null);
      await loadCompanies(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save company');
    }
  };

  const toggleWorkingDay = (day: keyof typeof emptyForm) => {
    if (day === 'mon' || day === 'tue' || day === 'wed' || day === 'thu' || day === 'fri' || day === 'sat' || day === 'sun') {
      setForm((current) => ({
        ...current,
        [day]: !current[day],
      }));
    }
  };

  const saveWorkingDays = async () => {
    if (!selectedCompanyId) return;
    try {
      await apiRequest(`/companies/${selectedCompanyId}/working-days`, {
        method: 'PATCH',
        body: JSON.stringify({
          mon: form.mon,
          tue: form.tue,
          wed: form.wed,
          thu: form.thu,
          fri: form.fri,
          sat: form.sat,
          sun: form.sun,
        }),
      });
      await loadCompanies(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update working days');
    }
  };

  const saveDefaults = async () => {
    if (!selectedCompanyId) return;
    try {
      await apiRequest(`/companies/${selectedCompanyId}/defaults`, {
        method: 'PATCH',
        body: JSON.stringify({
          defaultDeliveryTime: form.defaultDeliveryTime,
          deliveryLeadMinutes: Number(form.deliveryLeadMinutes) || 60,
          defaultPackaging: form.defaultPackaging,
          standingInstructions: form.standingInstructions,
        }),
      });
      await loadCompanies(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update company defaults');
    }
  };

  const toggleHiddenCategory = (categoryId: string) => {
    setMenuVisibility((current) => {
      if (!current) return current;
      const hiddenCategoryIds = current.hiddenCategoryIds.includes(categoryId)
        ? current.hiddenCategoryIds.filter((id) => id !== categoryId)
        : [...current.hiddenCategoryIds, categoryId];
      return { ...current, hiddenCategoryIds };
    });
  };

  const toggleHiddenDish = (dishId: string) => {
    setMenuVisibility((current) => {
      if (!current) return current;
      const hiddenDishIds = current.hiddenDishIds.includes(dishId)
        ? current.hiddenDishIds.filter((id) => id !== dishId)
        : [...current.hiddenDishIds, dishId];
      return { ...current, hiddenDishIds };
    });
  };

  const saveMenuVisibility = async () => {
    if (!selectedCompanyId || !menuVisibility) return;
    try {
      setIsSavingVisibility(true);
      const updated = await apiRequest<MenuVisibility>(`/companies/${selectedCompanyId}/menu-visibility`, {
        method: 'PATCH',
        body: JSON.stringify({
          hiddenCategoryIds: menuVisibility.hiddenCategoryIds,
          hiddenDishIds: menuVisibility.hiddenDishIds,
        }),
      });
      setMenuVisibility(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save menu visibility');
    } finally {
      setIsSavingVisibility(false);
    }
  };

  const addDomain = async () => {
    if (!selectedCompanyId || !domainInput.trim()) return;
    try {
      await apiRequest(`/companies/${selectedCompanyId}/domains`, {
        method: 'POST',
        body: JSON.stringify({ domain: domainInput.trim() }),
      });
      setDomainInput('');
      await loadCompanies(page);
      const company = companies.find((item) => item.id === selectedCompanyId);
      if (company) selectCompany(company);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add domain');
    }
  };

  const removeDomain = async (domain: string) => {
    if (!selectedCompanyId) return;
    try {
      await apiRequest(`/companies/${selectedCompanyId}/domains/${encodeURIComponent(domain)}`, {
        method: 'DELETE',
      });
      await loadCompanies(page);
      const company = companies.find((item) => item.id === selectedCompanyId);
      if (company) selectCompany(company);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove domain');
    }
  };

  const submitAddress = async () => {
    if (!selectedCompanyId) return;
    try {
      const payload = {
        addressLine1: addressForm.addressLine1,
        addressLine2: addressForm.addressLine2 || undefined,
        city: addressForm.city,
        postalCode: addressForm.postalCode,
        instructions: addressForm.instructions || undefined,
        isDefault: addressForm.isDefault,
      };

      if (!payload.addressLine1 || !payload.city || !payload.postalCode) {
        throw new Error('Address line, city, and postal code are required.');
      }

      if (addressForm.id) {
        await apiRequest(`/companies/${selectedCompanyId}/addresses/${addressForm.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest(`/companies/${selectedCompanyId}/addresses`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setAddressForm(emptyAddressForm);
      await loadCompanies(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save address');
    }
  };

  const removeAddress = async (addressId: string) => {
    if (!selectedCompanyId) return;
    try {
      setError('');
      await apiRequest(`/companies/${selectedCompanyId}/addresses/${addressId}`, { method: 'DELETE' });
      await loadCompanies(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove address');
    }
  };

  const addHoliday = async () => {
    if (!selectedCompanyId || !holidayForm.date || !holidayForm.name) return;
    try {
      await apiRequest(`/companies/${selectedCompanyId}/holidays`, {
        method: 'POST',
        body: JSON.stringify({
          date: holidayForm.date,
          name: holidayForm.name,
        }),
      });
      setHolidayForm(emptyHolidayForm);
      await loadCompanies(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add holiday');
    }
  };

  const removeHoliday = async (date: string) => {
    if (!selectedCompanyId) return;
    try {
      await apiRequest(`/companies/${selectedCompanyId}/holidays/${encodeURIComponent(date)}`, {
        method: 'DELETE',
      });
      await loadCompanies(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove holiday');
    }
  };

  const company = companies.find((item) => item.id === selectedCompanyId);

  let companyListContent;

  if (isLoading) {
    companyListContent = <div style={{ color: 'var(--text-muted)' }}>Loading...</div>;
  } else if (companies.length === 0) {
    companyListContent = <div style={{ color: 'var(--text-muted)' }}>No companies yet.</div>;
  } else {
    companyListContent = (
      <div style={{ display: 'grid', gap: '0.8rem' }}>
        {companies.map((companyItem) => (
          <button
            key={companyItem.id}
            type="button"
            onClick={() => selectCompany(companyItem)}
            style={{
              textAlign: 'left',
              border: selectedCompanyId === companyItem.id ? '1px solid rgba(169,232,157,0.7)' : '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1rem',
              background: selectedCompanyId === companyItem.id ? 'rgba(169,232,157,0.1)' : 'transparent',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>{companyItem.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              {companyItem.billingContactEmail ?? companyItem.billingContactName ?? 'No billing contact'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.4rem' }}>
              {(companyItem.domains ?? []).map((d) => d.domain).join(', ') || 'No domains'}
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
      <div className="page-heading">
        <div><span className="page-eyebrow">People &amp; places</span><h1 className="page-title">Companies</h1>
        <p className="page-subtitle">Choose a company to update its delivery details, working days and menu. To add one, fill in the form on the right.</p></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 370px), 1fr))', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Company list</h2>
          {companyListContent}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={() => loadCompanies(Math.max(1, page - 1))} disabled={page <= 1}>
              Prev
            </button>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Page {page} / {totalPages}</span>
            <button type="button" className="btn-secondary" onClick={() => loadCompanies(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
              Next
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <form className="glass-panel" style={{ padding: '1.5rem' }} onSubmit={submit}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>{selectedCompanyId ? 'Edit company' : 'Create company'}</h2>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'grid', gap: '0.35rem' }}>
<label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Company name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={fieldStyle} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Billing contact</label>
                  <input value={form.billingContactName} onChange={(e) => setForm({ ...form, billingContactName: e.target.value })} style={fieldStyle} placeholder="Name" />
                </div>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email</label>
                  <input value={form.billingContactEmail} onChange={(e) => setForm({ ...form, billingContactEmail: e.target.value })} style={fieldStyle} placeholder="billing@company.com" type="email" />
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Billing phone</label>
                <input value={form.billingContactPhone} onChange={(e) => setForm({ ...form, billingContactPhone: e.target.value })} style={fieldStyle} placeholder="+1 234 567 890" />
              </div>

              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email domains *</label>
                <input value={form.domains} onChange={(e) => setForm({ ...form, domains: e.target.value })} style={fieldStyle} placeholder="example.com, partner.co.uk" required />
              </div>

              {!selectedCompanyId && <div style={{ display: 'grid', gap: '0.7rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Primary delivery address *</label>
                <input value={addressForm.addressLine1} onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })} style={fieldStyle} placeholder="Address line 1" required />
                <input value={addressForm.addressLine2} onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })} style={fieldStyle} placeholder="Address line 2 (optional)" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                  <input value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} style={fieldStyle} placeholder="City" required />
                  <input value={addressForm.postalCode} onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })} style={fieldStyle} placeholder="Postal code" required />
                </div>
                <input value={addressForm.instructions} onChange={(e) => setAddressForm({ ...addressForm, instructions: e.target.value })} style={fieldStyle} placeholder="Delivery instructions" />
              </div>}

              {selectedCompanyId ? (
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Owner employee</label>
                  <select value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })} style={fieldStyle}>
                    <option value="">Select owner employee</option>
                    {companyEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>{employee.name} ({employee.email})</option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Price tier</label>
                  <select value={form.priceTierId} onChange={(e) => setForm({ ...form, priceTierId: e.target.value })} style={fieldStyle}>
                    <option value="">Select price tier</option>
                    {priceTiers.map((tier) => (
                      <option key={tier.id} value={tier.id}>{tier.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Usual driver (optional)</label>
                  <select value={form.defaultDriverId} onChange={(e) => setForm({ ...form, defaultDriverId: e.target.value })} style={fieldStyle}>
                    <option value="">Choose a driver later</option>
                    {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name || driver.email}</option>)}
                    {form.defaultDriverId && !drivers.some((driver) => driver.id === form.defaultDriverId) && <option value={form.defaultDriverId}>Current driver</option>}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Default delivery time</label>
                  <input value={form.defaultDeliveryTime} onChange={(e) => setForm({ ...form, defaultDeliveryTime: e.target.value })} style={fieldStyle} type="time" />
                </div>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lead time (minutes)</label>
                  <input value={form.deliveryLeadMinutes} onChange={(e) => setForm({ ...form, deliveryLeadMinutes: e.target.value })} style={fieldStyle} type="number" min="0" />
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Packaging default</label>
                <select value={form.defaultPackaging} onChange={(e) => setForm({ ...form, defaultPackaging: e.target.value })} style={fieldStyle}>
                  <option value="STANDARD">Standard</option>
                  <option value="BOX">Box</option>
                  <option value="REUSABLE">Reusable</option>
                  <option value="SPECIAL">Special</option>
                </select>
              </div>

              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Standing instructions</label>
                <textarea value={form.standingInstructions} onChange={(e) => setForm({ ...form, standingInstructions: e.target.value })} style={{ ...fieldStyle, minHeight: '88px', resize: 'vertical' }} />
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Working days</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem' }}>
                  {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => (
                    <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.6rem 0.7rem', background: 'rgba(15,23,42,0.18)' }}>
                      <input type="checkbox" checked={Boolean(form[day as keyof typeof form])} onChange={() => toggleWorkingDay(day as keyof typeof emptyForm)} />
                      <span style={{ fontSize: '0.82rem', textTransform: 'uppercase' }}>{day}</span>
                    </label>
                  ))}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{workingDaysSummary}</div>
              </div>
            </div>

            {error ? <div style={{ color: '#fda4af', marginTop: '1rem' }}>{error}</div> : null}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={!hasRequiredCompanyFields}>
                {selectedCompanyId ? 'Update company' : 'Save company'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => {
                setSelectedCompanyId(null);
                setForm(emptyForm);
                setError('');
              }}>
                New
              </button>
            </div>
          </form>

          {company ? (
            <>
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.8rem' }}>Domains</h3>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem' }}>
                  <input value={domainInput} onChange={(e) => setDomainInput(e.target.value)} style={{ ...fieldStyle, flex: 1 }} placeholder="app.example.com" />
                  <button type="button" className="btn-primary" onClick={addDomain}>Add</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {(company.domains ?? []).map((item) => (
                    <span key={item.domain} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '0.35rem 0.7rem', background: 'rgba(15,23,42,0.18)' }}>
                      {item.domain}
                      <button type="button" onClick={() => removeDomain(item.domain)} style={{ background: 'transparent', border: 'none', color: '#fda4af', cursor: 'pointer' }}>×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.8rem' }}>Addresses</h3>
                <div style={{ display: 'grid', gap: '0.7rem', marginBottom: '1rem' }}>
                  <input value={addressForm.addressLine1} onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })} style={fieldStyle} placeholder="Address line 1" />
                  <input value={addressForm.addressLine2} onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })} style={fieldStyle} placeholder="Address line 2 (optional)" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                    <input value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} style={fieldStyle} placeholder="City" />
                    <input value={addressForm.postalCode} onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })} style={fieldStyle} placeholder="Postal code" />
                  </div>
                  <input value={addressForm.instructions} onChange={(e) => setAddressForm({ ...addressForm, instructions: e.target.value })} style={fieldStyle} placeholder="Delivery instructions" />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={Boolean(addressForm.isDefault)} onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })} />
                    <span>Set as default address</span>
                  </label>
                  <button type="button" className="btn-primary" onClick={submitAddress}>Save address</button>
                </div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {(company.addresses ?? []).map((address) => (
                    <div key={address.id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.7rem 0.8rem' }}>
                      <div style={{ fontWeight: 600 }}>{address.addressLine1}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{address.city} {address.postalCode}</div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                        <button type="button" className="btn-secondary" onClick={() => setAddressForm({ ...address, id: address.id, addressLine2: address.addressLine2 ?? '', instructions: address.instructions ?? '', isDefault: Boolean(address.isDefault) })}>Edit</button>
                        <button type="button" className="btn-secondary" onClick={() => removeAddress(address.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.8rem' }}>Menu visibility</h3>
                {!menuVisibility ? (
                  <div style={{ color: 'var(--text-muted)' }}>Loading menu visibility...</div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
                      <strong style={{ fontSize: '0.85rem' }}>Hidden categories</strong>
                      {menuVisibility.categories.map((category) => (
                        <label key={category.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={menuVisibility.hiddenCategoryIds.includes(category.id)}
                            onChange={() => toggleHiddenCategory(category.id)}
                          />
                          <span>{category.name}{category.isSecret ? ' (secret)' : ''}</span>
                        </label>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto', marginBottom: '1rem' }}>
                      <strong style={{ fontSize: '0.85rem' }}>Hidden dishes</strong>
                      {menuVisibility.dishes.map((dish) => (
                        <label key={dish.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={menuVisibility.hiddenDishIds.includes(dish.id)}
                            onChange={() => toggleHiddenDish(dish.id)}
                          />
                          <span>{dish.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({dish.sku})</span></span>
                        </label>
                      ))}
                    </div>
                    <button type="button" className="btn-primary" onClick={saveMenuVisibility} disabled={isSavingVisibility}>
                      {isSavingVisibility ? 'Saving...' : 'Save menu visibility'}
                    </button>
                  </>
                )}
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.8rem' }}>Holiday calendar</h3>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem' }}>
                  <input type="date" value={holidayForm.date} onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })} style={{ ...fieldStyle, flex: 1 }} />
                  <input value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} style={{ ...fieldStyle, flex: 1 }} placeholder="Holiday name" />
                  <button type="button" className="btn-primary" onClick={addHoliday}>Add</button>
                </div>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {(company.holidays ?? []).map((holiday) => (
                    <div key={holiday.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.55rem 0.7rem' }}>
                      <span>{holiday.name} • {holiday.date}</span>
                      <button type="button" onClick={() => removeHoliday(holiday.date)} style={{ background: 'transparent', border: 'none', color: '#fda4af', cursor: 'pointer' }}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.8rem' }}>Save company settings</h3>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-primary" onClick={saveDefaults}>Update defaults</button>
                  <button type="button" className="btn-primary" onClick={saveWorkingDays}>Update working days</button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
