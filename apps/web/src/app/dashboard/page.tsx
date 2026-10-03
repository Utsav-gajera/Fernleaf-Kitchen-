'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, User as UserIcon, LogOut, Lock, Sparkles } from 'lucide-react';

export default function DashboardPage() {
  const { user, isLoading, logout, isAdmin } = useAuth();

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
            Please log in or register an account to view this dashboard.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link href="/login" className="btn-primary" id="dashboard-login-redirect-btn">
              Go to Login
            </Link>
            <Link href="/register" className="btn-secondary">
              Register
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
            ? 'You have administrative access. You can manage users and access all protected resources.'
            : "You're signed in with a standard account. Explore your personalized content below."}
        </p>
      </div>

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
