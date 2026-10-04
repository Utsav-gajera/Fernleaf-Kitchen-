'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { apiRequest } from '../../../lib/api';

type Role = 'ADMIN' | 'KITCHEN' | 'DISPATCH' | 'DRIVER';
type Staff = { id: string; email: string; name: string | null; role: Role; isActive: boolean };

const emptyForm = { name: '', email: '', password: '', role: 'KITCHEN' as Role };

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try { setStaff(await apiRequest<Staff[]>('/staff')); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load staff.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage('');
    try {
      await apiRequest('/staff', { method: 'POST', body: JSON.stringify(form) });
      setForm(emptyForm); setMessage('Staff member created.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to create staff member.'); }
  };

  const update = async (id: string, body: object) => {
    try { await apiRequest(`/staff/${id}/${'role' in body ? 'role' : 'status'}`, { method: 'PATCH', body: JSON.stringify(body) }); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update staff member.'); }
  };

  return (
    <main className="container" style={{ maxWidth: 900, paddingBottom: '5rem' }}>
      <div className="page-heading"><div><span className="page-eyebrow"><Users size={15} /> Team access</span><h1 className="page-title">Staff accounts</h1><p className="page-subtitle">Create accounts for your team, choose their work area and turn access on or off.</p></div></div>
      <form className="glass-panel" onSubmit={create} style={{ padding: '1rem', display: 'grid', gap: 12, marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Create staff account</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <label className="form-label">Name<input className="form-input" required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="form-label">Email<input className="form-input" required type="email" placeholder="name@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="form-label">Account password<input className="form-input" required minLength={6} type="password" placeholder="At least 6 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          <label className="form-label">Work area<select className="form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>{(['ADMIN', 'KITCHEN', 'DISPATCH', 'DRIVER'] as Role[]).map((role) => <option key={role} value={role}>{role.charAt(0) + role.slice(1).toLowerCase()}</option>)}</select></label>
        </div>
        <button className="btn-primary" type="submit"><UserPlus size={16} /> Create staff</button>
      </form>
      {message && <div className="notice" role="status" style={{ marginBottom: 16 }}>{message}</div>}
      <section style={{ display: 'grid', gap: 10 }}>
        {staff.map((member) => <article className="glass-panel" key={member.id} style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div><strong>{member.name || member.email}</strong><div className="text-muted">{member.email} · {member.role.charAt(0) + member.role.slice(1).toLowerCase()} · {member.isActive ? 'Active' : 'Inactive'}</div></div>
          <div style={{ display: 'flex', gap: 8 }}><select className="form-input" aria-label={`Work area for ${member.name || member.email}`} value={member.role} onChange={(e) => void update(member.id, { role: e.target.value })}>{(['ADMIN', 'KITCHEN', 'DISPATCH', 'DRIVER'] as Role[]).map((role) => <option key={role} value={role}>{role.charAt(0) + role.slice(1).toLowerCase()}</option>)}</select><button className="btn-secondary btn-sm" onClick={() => void update(member.id, { isActive: !member.isActive })}>{member.isActive ? 'Deactivate' : 'Activate'}</button></div>
        </article>)}
      </section>
    </main>
  );
}
