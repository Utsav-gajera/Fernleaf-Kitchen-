'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export default function RegisterPage() {
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
          maxWidth: '460px',
          padding: '2.5rem',
          textAlign: 'center',
        }}
      >
        <ShieldCheck
          size={48}
          color="var(--accent-primary)"
          style={{ marginBottom: '1rem' }}
        />
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.6rem' }}>
          Staff accounts are managed by administrators
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
          Public registration is disabled. Contact your administrator to receive an account
          and the correct role for your work.
        </p>
        <Link
          href="/login"
          className="btn-primary"
          style={{ display: 'inline-flex', marginTop: '1.5rem' }}
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
}
