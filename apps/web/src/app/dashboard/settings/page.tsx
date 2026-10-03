'use client';

import React, { useEffect, useState } from 'react';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';

type Settings = {
  kitchenTimeZone: string;
  cutOffTime: string;
  cutOffWorkingDays: number;
  mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean; sat: boolean; sun: boolean;
  kitchenHolidays: Array<{ date: string; name: string }>;
};

const defaultSettings: Settings = {
  kitchenTimeZone: 'Asia/Kolkata', cutOffTime: '16:00', cutOffWorkingDays: 2,
  mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false, kitchenHolidays: [],
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(defaultSettings);
  const [holiday, setHoliday] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) apiRequest<Settings>('/settings').then(setSettings).catch((error) => setMessage(error.message));
  }, [user]);

  const update = (key: keyof Settings, value: string | number | boolean) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setSaving(true); setMessage('');
    try {
      const { kitchenTimeZone, cutOffTime, cutOffWorkingDays, mon, tue, wed, thu, fri, sat, sun } = settings;
      await apiRequest('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          kitchenTimeZone, cutOffTime, cutOffWorkingDays,
          mon, tue, wed, thu, fri, sat, sun,
          kitchenHolidays: settings.kitchenHolidays.map((item) => item.date),
        }),
      });
      setMessage('Settings saved.');
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save settings.'); }
    finally { setSaving(false); }
  };
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

  return (
    <main className="container" style={{ maxWidth: 760, paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}><SettingsIcon size={28} color="var(--accent-primary)" /><h1 style={{ margin: 0 }}>Settings</h1></div>
      <section className="glass-panel" style={{ padding: '1rem', display: 'grid', gap: 14 }}>
        <label className="form-label">Kitchen timezone<input className="form-input" value={settings.kitchenTimeZone} onChange={(e) => update('kitchenTimeZone', e.target.value)} placeholder="Asia/Kolkata" /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="form-label">Cutoff time<input className="form-input" type="time" value={settings.cutOffTime} onChange={(e) => update('cutOffTime', e.target.value)} /></label>
          <label className="form-label">Cutoff working days<input className="form-input" type="number" min="0" max="31" value={settings.cutOffWorkingDays} onChange={(e) => update('cutOffWorkingDays', Number(e.target.value))} /></label>
        </div>
        <div><strong>Kitchen working days</strong><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>{days.map((day) => <label key={day}><input type="checkbox" checked={settings[day]} onChange={(e) => update(day, e.target.checked)} /> {day.toUpperCase()}</label>)}</div></div>
        <div><strong>Kitchen holidays</strong><div style={{ display: 'flex', gap: 8, marginTop: 8 }}><input className="form-input" type="date" value={holiday} onChange={(e) => setHoliday(e.target.value)} /><button className="btn-secondary" type="button" onClick={() => { if (holiday && !settings.kitchenHolidays.some((item) => item.date === holiday)) { setSettings((current) => ({ ...current, kitchenHolidays: [...current.kitchenHolidays, { date: holiday, name: 'Kitchen holiday' }] })); setHoliday(''); } }}>Add</button></div><div style={{ display: 'grid', gap: 6, marginTop: 8 }}>{settings.kitchenHolidays.map((item) => <div key={item.date} style={{ display: 'flex', justifyContent: 'space-between' }}>{item.date}<button className="btn-secondary btn-sm" type="button" onClick={() => setSettings((current) => ({ ...current, kitchenHolidays: current.kitchenHolidays.filter((holidayItem) => holidayItem.date !== item.date) }))}>Remove</button></div>)}</div></div>
        {message && <p style={{ color: message === 'Settings saved.' ? '#86efac' : '#fb7185', margin: 0 }}>{message}</p>}
        <button className="btn-primary" onClick={() => void save()} disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save settings'}</button>
      </section>
    </main>
  );
}
