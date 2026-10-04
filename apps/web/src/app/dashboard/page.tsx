'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Building2, ChefHat, ClipboardList, CreditCard, Menu, Settings2, SlidersHorizontal, Sparkles, Truck, Users, Route } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';

type DashboardData = {
  date: string;
  metrics: Record<string, number | string | null | { deliveryTime: string; addressLine1: string; city: string }>;
};

const metricDefinitions: Record<string, Array<{ key: string; label: string; href?: string }>> = {
  ADMIN: [
    { key: 'todaysOrders', label: 'Orders today', href: '/dashboard/orders' },
    { key: 'ordersRequiringAttention', label: 'Need attention', href: '/dashboard/orders' },
    { key: 'uninvoicedOrders', label: 'Ready to invoice', href: '/dashboard/billing' },
    { key: 'lateDeliveries', label: 'Late deliveries', href: '/dashboard/dispatch' },
  ],
  KITCHEN: [
    { key: 'pendingUnits', label: 'To prepare', href: '/dashboard/kitchen' },
    { key: 'inProgress', label: 'In progress', href: '/dashboard/kitchen' },
    { key: 'doneUnits', label: 'Completed', href: '/dashboard/kitchen' },
    { key: 'atRiskUnits', label: 'Need attention', href: '/dashboard/kitchen' },
  ],
  DISPATCH: [
    { key: 'waitingForDriver', label: 'Need a driver', href: '/dashboard/dispatch' },
    { key: 'dispatchReady', label: 'Ready to send', href: '/dashboard/dispatch' },
    { key: 'outForDelivery', label: 'On the road', href: '/dashboard/dispatch' },
    { key: 'lateDrops', label: 'Running late', href: '/dashboard/dispatch' },
  ],
  DRIVER: [
    { key: 'nextDrop', label: 'Your next stop', href: '/dashboard/driver' },
    { key: 'remainingDrops', label: 'Stops remaining', href: '/dashboard/driver' },
    { key: 'completedDrops', label: 'Completed today', href: '/dashboard/driver' },
  ],
};

const roleIntro: Record<string, { title: string; description: string; href: string; action: string }> = {
  ADMIN: { title: 'Keep the day moving.', description: 'Start with orders that need attention, then check kitchen, deliveries and billing.', href: '/dashboard/orders', action: 'Review orders' },
  KITCHEN: { title: 'Your prep list is ready.', description: 'Start pending dishes, then mark each one complete as it leaves the kitchen.', href: '/dashboard/kitchen', action: 'Open kitchen board' },
  DISPATCH: { title: 'Get deliveries on the road.', description: 'Assign a driver to each ready delivery before sending it out.', href: '/dashboard/dispatch', action: 'Open dispatch board' },
  DRIVER: { title: 'See where you are going next.', description: 'Open your assigned stops, follow the delivery details and mark each stop complete.', href: '/dashboard/driver', action: 'See my stops' },
};

const adminLinks = [
  { href: '/dashboard/companies', title: 'Companies', description: 'Delivery details and schedules', icon: Building2 },
  { href: '/dashboard/employees', title: 'Employees', description: 'People and dietary needs', icon: Users },
  { href: '/dashboard/catalogue', title: 'Menu catalogue', description: 'Dishes, add-ons and categories', icon: BookOpen },
  { href: '/dashboard/pricing', title: 'Pricing', description: 'Price tiers and missing prices', icon: SlidersHorizontal },
  { href: '/dashboard/menu', title: 'Menu preview', description: 'See what an employee can order', icon: Menu },
  { href: '/dashboard/billing', title: 'Billing', description: 'Create and track invoices', icon: CreditCard },
  { href: '/dashboard/staff', title: 'Staff accounts', description: 'Access and account status', icon: Users },
  { href: '/dashboard/settings', title: 'Kitchen settings', description: 'Working days, holidays and cutoffs', icon: Settings2 },
];

