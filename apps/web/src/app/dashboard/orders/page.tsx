'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Eye, Plus, Save, Send, ShoppingBasket, XCircle } from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { hasCapability } from '../../../lib/access';
import { statusLabel } from '../../../lib/presentation';

type Company = { id: string; name: string };
type Employee = {
  id: string;
  name: string;
  email: string;
  companyId?: string;
  canChooseDeliveryAddress?: boolean;
  canChangeDeliveryTime?: boolean;
  canChangePackaging?: boolean;
  company?: Company & { mon?: boolean; tue?: boolean; wed?: boolean; thu?: boolean; fri?: boolean; sat?: boolean; sun?: boolean };
};
type MenuOption = { id: string; name: string; effectivePriceMinor?: number; priceMinor?: number; price?: number };
type MenuGroup = { id: string; name: string; isRequired?: boolean; options: MenuOption[] };
type MenuDish = { id: string; name: string; sku?: string; priceMinor?: number; price?: number; minQuantity?: number; optionGroups?: MenuGroup[] };
type MenuResponse = { menu: { categories: Array<{ id: string; name: string; dishes: MenuDish[] }>; totalDishes: number } };
type Combination = { quantity: number; selections: Array<{ optionGroupId: string; optionId: string }> };
type DraftLine = { dish: MenuDish; quantity: number; combinations: Combination[] };
type Order = {
  id: string;
  status: string;
  invoiced: boolean;
  deliveryDate: string;
  deliveryTime: string;
  packaging: string;
  totalMinor: number;
  subtotalMinor: number;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  postalCode: string;
  employee: Employee;
  company: Company;
  lines: Array<{ id: string; dishNameSnapshot: string; skuSnapshot: string; quantity: number; dishUnitPriceMinor: number; totalMinor: number; combinations: Array<{ quantity: number; totalMinor: number; optionGroupId?: string | null; optionGroupNameSnapshot: string; options: Array<{ optionId?: string | null; optionNameSnapshot: string; optionPriceMinor: number }> }> }>;
  timelineEvents?: Array<{ id: string; status: string; note?: string; createdAt: string }>;
};
type OrderList = { items: Order[]; total: number; page: number; limit: number; totalPages: number };

const money = (minor = 0) => `$${(minor / 100).toFixed(2)}`;
const dateInput = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const pastDateInput = () => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

