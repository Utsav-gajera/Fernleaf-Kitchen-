'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import { ShieldCheck, User as UserIcon, LogOut, Lock, Sparkles } from 'lucide-react';

type DashboardData = {
  date: string;
  metrics: Record<string, number | string | null | { id: string; deliveryAt: string; deliveryTime: string; addressLine1: string; city: string; postalCode: string }>;
};

function MetricCards({ data, role }: { data: DashboardData; role: string }) {
  const definitions: Record<string, Array<[string, string]>> = {
    ADMIN: [
      ['todaysOrders', "Today's orders"],
      ['todaysConfirmedValueMinor', "Today's confirmed value"],
      ['uninvoicedOrders', 'Uninvoiced orders'],
      ['lateDeliveries', 'Late deliveries'],
      ['ordersRequiringAttention', 'Orders requiring attention'],
    ],
    KITCHEN: [
      ['pendingUnits', 'Pending units'],
      ['inProgress', 'In progress'],
      ['doneUnits', 'Done'],
      ['atRiskUnits', 'At risk'],
      ['lateUnits', 'Late'],
    ],
    DISPATCH: [
      ['kitchenReady', 'Kitchen ready'],
      ['waitingForDriver', 'Waiting for driver'],
      ['dispatchReady', 'Dispatch ready'],
      ['outForDelivery', 'Out for delivery'],
      ['lateDrops', 'Late'],
    ],
    DRIVER: [
      ['nextDrop', 'Next drop'],
      ['remainingDrops', 'Remaining drops'],
      ['completedDrops', 'Completed'],
    ],
  };
  const cards = definitions[role] ?? [];
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.2rem', marginBottom: '0.8rem' }}>Today&apos;s operations</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.8rem' }}>
        {cards.map(([key, label]) => {
          const value = data.metrics[key];
          let display: string | number = value as string | number;
          if (key === 'todaysConfirmedValueMinor' && typeof value === 'number') {
            display = `$${(value / 100).toFixed(2)}`;
          } else if (key === 'nextDrop' && value && typeof value === 'object') {
            display = `${value.deliveryTime} · ${value.addressLine1}, ${value.city}`;
          } else if (value === null) {
            display = 'None';
          }
          return <div className="glass-panel" key={key} style={{ padding: '1rem' }}><div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{label}</div><div style={{ fontWeight: 700, fontSize: key === 'nextDrop' ? '1rem' : '1.6rem', marginTop: '0.35rem' }}>{display}</div></div>;
        })}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.6rem' }}>Kitchen-local date: {data.date}</div>
    </section>
  );
}