const roleLinks: Record<string, typeof adminLinks> = {
  KITCHEN: [{ href: '/dashboard/kitchen', title: 'Kitchen board', description: 'Start and complete dishes', icon: ChefHat }, { href: '/dashboard/orders', title: 'Orders', description: 'Check delivery details', icon: ClipboardList }],
  DISPATCH: [{ href: '/dashboard/dispatch', title: 'Dispatch board', description: 'Assign drivers and send deliveries', icon: Truck }, { href: '/dashboard/orders', title: 'Orders', description: 'Check delivery details', icon: ClipboardList }],
  DRIVER: [{ href: '/dashboard/driver', title: 'My stops', description: 'Your assigned deliveries', icon: Route }],
};

function metricValue(key: string, value: DashboardData['metrics'][string]) {
  if (key === 'nextDrop' && value && typeof value === 'object') {
    return `${value.deliveryTime} · ${value.addressLine1}, ${value.city}`;
  }
  return value === null || value === undefined ? '—' : String(value);
}

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    apiRequest<DashboardData>('/dashboard').then(setDashboard).catch(() => setError('Today’s numbers are unavailable. You can still open your workspaces below.'));
  }, [user]);

  if (isLoading) return <main className="container"><div className="empty-state">Getting your workspace ready…</div></main>;
  if (!user) return <main className="container"><div className="glass-panel" style={{ maxWidth: 530, padding: '2rem', margin: '4rem auto', textAlign: 'center' }}><h1 style={{ marginBottom: 12 }}>Welcome to FernLeaf Kitchen</h1><p className="page-subtitle" style={{ marginBottom: 24 }}>Sign in to see your work for today.</p><Link href="/login" className="btn-primary">Sign in <ArrowRight size={16} /></Link></div></main>;

  const intro = roleIntro[user.role] ?? roleIntro.ADMIN;
  const links = user.role === 'ADMIN' ? adminLinks : roleLinks[user.role] ?? [];
  const metrics = metricDefinitions[user.role] ?? [];

  return (
    <main className="container animate-fade-in" style={{ paddingBottom: '5rem' }}>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow"><Sparkles size={14} /> Your workspace</span>
          <h1 className="page-title">Good to see you, {user.name?.split(' ')[0] || 'there'}.</h1>
          <p className="page-subtitle">Here is what is happening today and where to go next.</p>
        </div>
        {dashboard?.date && <span className="badge badge-cloud">Delivery day: {dashboard.date}</span>}
      </div>

      <section className="glass-panel" style={{ padding: 'clamp(1.4rem, 3vw, 2.2rem)', marginBottom: '1.4rem', background: 'linear-gradient(115deg, rgba(51,99,67,.62), rgba(23,38,37,.92) 62%)', borderColor: 'rgba(169,232,157,.27)' }}>
        <span className="page-eyebrow">Start here</span>
        <h2 style={{ fontSize: 'clamp(1.45rem, 3vw, 2rem)', marginBottom: 10 }}>{intro.title}</h2>
        <p className="page-subtitle" style={{ marginBottom: 22 }}>{intro.description}</p>
        <Link href={intro.href} className="btn-primary">{intro.action} <ArrowRight size={17} /></Link>
      </section>

      {error && <div className="notice warning" style={{ marginBottom: 20 }} role="status">{error}</div>}
      {dashboard && metrics.length > 0 && (
        <section style={{ marginBottom: '2rem' }} aria-label="Today's activity">
          <h2 style={{ fontSize: '1.18rem', marginBottom: 12 }}>Today at a glance</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            {metrics.map((item) => (
              <Link href={item.href ?? intro.href} className="glass-panel metric-card" key={item.key}>
                <span className="help-note">{item.label}</span>
                <div className="metric-value">{metricValue(item.key, dashboard.metrics[item.key])}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="page-heading" style={{ marginBottom: 12 }}><div><h2 style={{ fontSize: '1.2rem' }}>More places to work</h2><p className="help-note">Choose an area to manage or review.</p></div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {links.map(({ href, title, description, icon: Icon }) => (
            <Link href={href} className="glass-panel surface-link" key={href}>
              <div><h3 style={{ fontSize: '1rem', marginBottom: 7 }}>{title}</h3><p className="help-note">{description}</p></div>
              <span className="surface-link-icon"><Icon size={20} /></span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
