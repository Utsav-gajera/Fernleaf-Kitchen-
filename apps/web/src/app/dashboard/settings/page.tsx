'use client';

import React, { useEffect, useState } from 'react';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';

type Settings = {
  kitchenTimeZone: string;
  cutOffTime: string;
  cutOffWorkingDays: number;
  kitchenReadyBufferMinutes: number;
  mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean; sat: boolean; sun: boolean;
  kitchenHolidays: Array<{ date: string; name: string }>;
};

const defaultSettings: Settings = {
  kitchenTimeZone: 'Asia/Kolkata', cutOffTime: '16:00', cutOffWorkingDays: 2,
  kitchenReadyBufferMinutes: 30,
  mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false, kitchenHolidays: [],
};

function normalizeSettings(value: Partial<Settings> | null | undefined): Settings {
  return {
    ...defaultSettings,
    ...value,
    kitchenHolidays: Array.isArray(value?.kitchenHolidays) ? value.kitchenHolidays : [],
  };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(defaultSettings);
  const [holiday, setHoliday] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      apiRequest<Partial<Settings>>('/settings')
        .then((value) => setSettings(normalizeSettings(value)))
        .catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to load settings.'));
    }
  }, [user]);

  const update = (key: keyof Settings, value: string | number | boolean) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setSaving(true); setMessage('');
    try {
      const {
        kitchenTimeZone, cutOffTime, cutOffWorkingDays,
        kitchenReadyBufferMinutes, mon, tue, wed, thu, fri, sat, sun,
      } = settings;
      const updated = await apiRequest<Partial<Settings>>('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          kitchenTimeZone, cutOffTime, cutOffWorkingDays,
          kitchenReadyBufferMinutes,
          mon, tue, wed, thu, fri, sat, sun,
          kitchenHolidays: settings.kitchenHolidays.map((item) => item.date),
        }),
      });
      setSettings(normalizeSettings(updated));
      setMessage('Settings saved.');
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save settings.'); }
    finally { setSaving(false); }
  };
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

  return (
    <main className="container" style={{ maxWidth: 760, paddingBottom: '5rem' }}>
      <div className="page-heading"><div><span className="page-eyebrow"><SettingsIcon size={15} /> Kitchen schedule</span><h1 className="page-title">Settings</h1><p className="page-subtitle">Set when the kitchen works and how early orders must be placed. Changes affect future ordering dates.</p></div></div>
      <section className="glass-panel" style={{ padding: '1rem', display: 'grid', gap: 14 }}>
        <label className="form-label">Kitchen time zone<input className="form-input" value={settings.kitchenTimeZone} onChange={(e) => update('kitchenTimeZone', e.target.value)} placeholder="Asia/Kolkata" /><span className="help-note">Used to decide when the ordering deadline passes.</span></label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
          <label className="form-label">Ordering deadline time<input className="form-input" type="time" value={settings.cutOffTime} onChange={(e) => update('cutOffTime', e.target.value)} /></label>
          <label className="form-label">Working days before delivery<input className="form-input" type="number" min="0" max="31" value={settings.cutOffWorkingDays} onChange={(e) => update('cutOffWorkingDays', Number(e.target.value))} /><span className="help-note">Weekends and kitchen holidays are skipped.</span></label>
        </div>
        <div>
          <label className="form-label">Minutes needed between food being ready and dispatch<input className="form-input" type="number" min="0" max="1440" value={settings.kitchenReadyBufferMinutes} onChange={(e) => update('kitchenReadyBufferMinutes', Number(e.target.value))} /></label>
        </div>
        <div><strong>Kitchen working days</strong><p className="help-note">Only selected days count toward the ordering deadline.</p><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>{days.map((day) => <label key={day}><input type="checkbox" checked={settings[day]} onChange={(e) => update(day, e.target.checked)} /> {({ mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' } as const)[day]}</label>)}</div></div>
        <div><strong>Kitchen holidays</strong><div style={{ display: 'flex', gap: 8, marginTop: 8 }}><input className="form-input" type="date" value={holiday} onChange={(e) => setHoliday(e.target.value)} /><button className="btn-secondary" type="button" onClick={() => { if (holiday && !settings.kitchenHolidays.some((item) => item.date === holiday)) { setSettings((current) => ({ ...current, kitchenHolidays: [...current.kitchenHolidays, { date: holiday, name: 'Kitchen holiday' }] })); setHoliday(''); } }}>Add</button></div><div style={{ display: 'grid', gap: 6, marginTop: 8 }}>{settings.kitchenHolidays.map((item) => <div key={item.date} style={{ display: 'flex', justifyContent: 'space-between' }}>{item.date}<button className="btn-secondary btn-sm" type="button" onClick={() => setSettings((current) => ({ ...current, kitchenHolidays: current.kitchenHolidays.filter((holidayItem) => holidayItem.date !== item.date) }))}>Remove</button></div>)}</div></div>
        {message && <div className={`notice ${message === 'Settings saved.' ? '' : 'error'}`} role="status">{message}</div>}
        <button className="btn-primary" onClick={() => void save()} disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save settings'}</button>
      </section>
    </main>
  );
}
