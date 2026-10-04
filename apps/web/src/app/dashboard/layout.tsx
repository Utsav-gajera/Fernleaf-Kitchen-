'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../types';
import { hasCapability, requiredCapability } from '../../lib/access';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const capability = requiredCapability(pathname);

  if (isLoading) {
    return <div className="container" style={{ padding: '5rem 1rem', textAlign: 'center' }}>Loading session...</div>;
  }
  if (!user) return <>{children}</>;
  if (capability && !hasCapability(user.role as Role, capability)) {
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
