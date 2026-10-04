'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type CompanyOption = { id: string; name: string };

type Employee = {
  id: string;
  name: string;
  email: string;
  company?: { id: string; name: string };
  canChooseDeliveryAddress?: boolean;
  canChangeDeliveryTime?: boolean;
  canChangePackaging?: boolean;
  allergies?: { allergen: { name: string } }[];
  dietaryPreferences?: { dietaryTag: { name: string } }[];
};

type EmployeeListResponse = {
  items: Employee[];
  total: number;
  page: number;
  totalPages: number;
};

const emptyForm = {
  id: '',
  companyId: '',
  name: '',
  email: '',
  allergies: '',
  dietaryPreferences: '',
  canChooseDeliveryAddress: false,
  canChangeDeliveryTime: false,
  canChangePackaging: false,
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

export default function EmployeeAdminPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadCompanies = useCallback(async () => {
    try {
      const response = await apiRequest<{ items: CompanyOption[] }>('/companies?page=1&limit=100');
      setCompanies(response.items ?? []);
    } catch (err) {
      console.error('Unable to load companies for employee form', err);
    }
  }, []);

  const loadEmployees = useCallback(async (nextPage: number) => {
    try {
      const response = await apiRequest<EmployeeListResponse>(`/employees?page=${nextPage}&limit=10`);
      setEmployees(response.items ?? []);
      setTotalPages(response.totalPages ?? 1);
      setPage(response.page ?? nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load employees');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
    loadEmployees(1);
  }, [loadCompanies, loadEmployees]);

  const selectEmployee = (employee: Employee) => {
    setForm({
      id: employee.id,
      companyId: employee.company?.id ?? '',
      name: employee.name,
      email: employee.email,
      allergies: employee.allergies?.map((item) => item.allergen.name).join(', ') ?? '',
      dietaryPreferences: employee.dietaryPreferences?.map((item) => item.dietaryTag.name).join(', ') ?? '',
      canChooseDeliveryAddress: Boolean(employee.canChooseDeliveryAddress),
      canChangeDeliveryTime: Boolean(employee.canChangeDeliveryTime),
      canChangePackaging: Boolean(employee.canChangePackaging),
    });
  };

  const hasRequiredEmployeeFields = Boolean(form.companyId && form.name.trim() && form.email.trim());

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    try {
      const payload = {
        companyId: form.companyId,
        name: form.name.trim(),
        email: form.email.trim(),
        allergies: form.allergies
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        dietaryPreferences: form.dietaryPreferences
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        canChooseDeliveryAddress: Boolean(form.canChooseDeliveryAddress),
        canChangeDeliveryTime: Boolean(form.canChangeDeliveryTime),
        canChangePackaging: Boolean(form.canChangePackaging),
      };

      if (!payload.companyId) {
        throw new Error('Please select a company first.');
      }
      if (!payload.name) {
        throw new Error('Employee name is required.');
      }
      if (!payload.email) {
        throw new Error('Employee email is required.');
      }

      if (form.id) {
        await apiRequest(`/employees/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/employees', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setForm(emptyForm);
      await loadEmployees(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save employee');
    }
  };

  let employeeListContent;

  if (isLoading) {
    employeeListContent = <div style={{ color: 'var(--text-muted)' }}>Loading...</div>;
  } else if (employees.length === 0) {
    employeeListContent = <div style={{ color: 'var(--text-muted)' }}>No employees yet.</div>;
  } else {
    employeeListContent = (
      <div style={{ display: 'grid', gap: '0.8rem' }}>
        {employees.map((employee) => (
          <button
            key={employee.id}
            type="button"
            onClick={() => selectEmployee(employee)}
            style={{
              textAlign: 'left',
              border: form.id === employee.id ? '1px solid rgba(169,232,157,0.7)' : '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1rem',
              background: form.id === employee.id ? 'rgba(169,232,157,0.1)' : 'transparent',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>{employee.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{employee.email}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
              {employee.company?.name ?? 'Unassigned'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.35rem' }}>
              {employee.allergies?.length ? `Allergies: ${employee.allergies.map((item) => item.allergen.name).join(', ')}` : 'No allergy notes'}
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
      <div className="page-heading">
        <div><span className="page-eyebrow">People &amp; places</span><h1 className="page-title">Employees</h1>
        <p className="page-subtitle">Choose a person to update their company, dietary needs and delivery choices. New employees can be added with the form.</p></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 370px), 1fr))', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Employee list</h2>
          {employeeListContent}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={() => loadEmployees(Math.max(1, page - 1))} disabled={page <= 1}>
              Prev
            </button>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Page {page} / {totalPages}</span>
            <button type="button" className="btn-secondary" onClick={() => loadEmployees(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
              Next
            </button>
          </div>
        </div>

        <form className="glass-panel" style={{ padding: '1.5rem' }} onSubmit={submit}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>{form.id ? 'Edit employee' : 'Create employee'}</h2>

          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Company *</label>
              <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} style={fieldStyle} required>
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Full name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={fieldStyle} placeholder="Jane Smith" required />
            </div>

            <div style={{ display: 'grid', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email *</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={fieldStyle} placeholder="jane@company.com" type="email" required />
            </div>

            <div style={{ display: 'grid', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Allergies</label>
              <input value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} style={fieldStyle} placeholder="Peanuts, shellfish, dairy" />
            </div>

            <div style={{ display: 'grid', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dietary preferences</label>
              <input value={form.dietaryPreferences} onChange={(e) => setForm({ ...form, dietaryPreferences: e.target.value })} style={fieldStyle} placeholder="Vegetarian, gluten-free" />
            </div>

            <div style={{ display: 'grid', gap: '0.6rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Delivery permissions</div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.7rem 0.8rem', background: 'rgba(15,23,42,0.18)' }}>
                  <span style={{ fontSize: '0.85rem' }}>Can choose delivery address</span>
                  <input type="checkbox" checked={Boolean(form.canChooseDeliveryAddress)} onChange={(e) => setForm({ ...form, canChooseDeliveryAddress: e.target.checked })} />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.7rem 0.8rem', background: 'rgba(15,23,42,0.18)' }}>
                  <span style={{ fontSize: '0.85rem' }}>Can change delivery time</span>
                  <input type="checkbox" checked={Boolean(form.canChangeDeliveryTime)} onChange={(e) => setForm({ ...form, canChangeDeliveryTime: e.target.checked })} />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.7rem 0.8rem', background: 'rgba(15,23,42,0.18)' }}>
                  <span style={{ fontSize: '0.85rem' }}>Can change packaging</span>
                  <input type="checkbox" checked={Boolean(form.canChangePackaging)} onChange={(e) => setForm({ ...form, canChangePackaging: e.target.checked })} />
                </label>
              </div>
            </div>
          </div>

          {error ? <div style={{ color: '#fda4af', marginTop: '1rem' }}>{error}</div> : null}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.1rem' }}>
            <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={!hasRequiredEmployeeFields}>
              {form.id ? 'Update employee' : 'Save employee'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => { setForm(emptyForm); setError(''); }}>
              New
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