export default function DashboardPage() {
  const { user, isLoading, logout, isAdmin } = useAuth();
  const [dashboard, setDashboard] = React.useState<DashboardData | null>(null);
  const [dashboardError, setDashboardError] = React.useState('');

  React.useEffect(() => {
    if (!user) return;
    apiRequest<DashboardData>('/dashboard')
      .then(setDashboard)
      .catch((error) => setDashboardError(error instanceof Error ? error.message : 'Unable to load dashboard.'));
  }, [user]);

  if (isLoading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '6rem 1rem' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading session...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className="container animate-fade-in"
        style={{ textAlign: 'center', padding: '6rem 1rem' }}
      >
        <div
          className="glass-panel"
          style={{ maxWidth: '480px', margin: '0 auto', padding: '3rem 2rem' }}
        >
          <Lock size={40} color="var(--rose)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.8rem' }}>Authentication Required</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.95rem' }}>
            Please log in to view this dashboard. Staff accounts are created by administrators.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link href="/login" className="btn-primary" id="dashboard-login-redirect-btn">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ paddingBottom: '5rem' }}>
      {/* User Profile Header Card */}
      <div
        className="glass-panel"
        style={{
          padding: '2rem',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: isAdmin
                ? 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)'
                : 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            {isAdmin ? <ShieldCheck size={28} color="#fff" /> : <UserIcon size={28} color="#fff" />}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>{user.name || 'User'}</h1>
              <span className={`badge ${isAdmin ? 'badge-admin' : 'badge-user'}`}>{user.role}</span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px' }}>
              {user.email}
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="btn-secondary"
          id="dashboard-logout-btn"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f43f5e' }}
        >
          <LogOut size={16} />
          <span>Log Out</span>
        </button>
      </div>

      {/* Welcome Message */}
      <div
        className="glass-panel"
        style={{
          padding: '2.5rem',
          marginBottom: '2rem',
          borderLeft: isAdmin ? '4px solid #a855f7' : '4px solid var(--emerald)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
          <Sparkles size={22} color={isAdmin ? '#c084fc' : '#34d399'} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>
            Welcome back, {user.name || user.email}!
          </h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
          {isAdmin
            ? 'You have administrative access to management and operational workspaces. Driver self-service remains scoped to the assigned driver.'
            : "You're signed in with a standard account. Explore your personalized content below."}
        </p>
      </div>

      {dashboardError && <p style={{ color: '#fb7185' }}>{dashboardError}</p>}
      {dashboard && <MetricCards data={dashboard} role={user.role} />}

      {isAdmin && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <Link href="/dashboard/companies" className="glass-panel" style={{ padding: '1.2rem 1.1rem', textDecoration: 'none' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Companies</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Manage company records, domains, owners and delivery defaults.</div>
          </Link>
          <Link href="/dashboard/employees" className="glass-panel" style={{ padding: '1.2rem 1.1rem', textDecoration: 'none' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Employees</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Maintain employee assignments, allergies and permissions.</div>
          </Link>
          <Link href="/dashboard/catalogue" className="glass-panel" style={{ padding: '1.2rem 1.1rem', textDecoration: 'none' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Catalogue</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Manage dishes, reusable options, option groups, categories, and menu reference data.</div>
          </Link>
          <Link href="/dashboard/pricing" className="glass-panel" style={{ padding: '1.2rem 1.1rem', textDecoration: 'none' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Pricing</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Review tiers, derived pricing, and missing dish prices.</div>
          </Link>
          <Link href="/dashboard/menu" className="glass-panel" style={{ padding: '1.2rem 1.1rem', textDecoration: 'none' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Menu Preview</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Check the exact employee-facing menu for a company and employee.</div>
          </Link>
          <Link href="/dashboard/orders" className="glass-panel" style={{ padding: '1.2rem 1.1rem', textDecoration: 'none' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Orders</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Create, edit, place, cancel, and review employee order timelines.</div>
          </Link>
          <Link href="/dashboard/kitchen" className="glass-panel" style={{ padding: '1.2rem 1.1rem', textDecoration: 'none' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Kitchen</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Review prep units and kitchen readiness.</div>
          </Link>
          <Link href="/dashboard/staff" className="glass-panel" style={{ padding: '1.2rem 1.1rem', textDecoration: 'none' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Staff</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Create staff accounts, assign roles, and manage account activation.</div>
          </Link>
        </div>
      )}

      {/* Role-Specific Info */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
        }}
      >
        <div className="glass-panel" style={{ padding: '1.8rem' }}>
          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              marginBottom: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isAdmin ? (
              <ShieldCheck size={18} color="var(--accent-primary)" />
            ) : (
              <UserIcon size={18} color="var(--accent-primary)" />
            )}
            <span>Your Access Level</span>
          </h3>
          <ul
            style={{
              listStyle: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <li>✓ Access your personal dashboard</li>
            <li>✓ Secure session management</li>
            {isAdmin && <li>✓ Full administrative privileges</li>}
            <li>✓ Instant logout and session termination</li>
          </ul>
        </div>

        <div className="glass-panel" style={{ padding: '1.8rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.8rem' }}>
            Account Details
          </h3>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontSize: '0.9rem',
              color: 'var(--text-muted)',
            }}
          >
            <div>
              <span
                style={{
                  color: 'var(--text-dim)',
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Name
              </span>
              <div style={{ marginTop: '2px', color: 'var(--text-primary)' }}>
                {user.name || '—'}
              </div>
            </div>
            <div>
              <span
                style={{
                  color: 'var(--text-dim)',
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Email
              </span>
              <div style={{ marginTop: '2px', color: 'var(--text-primary)' }}>{user.email}</div>
            </div>
            <div>
              <span
                style={{
                  color: 'var(--text-dim)',
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Role
              </span>
              <div style={{ marginTop: '4px' }}>
                <span className={`badge ${isAdmin ? 'badge-admin' : 'badge-user'}`}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
