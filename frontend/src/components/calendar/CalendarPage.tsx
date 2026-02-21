'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { api, getWeekRange, toDateStr, timeToMins, DAY_NAMES, MONTH_NAMES } from '@/lib/api-client';
import type { Appointment, Clinic, Doctor, Procedure } from '@/types';

const HOUR_START = 8;
const HOUR_END = 19;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const ROW_H = 28; // px per 15-min slot

export default function CalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [appointments, setAppts] = useState<Appointment[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [procs, setProcs] = useState<Procedure[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const nowLineRef = useRef<HTMLDivElement>(null);

  const { start, end, dates } = useMemo(() => getWeekRange(weekOffset), [weekOffset]);

  const getClinic = (id: string) => clinics.find(c => c.id === id);
  const getDoctor = (id: string) => doctors.find(d => d.id === id);
  const getProc = (id: string) => procs.find(p => p.id === id);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [appts, c, d, p] = await Promise.all([
        api.appointments.forWeek(toDateStr(start), toDateStr(end)),
        api.data.clinics(),
        api.data.doctors(),
        api.data.procedures(),
      ]);
      setAppts(appts);
      setClinics(c);
      setDoctors(d);
      setProcs(p);
    } finally {
      setLoading(false);
    }
  }, [start, end]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData(); }, [loadData]);

  // Live clock for current-time indicator
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const todayStr = toDateStr(now);
      const dayIdx = dates.findIndex(d => toDateStr(d) === todayStr);
      if (dayIdx === -1 || !nowLineRef.current) return;
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const topPx = ((nowMins - HOUR_START * 60) / 15) * ROW_H;
      nowLineRef.current.style.top = `${topPx}px`;
      nowLineRef.current.style.left = `calc(52px + ${dayIdx} * ((100% - 52px) / 7))`;
      nowLineRef.current.style.width = `calc((100% - 52px) / 7)`;
      nowLineRef.current.style.display = 'block';
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [dates]);

  const weekLabel = `${dates[0] ? `${MONTH_NAMES[dates[0].getMonth()]} ${dates[0].getDate()}` : ''} — ${dates[6] ? `${MONTH_NAMES[dates[6].getMonth()]} ${dates[6].getDate()}, ${dates[6].getFullYear()}` : ''}`;

  async function handleStatusChange(appt: Appointment, newStatus: string) {
    await api.appointments.updateStatus(appt.id, newStatus);
    setSelected(null);
    loadData();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between flex-shrink-0"
        style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <h1 className="font-serif text-lg font-semibold">📅 Appointment Calendar</h1>
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>{weekLabel}</p>
        </div>
        <div className="flex gap-2">
          {[
            { label: '‹', action: () => setWeekOffset(w => w - 1) },
            { label: 'Today', action: () => setWeekOffset(0) },
            { label: '›', action: () => setWeekOffset(w => w + 1) },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.action}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: 'var(--card2)', border: '1px solid var(--border)',
                color: 'var(--text2)', cursor: 'pointer',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Calendar grid */}
        <div className="flex-1 overflow-auto no-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="spinner" />
            </div>
          ) : (
            <div style={{ minWidth: 600, position: 'relative' }}>
              {/* Current time indicator */}
              <div
                ref={nowLineRef}
                className="current-time-line"
                style={{ display: 'none', position: 'absolute', zIndex: 10 }}
              >
                <div className="current-time-dot" />
              </div>

              {/* Day headers */}
              <div
                className="calendar-grid"
                style={{ position: 'sticky', top: 0, zIndex: 3, background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
              >
                <div style={{ height: 40, borderRight: '1px solid var(--border)' }} />
                {dates.map((d, i) => {
                  const isToday = toDateStr(d) === toDateStr(new Date());
                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center justify-center"
                      style={{
                        height: 40,
                        borderRight: i < 6 ? '1px solid var(--border)' : undefined,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        fontFamily: 'var(--font-mono)',
                        color: isToday ? 'var(--primary)' : 'var(--text2)',
                      }}
                    >
                      {DAY_NAMES[d.getDay()]}
                      <div
                        style={{
                          width: 22, height: 22,
                          borderRadius: '50%',
                          background: isToday ? 'var(--primary)' : 'transparent',
                          color: isToday ? 'white' : 'var(--text2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: isToday ? 700 : 500,
                          fontFamily: 'var(--font-sans)',
                          marginTop: 2,
                        }}
                      >
                        {d.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time rows */}
              {HOURS.map(hour => (
                [0, 1, 2, 3].map(q => {
                  const slotMins = hour * 60 + q * 15;
                  const isHourStart = q === 0;
                  return (
                    <div
                      key={`${hour}-${q}`}
                      className="calendar-grid"
                      style={{ height: ROW_H }}
                    >
                      {/* Time label */}
                      <div
                        style={{
                          height: ROW_H,
                          borderRight: '1px solid var(--border)',
                          borderTop: isHourStart ? '1px solid var(--border)' : undefined,
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                          paddingRight: 6,
                          fontSize: 9,
                          color: 'var(--text3)',
                          fontFamily: 'var(--font-mono)',
                          flexShrink: 0,
                        }}
                      >
                        {isHourStart ? `${String(hour).padStart(2, '0')}:00` : ''}
                      </div>

                      {/* Day columns */}
                      {dates.map((d, di) => {
                        const ds = toDateStr(d);
                        const cellAppts = appointments.filter(a => {
                          if (a.date !== ds) return false;
                          const aStart = timeToMins(a.start_time);
                          return aStart === slotMins;
                        });

                        return (
                          <div
                            key={di}
                            style={{
                              height: ROW_H,
                              borderRight: di < 6 ? '1px solid var(--border)11' : undefined,
                              borderTop: isHourStart ? '1px solid var(--border)' : undefined,
                              position: 'relative',
                            }}
                          >
                            {cellAppts.map((appt, ai) => {
                              const proc = getProc(appt.procedure_id);
                              const color = proc?.color ?? '#4ECDC4';
                              const heightPx = (appt.duration_mins / 15) * ROW_H;
                              const doc = getDoctor(appt.primary_doctor_id);
                              return (
                                <button
                                  key={ai}
                                  className="appt-block"
                                  onClick={() => setSelected(appt)}
                                  style={{
                                    height: heightPx - 4,
                                    top: 2,
                                    background: color + '22',
                                    borderLeft: `3px solid ${color}`,
                                    color,
                                  }}
                                  title={`${proc?.name} · ${doc?.name} · ${appt.patient_name}`}
                                >
                                  <div style={{ fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                    {proc?.name}
                                  </div>
                                  {heightPx >= 40 && (
                                    <div style={{ opacity: 0.75, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                      {doc?.name.split(' ').slice(-1)[0]}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div
            className="flex-shrink-0 overflow-y-auto w-full md:w-[280px] border-t md:border-t-0 md:border-l border-[var(--border)] max-h-[50vh] md:max-h-none"
            style={{
              background: 'var(--card)',
            }}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="font-serif font-semibold" style={{ fontSize: 15 }}>Appointment</span>
                <button
                  onClick={() => setSelected(null)}
                  style={{ color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
                >
                  ×
                </button>
              </div>

              {(() => {
                const proc = getProc(selected.procedure_id);
                const clinic = getClinic(selected.clinic_id);
                const docs = selected.doctor_ids.map(id => getDoctor(id)?.name ?? id).join(', ');
                const color = proc?.color ?? '#aaa';
                return (
                  <>
                    <div
                      className="rounded-lg p-3 mb-4"
                      style={{ background: color + '15', borderLeft: `3px solid ${color}` }}
                    >
                      <div className="font-semibold text-sm mb-1" style={{ color }}>{proc?.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{proc?.description}</div>
                    </div>

                    {[
                      { label: 'Patient', value: selected.patient_name },
                      { label: 'Date', value: selected.date },
                      { label: 'Time', value: selected.start_time },
                      { label: 'Duration', value: `${selected.duration_mins} min` },
                      { label: 'Doctor(s)', value: docs },
                      { label: 'Clinic', value: clinic?.name ?? selected.clinic_id },
                      { label: 'Room', value: selected.room_id },
                      { label: 'Status', value: selected.status },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                        <span style={{ color: 'var(--text2)' }}>{row.label}</span>
                        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{row.value}</span>
                      </div>
                    ))}

                    {selected.notes && (
                      <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--card2)', fontSize: 12, color: 'var(--text2)' }}>
                        💬 {selected.notes}
                      </div>
                    )}

                    {selected.status === 'confirmed' && (
                      <div className="mt-4 flex flex-col gap-2">
                        <button
                          onClick={() => handleStatusChange(selected, 'completed')}
                          className="w-full py-2 rounded-lg text-xs font-bold"
                          style={{ background: 'var(--green)', color: 'white', border: 'none', cursor: 'pointer' }}
                        >
                          ✓ Mark Completed
                        </button>
                        <button
                          onClick={() => handleStatusChange(selected, 'cancelled')}
                          className="w-full py-2 rounded-lg text-xs font-bold"
                          style={{ background: 'transparent', color: 'var(--red)', border: '1px solid var(--red)', cursor: 'pointer' }}
                        >
                          ✕ Cancel Appointment
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        className="flex flex-wrap gap-3 px-6 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--card)' }}
      >
        {procs.map(p => (
          <div key={p.id} className="flex items-center gap-1.5" style={{ fontSize: 11, color: 'var(--text2)' }}>
            <div style={{ width: 10, height: 10, background: p.color, borderRadius: 3 }} />
            {p.name}
          </div>
        ))}
      </div>
    </div>
  );
}
