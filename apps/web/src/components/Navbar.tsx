'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChefHat, ClipboardList, CreditCard, LayoutDashboard, Leaf, LogOut, Settings2, Truck, Users, Route } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { hasCapability, NAV_ITEMS } from '../lib/access';

const icons: Record<string, typeof ClipboardList> = {
  '/dashboard/orders': ClipboardList,
  '/dashboard/kitchen': ChefHat,
  '/dashboard/dispatch': Truck,
  '/dashboard/billing': CreditCard,
  '/dashboard/settings': Settings2,
  '/dashboard/staff': Users,
  '/dashboard/driver': Route,
};

const roleNames: Record<string, string> = {
  ADMIN: 'Admin',
  KITCHEN: 'Kitchen',
  DISPATCH: 'Dispatch',
  DRIVER: 'Driver',
};

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="navbar" aria-label="Main navigation">
      <Link href={user ? '/dashboard' : '/'} className="nav-brand" aria-label="FernLeaf Kitchen home">
        <span className="nav-mark"><Leaf size={22} strokeWidth={2.5} /></span>
        <span className="nav-wordmark">FernLeaf <span className="gradient-text">Kitchen</span></span>
      </Link>

      {user ? (
        <>
          <div className="nav-links">
            <Link href="/dashboard" className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`} id="nav-dashboard-btn" aria-current={pathname === '/dashboard' ? 'page' : undefined}>
              <LayoutDashboard size={16} /> Overview
            </Link>
            {NAV_ITEMS.filter((item) => hasCapability(user.role, item.capability)).map((item) => {
              const Icon = icons[item.href];
              return (
                <Link key={item.href} href={item.href} className={`nav-link ${active(item.href) ? 'active' : ''}`} id={item.id} aria-current={active(item.href) ? 'page' : undefined}>
                  <Icon size={16} /> {item.label}
                </Link>
              );
            })}
          </div>
          <div className="nav-actions">
            <span className="badge badge-admin nav-role">{roleNames[user.role] ?? user.role}</span>
            <button type="button" onClick={logout} className="nav-signout" id="nav-logout-btn" aria-label="Sign out">
              <LogOut size={17} /><span>Sign out</span>
            </button>
          </div>
        </>
      ) : (
        <div className="nav-actions">
          <Link href="/login" className="btn-primary btn-sm" id="nav-login-btn">Sign in</Link>
        </div>
      )}
    </nav>
  );
}
