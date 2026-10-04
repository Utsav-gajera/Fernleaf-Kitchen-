'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { LogIn, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="container animate-fade-in"
      style={{
        minHeight: 'calc(100vh - 180px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '2.5rem',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'var(--accent-gradient)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <LogIn size={24} color="#10231b" />
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>
            Welcome back
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Sign in to see your work for today.
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 14px',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#fda4af',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '1.5rem',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.2rem' }}>
            <label className="form-label" htmlFor="login-email">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: '1.8rem' }}>
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            id="login-submit-btn"
            disabled={loading}
            style={{ width: '100%', padding: '13px' }}
          >
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <p className="help-note" style={{ marginTop: '1.4rem', textAlign: 'center' }}>Need an account or can&apos;t sign in? Ask your administrator for help.</p>

      </div>
    </div>
  );
}
