'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { Layers, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();

  return (
    <nav className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              background: 'var(--accent-gradient)',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={20} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
            FernLeaf <span className="gradient-text">Kitchen</span>
          </span>
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <Link href="/" className="btn-secondary btn-sm" id="nav-home-btn">
          Home
        </Link>

        {user ? (
          <>
            <Link href="/dashboard" className="btn-secondary btn-sm" id="nav-dashboard-btn">
              Dashboard
            </Link>
            {(user.role === 'ADMIN' || user.role === 'DISPATCH') && (
              <Link href="/dashboard/orders" className="btn-secondary btn-sm" id="nav-orders-btn">
                Orders
              </Link>
            )}
            {user.role === 'KITCHEN' && (
              <Link href="/dashboard/kitchen" className="btn-secondary btn-sm" id="nav-kitchen-btn">
                Kitchen
              </Link>
            )}
            {(user.role === 'ADMIN' || user.role === 'DISPATCH') && (
              <Link href="/dashboard/dispatch" className="btn-secondary btn-sm" id="nav-dispatch-btn">
                Dispatch
              </Link>
            )}
            {user.role === 'DRIVER' && (
              <Link href="/dashboard/driver" className="btn-secondary btn-sm" id="nav-driver-btn">
                My drops
              </Link>
            )}

            <div
              className={`badge ${isAdmin ? 'badge-admin' : 'badge-user'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              {isAdmin ? <ShieldCheck size={14} /> : <UserIcon size={14} />}
              <span>{user.role}</span>
            </div>

            <button
              onClick={logout}
              className="btn-secondary btn-sm"
              id="nav-logout-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f43f5e' }}
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="btn-secondary btn-sm" id="nav-login-btn">
              Login
            </Link>
            <Link href="/register" className="btn-primary btn-sm" id="nav-register-btn">
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