export default function OrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const canCreateOrders = user ? hasCapability(user.role, 'ORDER_CREATE') : false;
  const canOverrideOrders = user ? hasCapability(user.role, 'ORDER_OVERRIDE') : false;
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [orders, setOrders] = useState<OrderList | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(dateInput());
  const [minimumDeliveryDate, setMinimumDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [packaging, setPackaging] = useState('');
  const [address, setAddress] = useState({ addressLine1: '', addressLine2: '', city: '', postalCode: '', instructions: '' });
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [placeOnSave, setPlaceOnSave] = useState(false);
  const [status, setStatus] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [invoicedFilter, setInvoicedFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [commanding, setCommanding] = useState(false);
  const [cutoffDate, setCutoffDate] = useState(pastDateInput());
  const [processingCutoff, setProcessingCutoff] = useState(false);
  const [correctedTotal, setCorrectedTotal] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  const selectedEmployee = employees.find((item) => item.id === employeeId);
  const availableMenuDishes = useMemo(() => {
    const dishesById = new Map<string, MenuDish>();
    for (const category of menu?.menu.categories ?? []) {
      for (const dish of category.dishes) {
        if (!dishesById.has(dish.id)) {
          dishesById.set(dish.id, dish);
        }
      }
    }
    return Array.from(dishesById.values());
  }, [menu]);
  const isOperationalOverride = Boolean(
    selected && ['CONFIRMED', 'KITCHEN_IN_PROGRESS', 'KITCHEN_READY'].includes(selected.status),
  );
  const selectedOriginalTotal = selected?.lines
    .filter((line) => line.skuSnapshot !== 'INTERNAL-ADJUSTMENT')
    .reduce((sum, line) => sum + line.totalMinor, 0) ?? 0;
  const canUseAddress = canOverrideOrders || (selectedEmployee?.canChooseDeliveryAddress ?? false);
  const canChangeTime = canOverrideOrders || (selectedEmployee?.canChangeDeliveryTime ?? false);
  const canChangePackaging = canOverrideOrders || (selectedEmployee?.canChangePackaging ?? false);
  const subtotal = lines.reduce((orderTotal, line) => orderTotal + line.combinations.reduce((total, combination) => {
    const dishPrice = line.dish.priceMinor ?? Math.round((line.dish.price ?? 0) * 100);
    const optionPrice = combination.selections.reduce((sum, selection) => {
      const group = line.dish.optionGroups?.find((candidate) => candidate.id === selection.optionGroupId);
      const option = group?.options.find((candidate) => candidate.id === selection.optionId);
      return sum + (option?.effectivePriceMinor ?? option?.priceMinor ?? Math.round((option?.price ?? 0) * 100));
    }, 0);
    return total + (dishPrice + optionPrice) * combination.quantity;
  }, 0), 0);

  const loadOrders = useCallback(async (nextPage = 1) => {
    try {
      const params = new URLSearchParams({ page: String(nextPage), limit: '10' });
      if (companyFilter) params.set('companyId', companyFilter);
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (invoicedFilter) params.set('invoiced', invoicedFilter);
      if (from) params.set('deliveryFrom', from);
      if (to) params.set('deliveryTo', to);
      const response = await apiRequest<OrderList>(`/orders?${params.toString()}`);
      setOrders(response);
      setPage(response.page);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  }, [companyFilter, from, invoicedFilter, search, statusFilter, to]);

  useEffect(() => {
    if (!user || !canCreateOrders) return;
    Promise.all([
      apiRequest<{ items: Company[] }>('/companies?page=1&limit=100'),
      apiRequest<{ items: Employee[] }>('/employees?page=1&limit=100'),
    ]).then(([companyResponse, employeeResponse]) => {
      setCompanies(companyResponse.items ?? []);
      setEmployees(employeeResponse.items ?? []);
    }).catch((error) => setStatus(error instanceof Error ? error.message : 'Unable to load order form data.'));
  }, [canCreateOrders, user]);

  useEffect(() => {
    if (user) void loadOrders(1);
  }, [user, companyFilter, from, invoicedFilter, search, statusFilter, to, loadOrders]);

  const resetForm = () => {
    setSelected(null);
    setMenu(null);
    setEmployeeId('');
    setDeliveryDate(dateInput());
    setMinimumDeliveryDate('');
    setDeliveryTime('');
    setPackaging('');
    setAddress({ addressLine1: '', addressLine2: '', city: '', postalCode: '', instructions: '' });
    setLines([]);
    setPlaceOnSave(false);
  };

  const loadEmployeeMenu = async (nextEmployeeId: string) => {
    setEmployeeId(nextEmployeeId);
    setLines([]);
    setMenu(null);
    setMinimumDeliveryDate('');
    setDeliveryTime(employees.find((item) => item.id === nextEmployeeId)?.company ? '' : deliveryTime);
    try {
      if (!nextEmployeeId) {
        return;
      }
      setMenuLoading(true);
      const [employeeMenu, nextDate] = await Promise.all([
        apiRequest<MenuResponse>(`/employees/${nextEmployeeId}/menu`),
        apiRequest<{ date: string }>(`/orders/next-delivery-date?employeeId=${encodeURIComponent(nextEmployeeId)}`),
      ]);
      setMenu(employeeMenu);
      setDeliveryDate(nextDate.date);
      setMinimumDeliveryDate(nextDate.date);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load employee menu.');
    } finally {
      setMenuLoading(false);
    }
  };

  const addDish = (dish: MenuDish) => {
    const groups = dish.optionGroups ?? [];
    const selections = groups.filter((group) => group.isRequired).map((group) => ({ optionGroupId: group.id, optionId: group.options[0]?.id ?? '' })).filter((item) => item.optionId);
    setLines((current) => [...current, { dish, quantity: Math.max(1, dish.minQuantity ?? 1), combinations: [{ quantity: Math.max(1, dish.minQuantity ?? 1), selections }] }]);
  };

  const updateLine = (index: number, patch: Partial<DraftLine>) => setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));

  const updateCombination = (lineIndex: number, combinationIndex: number, patch: Partial<Combination>) => {
    setLines((current) => current.map((line, index) => index !== lineIndex ? line : {
      ...line,
      combinations: line.combinations.map((combination, cIndex) => cIndex === combinationIndex ? { ...combination, ...patch } : combination),
    }));
  };

  const saveOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!employeeId || lines.length === 0) {
      setStatus('Select an employee and add at least one dish.');
      return;
    }
    if (menuLoading) {
      setStatus('Wait for the employee menu to finish loading.');
      return;
    }
    if (!deliveryDate || Number.isNaN(new Date(`${deliveryDate}T00:00:00`).getTime())) {
      setStatus('Select a valid delivery date.');
      return;
    }
    if (!isOperationalOverride && minimumDeliveryDate && deliveryDate < minimumDeliveryDate) {
      setStatus(`Choose ${minimumDeliveryDate} or later. The ordering deadline has passed for earlier dates.`);
      return;
    }
    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity < 1) {
        setStatus(`${line.dish.name} must have a quantity greater than zero.`);
        return;
      }
      if (!line.combinations.length) {
        setStatus(`Add at least one serving choice for ${line.dish.name}.`);
        return;
      }
      const combinationQuantity = line.combinations.reduce((total, combination) => {
        if (!Number.isInteger(combination.quantity) || combination.quantity < 1) return Number.NaN;
        return total + combination.quantity;
      }, 0);
      if (combinationQuantity !== line.quantity) {
        setStatus(`The serving quantities for ${line.dish.name} must add up to ${line.quantity}.`);
        return;
      }
      for (const group of line.dish.optionGroups ?? []) {
        if (group.isRequired && line.combinations.some((combination) => !combination.selections.some((selection) => selection.optionGroupId === group.id))) {
          setStatus(`Select an option for required group "${group.name}" on ${line.dish.name}.`);
          return;
        }
      }
    }
    if (from && to && from > to) {
      setStatus('Delivery date range filters are invalid.');
      return;
    }
    setSaving(true);
    setStatus('');
    try {
      const payload = isOperationalOverride
        ? {
            deliveryTime: deliveryTime || undefined,
            packaging: packaging || undefined,
            address: address.addressLine1 ? address : undefined,
          }
        : {
            deliveryDate: `${deliveryDate}T00:00:00.000Z`,
            deliveryTime: canChangeTime && deliveryTime ? deliveryTime : undefined,
            packaging: canChangePackaging && packaging ? packaging : undefined,
            address: canUseAddress && address.addressLine1 ? address : undefined,
            lines: lines.map((line) => ({ dishId: line.dish.id, quantity: line.quantity, combinations: line.combinations })),
            ...(!selected ? { employeeId, place: placeOnSave } : {}),
          };
      const editing = Boolean(selected);
      const saved = selected
        ? await apiRequest<Order>(`/orders/${selected.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await apiRequest<Order>('/orders', { method: 'POST', body: JSON.stringify(payload) });
      setSelected(editing ? saved : null);
      setStatus(editing ? 'Order updated.' : 'Order created. Create another order or select one from the list to review it.');
      await loadOrders(page);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save order.');
    } finally {
      setSaving(false);
    }
  };

  const command = async (action: 'place' | 'cancel') => {
    if (!selected || commanding) return;
    setCommanding(true);
    try {
      const updated = await apiRequest<Order>(`/orders/${selected.id}/${action}`, { method: 'POST' });
      setSelected(updated);
      setOrders((current) => current ? {
        ...current,
        items: current.items.map((order) => order.id === updated.id ? { ...order, status: updated.status } : order),
      } : current);
      setStatus(`Order ${action === 'place' ? 'placed' : 'cancelled'}.`);
      await loadOrders(page);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Unable to ${action} order.`);
    } finally {
      setCommanding(false);
    }
  };

  const correctTotal = async () => {
    if (!selected || !correctionReason.trim()) return;
    const amount = Number(correctedTotal);
    if (!Number.isFinite(amount) || amount < 0 || Math.round(amount * 100) > selectedOriginalTotal) {
      setStatus(`Enter an amount between $0.00 and ${money(selectedOriginalTotal)}.`);
      return;
    }
    setCommanding(true);
    try {
      const updated = await apiRequest<Order>(`/orders/${selected.id}/correct-total`, {
        method: 'PATCH',
        body: JSON.stringify({ correctedTotalMinor: Math.round(amount * 100), reason: correctionReason }),
      });
      setSelected(updated);
      setCorrectedTotal((updated.totalMinor / 100).toFixed(2));
      setCorrectionReason('');
      setStatus('Order total corrected.');
      await loadOrders(page);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to correct the order total.');
    } finally {
      setCommanding(false);
    }
  };

  const processCutoff = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cutoffDate || processingCutoff) return;
    setProcessingCutoff(true);
    setStatus('');
    try {
      const result = await apiRequest<{ processed: boolean; cancelled: number; confirmed: number; billable: number }>(
        `/cutoffs/${cutoffDate}/process`,
        { method: 'POST' },
      );
      setStatus(result.processed
        ? `Orders updated for ${cutoffDate}: ${result.confirmed} confirmed and ${result.cancelled} unfinished drafts cancelled.`
        : 'Orders for this date were already updated. Nothing changed.');
      await loadOrders(page);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to process cutoff.');
    } finally {
      setProcessingCutoff(false);
    }
  };

  const openOrder = async (order: Order) => {
    try {
      const detail = await apiRequest<Order>(`/orders/${order.id}`);
      setSelected(detail);
      setEmployeeId(detail.employee.id);
      setDeliveryDate(detail.deliveryDate.slice(0, 10));
      setDeliveryTime(detail.deliveryTime);
      setPackaging(detail.packaging);
      setAddress({ addressLine1: detail.addressLine1, addressLine2: detail.addressLine2 ?? '', city: detail.city, postalCode: detail.postalCode, instructions: '' });
      setCorrectedTotal((detail.totalMinor / 100).toFixed(2));
      setCorrectionReason('');
      const [employeeMenu, nextDate] = await Promise.all([
        apiRequest<MenuResponse>(`/employees/${detail.employee.id}/menu`),
        apiRequest<{ date: string }>(`/orders/next-delivery-date?employeeId=${encodeURIComponent(detail.employee.id)}`),
      ]);
      setMenu(employeeMenu);
      setMinimumDeliveryDate(nextDate.date);
      setLines(detail.lines.map((line) => {
        const dish = employeeMenu.menu.categories.flatMap((category) => category.dishes).find((candidate) => candidate.name === line.dishNameSnapshot) ?? { id: line.skuSnapshot, name: line.dishNameSnapshot, sku: line.skuSnapshot, priceMinor: line.dishUnitPriceMinor, optionGroups: [] };
        return {
          dish,
          quantity: line.quantity,
          combinations: line.combinations.map((combination) => ({
            quantity: combination.quantity,
            selections: combination.options.map((snapshot) => {
              const groups = dish.optionGroups ?? [];
              const preferredGroup = combination.optionGroupId
                ? groups.find((group) => group.id === combination.optionGroupId)
                : undefined;
              const matches = (preferredGroup ? [preferredGroup] : groups).flatMap((group) =>
                group.options
                  .filter((option) => option.id === snapshot.optionId || option.name === snapshot.optionNameSnapshot)
                  .map((option) => ({ optionGroupId: group.id, optionId: option.id })),
              );
              return matches[0];
            }).filter((selection): selection is { optionGroupId: string; optionId: string } => Boolean(selection)),
          })),
        };
      }));
    } catch (error) {
      setMenu(null);
      setLines([]);
      setStatus(error instanceof Error ? error.message : 'Could not open this order. Please try again.');
    }
  };

  if (authLoading) return <div className="container" style={{ paddingTop: '4rem', textAlign: 'center' }}>Loading session...</div>;
  if (!user) return <div className="container" style={{ paddingTop: '4rem', textAlign: 'center' }}>Please log in to manage orders.</div>;

  return (
    <div className="container" style={{ paddingBottom: '5rem', maxWidth: 1370 }}>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow"><ClipboardList size={15} /> Orders</span>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">{canCreateOrders ? 'Choose an employee, add dishes and save a draft. When it is ready, place the order.' : 'Select an order to see its delivery details and progress.'}</p>
        </div>
        {canCreateOrders && <button className="btn-primary" type="button" onClick={resetForm}><Plus size={16} /> New order</button>}
      </div>

      {status && <div className="notice" role="status" style={{ marginBottom: '1rem' }}>{status}</div>}

      {canOverrideOrders && <form onSubmit={processCutoff} className="glass-panel" style={{ padding: '1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'end', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}><strong>Close ordering for a delivery date</strong><p className="help-note" style={{ marginTop: 4 }}>After the ordering deadline, confirm placed orders and cancel unfinished drafts.</p></div>
        <label className="form-label" style={{ minWidth: 210 }}>Delivery date<input className="form-input" type="date" required value={cutoffDate} onChange={(event) => setCutoffDate(event.target.value)} /></label>
        <button className="btn-secondary" type="submit" disabled={processingCutoff}><CalendarDays size={15} /> {processingCutoff ? 'Updating orders…' : 'Close ordering'}</button>
      </form>}

      <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '0.75rem' }}>
        <input className="form-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, employee, company" aria-label="Search orders" />
        <select className="form-input" value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}><option value="">All companies</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
        <select className="form-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by order status"><option value="">All statuses</option>{['DRAFT', 'PLACED', 'CONFIRMED', 'KITCHEN_IN_PROGRESS', 'KITCHEN_READY', 'DISPATCH_READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED'].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select>
        <select className="form-input" value={invoicedFilter} onChange={(event) => setInvoicedFilter(event.target.value)}><option value="">Invoice: all</option><option value="true">Invoiced</option><option value="false">Not invoiced</option></select>
        <label className="form-label">Delivery from<input className="form-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="form-label">Delivery through<input className="form-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>

      <div className="order-workspace">
        <div className="glass-panel" style={{ padding: '1.2rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Order list</h2>
          {loading ? <div className="empty-state">Loading orders…</div> : !orders?.items.length ? <div className="empty-state">No orders found. Try changing your search or date filters.</div> : <div style={{ display: 'grid', gap: 8 }}>
            {orders.items.map((order) => <button type="button" key={order.id} onClick={() => void openOrder(order)} className={`order-list-item ${selected?.id === order.id ? 'selected' : ''}`} aria-pressed={selected?.id === order.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong>{order.employee?.name ?? 'Employee'}</strong><span className="badge badge-cloud">{statusLabel(order.status)}</span></div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 5 }}>{order.company?.name} · {order.deliveryDate.slice(0, 10)} · {money(order.totalMinor)}</div>
            </button>)}
          </div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <button className="btn-secondary btn-sm" type="button" disabled={!orders || page <= 1} onClick={() => void loadOrders(page - 1)}><ChevronLeft size={15} /> Prev</button>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Page {orders?.page ?? 1} / {orders?.totalPages ?? 1}</span>
            <button className="btn-secondary btn-sm" type="button" disabled={!orders || page >= (orders?.totalPages ?? 1)} onClick={() => void loadOrders(page + 1)}>Next <ChevronRight size={15} /></button>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.2rem' }}>
          {!canCreateOrders && !selected && <div className="empty-state">Select an order from the list to see its details and progress.</div>}
          {canCreateOrders && (!selected || ['DRAFT', 'PLACED', 'CONFIRMED', 'KITCHEN_IN_PROGRESS', 'KITCHEN_READY'].includes(selected.status)) && <form onSubmit={saveOrder}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}><div><h2 style={{ fontSize: '1.1rem' }}>{selected ? `Order for ${selected.employee.name}` : 'Create an order'}</h2><p className="help-note" style={{ marginTop: 4 }}>{selected ? 'Review the details below before saving changes.' : 'Start by choosing an employee. Their available dishes will appear below.'}</p></div>{selected && <span className="badge badge-user">{statusLabel(selected.status)}</span>}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
              <label className="form-label">Employee<select className="form-input" disabled={Boolean(selected)} value={employeeId} onChange={(event) => void loadEmployeeMenu(event.target.value)}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.company?.name}</option>)}</select></label>
              <label className="form-label">Delivery date<input className="form-input" type="date" required disabled={isOperationalOverride} min={isOperationalOverride ? undefined : minimumDeliveryDate || undefined} value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} /></label>
              <label className="form-label">Delivery time<input className="form-input" type="time" disabled={Boolean(selectedEmployee && !canChangeTime)} value={deliveryTime} onChange={(event) => setDeliveryTime(event.target.value)} placeholder="Company default" /></label>
              <label className="form-label">Packaging<input className="form-input" disabled={Boolean(selectedEmployee && !canChangePackaging)} value={packaging} onChange={(event) => setPackaging(event.target.value)} placeholder="Company default" /></label>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}><h3 style={{ fontSize: '1rem' }}>Delivery address</h3><small style={{ color: 'var(--text-muted)' }}>{canUseAddress ? 'Employee may choose address' : 'Company default address'}</small></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
                <input className="form-input" disabled={!canUseAddress} placeholder="Address line 1" value={address.addressLine1} onChange={(event) => setAddress({ ...address, addressLine1: event.target.value })} />
                <input className="form-input" disabled={!canUseAddress} placeholder="City" value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} />
                <input className="form-input" disabled={!canUseAddress} placeholder="Postal code" value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value })} />
                <input className="form-input" disabled={!canUseAddress} placeholder="Line 2" value={address.addressLine2} onChange={(event) => setAddress({ ...address, addressLine2: event.target.value })} />
              </div>
            </div>

            {!isOperationalOverride && <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><div><h3 style={{ fontSize: '1rem' }}>Choose dishes</h3><p className="help-note">Add a dish, then choose its options and quantity.</p></div><strong>{money(subtotal)}</strong></div>
              {menuLoading && <div style={{ color: 'var(--text-muted)', padding: '0.5rem 0' }}>Loading employee dishes...</div>}
              {availableMenuDishes.map((dish) => <button type="button" className="btn-secondary btn-sm" key={dish.id} onClick={() => addDish(dish)}><ShoppingBasket size={14} /> {dish.name}</button>)}
              {!lines.length ? <div style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>{employeeId ? menuLoading ? '' : menu && (menu.menu?.categories ?? []).length === 0 ? 'No dishes are available for this employee.' : 'Choose a dish from the employee menu.' : 'Select an employee to load the menu.'}</div> : lines.map((line, lineIndex) => <div key={`${line.dish.id}-${lineIndex}`} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><strong>{line.dish.name}</strong><button type="button" className="btn-secondary btn-sm" onClick={() => setLines((current) => current.filter((_, index) => index !== lineIndex))}><XCircle size={14} /></button></div>
                <label className="form-label" style={{ marginTop: 8 }}>Total quantity<input className="form-input" min={line.dish.minQuantity ?? 1} type="number" value={line.quantity} onChange={(event) => { const quantity = Number(event.target.value); updateLine(lineIndex, { quantity, combinations: line.combinations.map((combination, index) => index === 0 ? { ...combination, quantity } : combination) }); }} /></label>
                {line.combinations.map((combination, combinationIndex) => <div key={combinationIndex} style={{ marginTop: 8, padding: 8, background: 'rgba(15,23,42,0.3)', borderRadius: 8 }}><label className="form-label">Quantity with these options<input className="form-input" min={1} type="number" value={combination.quantity} onChange={(event) => updateCombination(lineIndex, combinationIndex, { quantity: Number(event.target.value) })} /></label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginTop: 8 }}>{(line.dish.optionGroups ?? []).map((group) => <label className="form-label" key={group.id}>{group.name}{group.isRequired ? ' *' : ''}<select className="form-input" value={combination.selections.find((selection) => selection.optionGroupId === group.id)?.optionId ?? ''} onChange={(event) => updateCombination(lineIndex, combinationIndex, { selections: [...combination.selections.filter((selection) => selection.optionGroupId !== group.id), ...(event.target.value ? [{ optionGroupId: group.id, optionId: event.target.value }] : [])] })}><option value="">{group.isRequired ? 'Select option' : 'None'}</option>{group.options.map((option) => <option key={option.id} value={option.id}>{option.name} (+{money(option.effectivePriceMinor ?? option.priceMinor ?? Math.round((option.price ?? 0) * 100))})</option>)}</select></label>)}</div>
                </div>)}
              </div>)}
            </div>}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: '1rem', flexWrap: 'wrap' }}>
              {!selected && <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)' }}><input type="checkbox" checked={placeOnSave} onChange={(event) => setPlaceOnSave(event.target.checked)} /> Place immediately</label>}
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}><button className="btn-primary" type="submit" disabled={saving || commanding}><Save size={15} /> {saving ? 'Saving…' : isOperationalOverride ? 'Save delivery changes' : selected ? 'Save changes' : 'Save draft'}</button>{selected?.status === 'DRAFT' && <button className="btn-secondary" type="button" disabled={commanding} onClick={() => void command('place')}><Send size={15} /> {commanding ? 'Updating…' : 'Place order'}</button>}{selected && ['DRAFT', 'PLACED', 'CONFIRMED', 'KITCHEN_IN_PROGRESS', 'KITCHEN_READY'].includes(selected.status) && <button className="btn-secondary" type="button" disabled={commanding} onClick={() => void command('cancel')} style={{ color: '#fb7185' }}><XCircle size={14} /> Cancel order</button>}</div>
            </div>
          </form>}

          {selected && <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '1.25rem', paddingTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>Order detail</h3>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 10 }}>{selected.deliveryDate.slice(0, 10)} at {selected.deliveryTime} · {selected.addressLine1}, {selected.city} {selected.postalCode} · {selected.packaging}</div>
            {(selected.lines ?? []).map((line) => <div key={line.id} style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '0.65rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><strong>{line.dishNameSnapshot} × {line.quantity}</strong><strong>{money(line.totalMinor)}</strong></div>
              {line.combinations.map((combination, index) => <div key={index} style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 3 }}>{combination.quantity} × {combination.options.map((option) => option.optionNameSnapshot).join(', ') || 'No options'} · {money(combination.totalMinor)}</div>)}
            </div>)}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}><strong>Total</strong><strong>{money(selected.totalMinor)}</strong></div>
          </div>}

          {selected && canOverrideOrders && ['CONFIRMED', 'KITCHEN_IN_PROGRESS', 'KITCHEN_READY', 'DISPATCH_READY', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(selected.status) && <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '1.25rem', paddingTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>Correct the amount charged</h3>
            <p className="help-note" style={{ marginBottom: 8 }}>Use this if less was delivered than ordered. Enter the new full total in dollars and explain why. This is available before invoicing.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}><label className="form-label" style={{ flex: '0 1 160px' }}>New total ($)<input className="form-input" type="number" min="0" step="0.01" max={(selectedOriginalTotal / 100).toFixed(2)} value={correctedTotal} onChange={(event) => setCorrectedTotal(event.target.value)} /></label><label className="form-label" style={{ flex: '1 1 230px' }}>Reason<input className="form-input" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="For example, one item was missing" /></label><button className="btn-secondary" type="button" disabled={commanding || !correctionReason.trim()} onClick={() => void correctTotal()}>Save correction</button></div>
          </div>}

          {selected && <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '1.25rem', paddingTop: '1rem' }}><h3 style={{ fontSize: '1rem', marginBottom: 8 }}><Eye size={15} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Order progress</h3>{(selected.timelineEvents ?? []).map((event) => <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '0.45rem 0', color: 'var(--text-muted)', fontSize: '0.84rem' }}><span><strong style={{ color: 'var(--text-main)' }}>{statusLabel(event.status)}</strong>{event.note ? ` · ${event.note}` : ''}</span><span>{new Date(event.createdAt).toLocaleString()}</span></div>)}</div>}
        </div>
      </div>
    </div>
  );
}
