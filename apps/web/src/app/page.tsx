'use client';

import Link from 'next/link';
import { ArrowRight, ChefHat, CheckCircle2, ClipboardList, Leaf, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <main className="container animate-fade-in" style={{ paddingTop: 'clamp(3rem, 7vw, 6rem)', paddingBottom: '5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 'clamp(2rem, 5vw, 5rem)', alignItems: 'center' }}>
        <div>
          <span className="page-eyebrow"><Leaf size={15} /> One kitchen, one clear workflow</span>
          <h1 style={{ fontSize: 'clamp(2.8rem, 7vw, 5.2rem)', lineHeight: 1.04, marginBottom: '1.25rem', maxWidth: 720 }}>A smoother day starts <span className="gradient-text">here.</span></h1>
          <p className="page-subtitle" style={{ fontSize: '1.1rem', marginBottom: '2rem' }}>FernLeaf Kitchen keeps orders, preparation and deliveries together—so your team always knows what comes next.</p>
          <Link href={user ? '/dashboard' : '/login'} className="btn-primary" id={user ? 'hero-dashboard-btn' : 'hero-login-btn'} style={{ padding: '0.9rem 1.35rem' }}>
            {user ? 'Open my workspace' : 'Sign in to get started'} <ArrowRight size={18} />
          </Link>
          <p className="help-note" style={{ marginTop: 14 }}>{user ? 'Your work for today is waiting on the overview page.' : 'Your administrator can provide your sign-in details.'}</p>
        </div>

        <div className="glass-panel" style={{ padding: '1.4rem', background: 'linear-gradient(150deg, rgba(51,99,67,.65), rgba(23,38,37,.96) 58%)', borderColor: 'rgba(169,232,157,.28)' }} aria-label="How the kitchen workflow works">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}><span className="page-eyebrow" style={{ margin: 0 }}>Today&apos;s flow</span><CheckCircle2 color="var(--accent-primary)" size={20} /></div>
          {[
            { icon: ClipboardList, title: 'Orders', description: 'Create, review and confirm what people need.' },
            { icon: ChefHat, title: 'Kitchen', description: 'Prepare each dish and mark it ready.' },
            { icon: Truck, title: 'Delivery', description: 'Assign a driver and get food on its way.' },
          ].map(({ icon: Icon, title, description }, index) => (
            <div key={title} style={{ display: 'flex', gap: 14, padding: '1rem 0', borderTop: index ? '1px solid var(--border-color)' : undefined }}>
              <span className="surface-link-icon"><Icon size={20} /></span>
              <div><h2 style={{ fontSize: '1.05rem', marginBottom: 4 }}>{title}</h2><p className="help-note">{description}</p></div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
