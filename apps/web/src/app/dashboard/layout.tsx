'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../types';

const adminOnly = ['/dashboard/companies', '/dashboard/employees', '/dashboard/catalogue', '/dashboard/pricing', '/dashboard/menu'];

function requiredRoles(pathname: string): Role[] | null {
  if (adminOnly.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return ['ADMIN'];
  if (pathname === '/dashboard/kitchen' || pathname.startsWith('/dashboard/kitchen/')) return ['KITCHEN'];
  if (pathname === '/dashboard/dispatch' || pathname.startsWith('/dashboard/dispatch/')) return ['ADMIN', 'DISPATCH'];
  if (pathname === '/dashboard/orders' || pathname.startsWith('/dashboard/orders/')) return ['ADMIN', 'DISPATCH'];
  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const roles = requiredRoles(pathname);

  if (isLoading) {
    return <div className="container" style={{ padding: '5rem 1rem', textAlign: 'center' }}>Loading session...</div>;
  }
  if (!user) return <>{children}</>;
  if (roles && !roles.includes(user.role)) {
    return (
      <main className="container" style={{ padding: '5rem 1rem', textAlign: 'center' }}>
        <Lock size={40} color="var(--rose)" />
        <h1>Access restricted</h1>
        <p className="text-muted">Your {user.role.toLowerCase()} role does not have access to this workspace.</p>
      </main>
    );
  }
  return <>{children}</>;
}
