'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { Appointment, Clinic, Doctor, Procedure, AppointmentStats } from '@/types';

type Tab = 'stats' | 'all' | 'book' | 'json';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<AppointmentStats | null>(null);
  const [allAppts, setAllAppts] = useState<Appointment[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [procs, setProcs] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookMsg, setBookMsg] = useState<string | null>(null);

  // Manual booking form state
  const [form, setForm] = useState({
    patient_name: '', patient_phone: '',
    procedure_id: '', clinic_id: '', date: '', start_time: '09:00',
    primary_doctor_id: '', notes: '',
  });

  async function loadAll() {
    setLoading(true);
    try {
      const [s, confirmed, completed, cancelled, c, d, p] = await Promise.all([
        api.appointments.stats(),
        api.appointments.list('confirmed'),
        api.appointments.list('completed'),
        api.appointments.list('cancelled'),
        api.data.clinics(),
        api.data.doctors(),
        api.data.procedures(),
      ]);
      setStats(s);
      setAllAppts([...confirmed, ...completed, ...cancelled].sort((a, b) => b.date.localeCompare(a.date)));
      setClinics(c); setDoctors(d); setProcs(p);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const getClinic = (id: string) => clinics.find(c => c.id === id);
  const getDoctor = (id: string) => doctors.find(d => d.id === id);
  const getProc = (id: string) => procs.find(p => p.id === id);

  async function handleManualBook() {
    if (!form.patient_name || !form.procedure_id || !form.clinic_id || !form.date) {
      setBookMsg('❌ Please fill all required fields.');
      return;
    }
    try {
      await api.appointments.create({
        ...form,
        doctor_ids: [form.primary_doctor_id],
        status: 'confirmed',
      });
      setBookMsg('✓ Appointment booked successfully!');
      setForm({ patient_name: '', patient_phone: '', procedure_id: '', clinic_id: '', date: '', start_time: '09:00', primary_doctor_id: '', notes: '' });
      loadAll();
    } catch (e: any) {
      setBookMsg(`❌ Error: ${e.message}`);
    }
  }

  const statusColor: Record<string, string> = {
    confirmed: 'var(--primary)',
    completed: 'var(--green)',
    cancelled: 'var(--red)',
  };

  const METRIC_TABS: { id: Tab; label: string }[] = [
    { id: 'stats', label: '📊 Stats' },
    { id: 'all', label: '📋 All Appointments' },
    { id: 'book', label: '➕ Manual Book' },
    { id: 'json', label: '🖨️ Raw JSON' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
        <div className="px-4 md:px-6 py-4">
          <h1 className="font-serif text-lg font-semibold">🗄 Admin Dashboard</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>Appointment management, statistics, and manual booking</p>
        </div>
        <div className="flex px-4 md:px-6 overflow-x-auto no-scrollbar">
          {METRIC_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-3 md:px-5 py-3 text-xs md:text-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: 'none', border: 'none',
                borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                color: tab === t.id ? 'var(--primary)' : 'var(--text2)',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar">
        {loading ? (
          <div className="flex justify-center pt-20"><div className="spinner" /></div>
        ) : (
          <>
            {/* ── STATS ── */}
            {tab === 'stats' && stats && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 32 }}>
                  {[
                    { label: 'Confirmed', value: stats.total, color: 'var(--primary)' },
                    { label: 'Today', value: stats.today, color: 'var(--amber)' },
                    { label: 'This Week', value: stats.this_week, color: 'var(--purple)' },
                    { label: 'Completed', value: stats.completed, color: 'var(--green)' },
                    { label: 'Cancelled', value: stats.cancelled, color: 'var(--red)' },
                  ].map(m => (
                    <div
                      key={m.label}
                      className="rounded-xl p-4"
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', borderTop: `3px solid ${m.color}` }}
                    >
                      <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>{m.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: m.color, fontFamily: 'var(--font-mono)' }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Procedure breakdown */}
                <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <h3 className="font-serif font-semibold mb-4">Appointments by Procedure</h3>
                  {(() => {
                    const counts: Record<string, number> = {};
                    allAppts.filter(a => a.status !== 'cancelled').forEach(a => {
                      const name = getProc(a.procedure_id)?.name ?? a.procedure_id;
                      counts[name] = (counts[name] ?? 0) + 1;
                    });
                    const max = Math.max(...Object.values(counts), 1);
                    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
                      const proc = procs.find(p => p.name === name);
                      return (
                        <div key={name} className="flex items-center gap-3 mb-3">
                          <div className="w-[80px] md:w-[140px] text-[10px] md:text-xs text-[var(--text2)] flex-shrink-0 text-left md:text-right truncate">{name}</div>
                          <div className="flex-1 rounded-full overflow-hidden" style={{ background: 'var(--card2)', height: 8 }}>
                            <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: proc?.color ?? 'var(--primary)', borderRadius: 4 }} />
                          </div>
                          <div style={{ width: 24, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{count}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            )}

            {/* ── ALL APPOINTMENTS ── */}
            {tab === 'all' && (
              <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full min-w-[700px]" style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                      {['Date', 'Time', 'Patient', 'Procedure', 'Doctor', 'Clinic', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left" style={{ color: 'var(--text2)', fontWeight: 600, fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allAppts.map((a, i) => {
                      const proc = getProc(a.procedure_id);
                      const doc = getDoctor(a.primary_doctor_id);
                      const cli = getClinic(a.clinic_id);
                      return (
                        <tr key={a.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 ? 'var(--card)' : 'var(--bg)' }}>
                          <td className="px-4 py-2.5">{a.date}</td>
                          <td className="px-4 py-2.5" style={{ fontFamily: 'var(--font-mono)' }}>{a.start_time}</td>
                          <td className="px-4 py-2.5">{a.patient_name}</td>
                          <td className="px-4 py-2.5">
                            <span style={{ color: proc?.color ?? 'var(--text)' }}>● </span>{proc?.name ?? a.procedure_id}
                          </td>
                          <td className="px-4 py-2.5">{doc?.name}</td>
                          <td className="px-4 py-2.5">{cli?.short_name}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className="px-2 py-0.5 rounded text-xs font-mono"
                              style={{ background: (statusColor[a.status] ?? '#aaa') + '20', color: statusColor[a.status] ?? '#aaa' }}
                            >
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── MANUAL BOOK ── */}
            {tab === 'book' && (
              <div className="max-w-2xl">
                <div className="rounded-xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <h2 className="font-serif font-semibold text-base mb-5">Manual Appointment Entry</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { label: 'Patient Name *', key: 'patient_name', type: 'text', placeholder: 'Full name' },
                      { label: 'Phone', key: 'patient_phone', type: 'tel', placeholder: '+1-555-…' },
                      { label: 'Date *', key: 'date', type: 'date', placeholder: '' },
                      { label: 'Start Time *', key: 'start_time', type: 'time', placeholder: '' },
                    ].map(field => (
                      <div key={field.key}>
                        <label className="block text-xs mb-1.5" style={{ color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font-mono)' }}>{field.label}</label>
                        <input
                          type={field.type}
                          placeholder={field.placeholder}
                          value={(form as any)[field.key]}
                          onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                          style={{ background: 'var(--card2)', border: '1px solid var(--border2)', color: 'var(--text)' }}
                        />
                      </div>
                    ))}

                    {[
                      { label: 'Procedure *', key: 'procedure_id', options: procs.map(p => ({ value: p.id, label: p.name })) },
                      { label: 'Clinic *', key: 'clinic_id', options: clinics.map(c => ({ value: c.id, label: c.name })) },
                      { label: 'Doctor *', key: 'primary_doctor_id', options: doctors.map(d => ({ value: d.id, label: d.name })) },
                    ].map(field => (
                      <div key={field.key}>
                        <label className="block text-xs mb-1.5" style={{ color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font-mono)' }}>{field.label}</label>
                        <select
                          value={(form as any)[field.key]}
                          onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                          style={{ background: 'var(--card2)', border: '1px solid var(--border2)', color: 'var(--text)' }}
                        >
                          <option value="">Select…</option>
                          {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    ))}

                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs mb-1.5" style={{ color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font-mono)' }}>Notes</label>
                      <textarea
                        rows={2}
                        value={form.notes}
                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                        style={{ background: 'var(--card2)', border: '1px solid var(--border2)', color: 'var(--text)' }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleManualBook}
                    className="mt-5 w-full py-2.5 rounded-lg text-sm font-bold"
                    style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                  >
                    📌 Book Appointment
                  </button>

                  {bookMsg && (
                    <div
                      className="mt-3 px-4 py-2.5 rounded-lg text-sm"
                      style={{
                        background: bookMsg.startsWith('✓') ? 'rgba(52,211,153,0.1)' : 'rgba(255,107,107,0.1)',
                        color: bookMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)',
                        border: `1px solid ${bookMsg.startsWith('✓') ? 'rgba(52,211,153,0.3)' : 'rgba(255,107,107,0.3)'}`,
                      }}
                    >
                      {bookMsg}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── RAW JSON ── */}
            {tab === 'json' && (
              <div className="flex flex-col gap-6">
                <div className="rounded-xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <h2 className="font-serif font-semibold text-base mb-2">Raw Data Export</h2>
                  <p className="text-xs mb-4" style={{ color: 'var(--text2)' }}>Complete dump of all appointment records.</p>
                  <pre
                    className="p-4 rounded-lg overflow-auto"
                    style={{ background: 'var(--card2)', color: 'var(--text)', fontSize: 11, fontFamily: 'var(--font-mono)', border: '1px solid var(--border)' }}
                  >
                    {JSON.stringify(allAppts, null, 2)}
                  </pre>
                </div>

                <div className="rounded-xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <h2 className="font-serif font-semibold text-base mb-2">Static Data Model</h2>
                  <p className="text-xs mb-4" style={{ color: 'var(--text2)' }}>Clinic setups, doctors, and procedures.</p>
                  <pre
                    className="p-4 rounded-lg overflow-auto"
                    style={{ background: 'var(--card2)', color: 'var(--text)', fontSize: 11, fontFamily: 'var(--font-mono)', border: '1px solid var(--border)' }}
                  >
                    {JSON.stringify({ clinics, doctors, procedures: procs }, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
