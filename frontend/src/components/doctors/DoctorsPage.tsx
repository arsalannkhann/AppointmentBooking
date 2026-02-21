'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { Doctor, Clinic, Procedure, Specialization, AvailableSlot } from '@/types';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Tab = 'doctors' | 'clinics' | 'procedures' | 'slots';

export default function DoctorsPage() {
  const [tab, setTab] = useState<Tab>('doctors');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [procs, setProcs] = useState<Procedure[]>([]);
  const [specs, setSpecs] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);

  // Slot finder state
  const [selProc, setSelProc] = useState('');
  const [selClinic, setSelClinic] = useState('');
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.data.doctors(),
      api.data.clinics(),
      api.data.procedures(),
      api.data.specializations(),
    ]).then(([d, c, p, s]) => {
      setDoctors(d); setClinics(c); setProcs(p); setSpecs(s);
    }).finally(() => setLoading(false));
  }, []);

  const getSpec = (id: string) => specs.find(s => s.id === id);
  const getClinic = (id: string) => clinics.find(c => c.id === id);

  async function findSlots() {
    if (!selProc) return;
    setSlotLoading(true);
    try {
      const results = await api.slots.find(selProc, selClinic || undefined);
      setSlots(results);
    } finally {
      setSlotLoading(false);
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'doctors', label: 'Doctors' },
    { id: 'clinics', label: 'Clinics & Rooms' },
    { id: 'procedures', label: 'Procedures' },
    { id: 'slots', label: '🔍 Live Slots' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
        <div className="px-4 md:px-6 py-4">
          <h1 className="font-serif text-lg font-semibold">👨‍⚕️ Doctors & Clinics</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>Staff directory, facility capabilities, and real-time availability</p>
        </div>
        <div className="flex px-4 md:px-6 overflow-x-auto no-scrollbar" style={{ gap: 0 }}>
          {TABS.map(t => (
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
            {/* ── DOCTORS ── */}
            {tab === 'doctors' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
                {doctors.map(doc => {
                  const docSpecs = doc.specializations.map(id => getSpec(id)).filter(Boolean) as Specialization[];
                  return (
                    <div key={doc.id} className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm"
                          style={{
                            width: 46, height: 46,
                            background: (docSpecs[0]?.color ?? '#aaa') + '20',
                            border: `1.5px solid ${(docSpecs[0]?.color ?? '#aaa')}50`,
                            color: docSpecs[0]?.color ?? '#aaa',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {doc.name.split(' ').map(n => n[0]).slice(1, 3).join('')}
                        </div>
                        <div>
                          <div className="font-semibold" style={{ fontSize: 14 }}>{doc.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{doc.title}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {docSpecs.map(s => (
                          <span
                            key={s.id}
                            className="proc-badge"
                            style={{ background: s.color + '20', color: s.color, border: `1px solid ${s.color}40` }}
                          >
                            {s.name}
                          </span>
                        ))}
                      </div>

                      <p className="mb-3" style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{doc.bio}</p>

                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                        {doc.availability.map((a, i) => {
                          const clinic = getClinic(a.clinic_id);
                          const days = a.days.map(d => DAY_NAMES[d]).join(', ');
                          return (
                            <div key={i} className="flex justify-between py-1.5" style={{ fontSize: 11 }}>
                              <span style={{ color: 'var(--text3)' }}>{clinic?.short_name}</span>
                              <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                                {days} · {a.start_hour}–{a.end_hour}h
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── CLINICS ── */}
            {tab === 'clinics' && (
              <div className="flex flex-col gap-4">
                {clinics.map(clinic => (
                  <div key={clinic.id} className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="font-serif font-semibold text-base">{clinic.name}</h2>
                        <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>📍 {clinic.address} · 📞 {clinic.phone}</p>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
                      {clinic.rooms.map(room => (
                        <div key={room.id} className="rounded-lg p-3" style={{ background: 'var(--card2)', border: '1px solid var(--border)' }}>
                          <div className="font-semibold text-sm mb-1">{room.name} — {room.label}</div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {room.capabilities.map(cap => (
                              <span
                                key={cap}
                                className="px-2 py-0.5 rounded text-xs"
                                style={{ background: 'var(--primary-dim)', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}
                              >
                                {cap}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── PROCEDURES ── */}
            {tab === 'procedures' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 10 }}>
                {procs.map(proc => (
                  <div
                    key={proc.id}
                    className="rounded-xl p-4"
                    style={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderLeft: `4px solid ${proc.color}`,
                    }}
                  >
                    <div className="font-semibold text-sm mb-1" style={{ color: proc.color }}>{proc.name}</div>
                    <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 8 }}>{proc.description}</p>
                    <div className="flex flex-wrap gap-2" style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                      <span>⏱ {proc.duration} min</span>
                      <span>👨‍⚕️ {proc.required_specs.join(' + ')}</span>
                    </div>
                    {proc.note && (
                      <div className="mt-2 text-xs" style={{ color: 'var(--amber)' }}>⚠ {proc.note}</div>
                    )}
                    {proc.follow_up && (
                      <div className="mt-1 text-xs" style={{ color: 'var(--primary)' }}>→ {proc.follow_up.label}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── LIVE SLOTS ── */}
            {tab === 'slots' && (
              <div>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <label className="block text-xs mb-1" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Procedure *
                    </label>
                    <select
                      value={selProc}
                      onChange={e => setSelProc(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ background: 'var(--card)', border: '1px solid var(--border2)', color: 'var(--text)' }}
                    >
                      <option value="">Select procedure…</option>
                      {procs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.duration} min)</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs mb-1" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Preferred Clinic
                    </label>
                    <select
                      value={selClinic}
                      onChange={e => setSelClinic(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ background: 'var(--card)', border: '1px solid var(--border2)', color: 'var(--text)' }}
                    >
                      <option value="">Any clinic</option>
                      {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={findSlots}
                      disabled={!selProc || slotLoading}
                      className="px-5 py-2 rounded-lg text-sm font-bold"
                      style={{
                        background: !selProc || slotLoading ? 'var(--border2)' : 'var(--primary)',
                        color: 'white', border: 'none',
                        cursor: !selProc || slotLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {slotLoading ? '⏳' : '🔍 Find Slots'}
                    </button>
                  </div>
                </div>

                {slots.length > 0 && (
                  <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--border)' }}>
                    <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                          {['Date', 'Start Time', 'Duration', 'Doctor(s)', 'Clinic', 'Room'].map(h => (
                            <th key={h} className="px-4 py-2 text-left" style={{ color: 'var(--text2)', fontWeight: 600, fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {slots.map((s, i) => {
                          const c = getClinic(s.clinic_id);
                          const docs = s.doctor_ids.map(id => doctors.find(d => d.id === id)?.name ?? id).join(' + ');
                          return (
                            <tr
                              key={i}
                              style={{ borderTop: '1px solid var(--border)', background: i % 2 ? 'var(--card)' : 'var(--bg)' }}
                            >
                              <td className="px-4 py-2.5">{s.date}</td>
                              <td className="px-4 py-2.5" style={{ fontFamily: 'var(--font-mono)' }}>{s.start_time}</td>
                              <td className="px-4 py-2.5">{s.duration_mins} min</td>
                              <td className="px-4 py-2.5">{docs}</td>
                              <td className="px-4 py-2.5">{c?.short_name}</td>
                              <td className="px-4 py-2.5" style={{ fontFamily: 'var(--font-mono)' }}>{s.room_id}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {slots.length === 0 && selProc && !slotLoading && (
                  <div className="text-center py-12" style={{ color: 'var(--text3)' }}>
                    No available slots found in the next 14 days.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
