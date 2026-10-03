'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, ShieldCheck, Users, Lock } from 'lucide-react';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="container animate-fade-in" style={{ paddingBottom: '4rem' }}>
      {/* Hero Section */}
      <div
        style={{
          textAlign: 'center',
          padding: '5rem 1rem 4rem',
          maxWidth: '720px',
          margin: '0 auto',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(2.4rem, 5vw, 3.5rem)',
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: '1.2rem',
            letterSpacing: '-0.03em',
          }}
        >
          Welcome to{' '}
          <span className="gradient-text">GameSpotlight</span>
        </h1>

        <p
          style={{
            fontSize: '1.15rem',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            marginBottom: '2.5rem',
          }}
        >
          Sign in to access your personalized dashboard and explore everything available to you.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {user ? (
            <Link href="/dashboard" className="btn-primary" id="hero-dashboard-btn">
              <span>Go to Dashboard</span>
              <ArrowRight size={18} />
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-primary" id="hero-login-btn">
                <span>Sign In</span>
                <ArrowRight size={18} />
              </Link>
              <Link href="/register" className="btn-secondary" id="hero-register-btn">
                <span>Create Account</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Feature Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.5rem',
          maxWidth: '900px',
          margin: '0 auto',
        }}
      >
        <div className="glass-panel" style={{ padding: '1.8rem' }}>
          <div style={{ color: '#38bdf8', marginBottom: '1rem' }}>
            <Users size={28} />
          </div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: 600 }}>Your Account</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Manage your profile and access content tailored to your account.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '1.8rem' }}>
          <div style={{ color: '#10b981', marginBottom: '1rem' }}>
            <ShieldCheck size={28} />
          </div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: 600 }}>Secure Access</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Your data is protected with secure authentication and role-based access control.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '1.8rem' }}>
          <div style={{ color: '#a855f7', marginBottom: '1rem' }}>
            <Lock size={28} />
          </div>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: 600 }}>Privacy First</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            We take your privacy seriously. Only you and authorized roles can access your data.
          </p>
        </div>
      </div>
    </div>
  );
}
