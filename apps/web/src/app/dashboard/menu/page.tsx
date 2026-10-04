'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type CompanyOption = { id: string; name: string; priceTierId?: string };
type EmployeeOption = { id: string; name: string; email: string; company?: { id: string; name: string } };
type CategoryOption = { id: string; name: string; isSecret: boolean };
type MenuResponse = {
  employeeId: string | null;
  companyId: string;
  companyName: string;
  priceTierId?: string | null;
  menu: {
    categories: Array<{
      id: string;
      name: string;
      displayOrder: number;
      dishes: Array<{
        id: string;
        name: string;
        priceMinor?: number | null;
        price?: number | null;
        sku?: string;
        description?: string | null;
        minQuantity?: number | null;
        optionGroups?: Array<{
          id: string;
          name: string;
          options: Array<{
            id: string;
            name: string;
            priceMinor?: number | null;
            price?: number | null;
            extraChargeMinor?: number;
          }>;
        }>;
      }>;
    }>;
    totalDishes: number;
  };
};

export default function MenuPreviewPage() {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedSecretCategoryId, setSelectedSecretCategoryId] = useState('');
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [companiesResponse, employeesResponse, categoriesResponse] = await Promise.all([
          apiRequest<{ items?: CompanyOption[] }>('/companies?page=1&limit=100'),
          apiRequest<{ items?: EmployeeOption[] }>('/employees?page=1&limit=100'),
          apiRequest<{ data?: CategoryOption[] }>('/menu/categories'),
        ]);

        setCompanies(companiesResponse.items ?? []);
        setEmployees(employeesResponse.items ?? []);
        setCategories(categoriesResponse.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load company or employee data.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const loadMenu = async (categoryId?: string) => {
    if (!selectedEmployeeId) {
      setMenu(null);
      return;
    }

    try {
      setError('');
      const path = categoryId
        ? `/employees/${selectedEmployeeId}/menu/categories/${categoryId}`
        : `/employees/${selectedEmployeeId}/menu/preview`;
      const response = await apiRequest<MenuResponse>(path);
      setMenu(response);
      setSelectedCompanyId(response.companyId ?? selectedCompanyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load menu preview.');
      setMenu(null);
    }
  };

  const visibleEmployees = selectedCompanyId
    ? employees.filter((employee) => employee.company?.id === selectedCompanyId)
    : employees;

  return (
    <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
      <div className="page-heading">
        <div><span className="page-eyebrow">Menu management</span><h1 className="page-title">Menu preview</h1>
        <p className="page-subtitle">Choose a company and employee to check which dishes and prices they will see.</p></div>
      </div>

      {error && (
        <div className="notice error" role="alert" style={{ marginBottom: '1.2rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Company</label>
            <select
              value={selectedCompanyId}
              onChange={(event) => {
                const nextCompanyId = event.target.value;
                setSelectedCompanyId(nextCompanyId);
                setSelectedEmployeeId('');
                setSelectedSecretCategoryId('');
                setMenu(null);
              }}
              style={{ width: '100%', padding: '0.75rem 0.85rem', borderRadius: '10px', background: 'rgba(15,23,42,0.3)', color: 'white' }}
            >
              <option value="">Select a company</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Employee</label>
            <select
              value={selectedEmployeeId}
              onChange={(event) => {
                setSelectedEmployeeId(event.target.value);
                setSelectedSecretCategoryId('');
                setMenu(null);
              }}
              disabled={!selectedCompanyId || loading}
              style={{ width: '100%', padding: '0.75rem 0.85rem', borderRadius: '10px', background: 'rgba(15,23,42,0.3)', color: 'white' }}
            >
              <option value="">Select an employee</option>
              {visibleEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => loadMenu()}
            disabled={!selectedCompanyId || !selectedEmployeeId || loading}
            className="btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
          >
            Show this employee&apos;s menu
          </button>

          {selectedEmployeeId && categories.some((category) => category.isSecret) && (
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Hidden category</label>
              <select
                value={selectedSecretCategoryId}
                onChange={(event) => setSelectedSecretCategoryId(event.target.value)}
                style={{ width: '100%', padding: '0.75rem 0.85rem', borderRadius: '10px', background: 'rgba(15,23,42,0.3)', color: 'white' }}
              >
                <option value="">Choose a hidden category</option>
                {categories.filter((category) => category.isSecret).map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => loadMenu(selectedSecretCategoryId)}
                disabled={!selectedSecretCategoryId}
                style={{ width: '100%', marginTop: '0.65rem' }}
              >
                Preview hidden category
              </button>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.55rem' }}>
                Hidden categories do not appear in the regular menu. Preview one here when needed.
              </div>
            </div>
          )}
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading menu options...</div>
          ) : !menu ? (
            <div className="empty-state">Select a company and employee, then choose “Show this employee&apos;s menu.”</div>
          ) : (
            <>
              <div style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '0.35rem' }}>{menu.companyName}</h2>
                <div style={{ color: 'var(--text-muted)' }}>
                  {menu.menu.totalDishes} visible dish{menu.menu.totalDishes === 1 ? '' : 'es'}
                </div>
              </div>

              {menu.menu.categories.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>This employee has no visible menu items.</div>
              ) : (
                menu.menu.categories.map((category) => (
                  <div key={category.id} style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ marginBottom: '0.8rem', fontSize: '1.1rem' }}>{category.name}</h3>
                    <div style={{ display: 'grid', gap: '0.9rem' }}>
                      {category.dishes.map((dish) => (
                        <div key={dish.id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>{dish.name}</div>
                              {dish.sku && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{dish.sku}</div>}
                            </div>
                            <div style={{ fontWeight: 700 }}>
                              {dish.price != null ? `$${dish.price.toFixed(2)}` : 'Price unavailable'}
                            </div>
                          </div>

                          {dish.description && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.55rem' }}>{dish.description}</div>
                          )}

                          {dish.minQuantity != null && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.6rem' }}>
                              Min quantity: {dish.minQuantity}
                            </div>
                          )}

                          {(dish.optionGroups ?? []).length > 0 && (
                            <div style={{ display: 'grid', gap: '0.7rem' }}>
                              {dish.optionGroups?.map((group) => (
                                <div key={group.id} style={{ background: 'rgba(15,23,42,0.25)', borderRadius: '10px', padding: '0.7rem 0.8rem' }}>
                                  <div style={{ fontWeight: 600, marginBottom: '0.45rem' }}>{group.name}</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {group.options.map((option) => (
                                      <span
                                        key={option.id}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.4rem',
                                          borderRadius: '999px',
                                          border: '1px solid rgba(255,255,255,0.08)',
                                          padding: '0.35rem 0.6rem',
                                          fontSize: '0.8rem',
                                        }}
                                      >
                                        <span>{option.name}</span>
                                        <span style={{ color: 'var(--text-muted)' }}>
                                          {option.price != null ? `$${option.price.toFixed(2)}` : 'N/A'}
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
