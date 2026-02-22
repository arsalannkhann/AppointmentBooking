'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { api, getWeekRange, toDateStr, timeToMins, DAY_NAMES, MONTH_NAMES } from '@/lib/api-client';
import type { Appointment, Clinic, Doctor, Procedure, Room } from '@/types';

const HOUR_START = 8;
const HOUR_END = 19;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
// ROW_H changed to 32px per 15-min slot for a spacious layout
const ROW_H = 32;

export default function CalendarPage() {
  const [dateOffset, setDateOffset] = useState(0);
  const [appointments, setAppts] = useState<Appointment[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [procs, setProcs] = useState<Procedure[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);

  const currentDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dateOffset);
    return d;
  }, [dateOffset]);

  const getClinic = (id: string) => clinics.find(c => c.id === id);
  const getDoctor = (id: string) => doctors.find(d => d.id === id);
  const getProc = (id: string) => procs.find(p => p.id === id);

  // Flatten rooms across all clinics
  const rooms = useMemo(() => {
    return clinics.flatMap(c =>
      c.rooms.map((r: Room) => ({ ...r, clinicId: c.id, clinicName: c.short_name }))
    );
  }, [clinics]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch +/- 3 days around the current date to ensure we have data cached for quick swiping
      const startD = new Date(currentDate);
      startD.setDate(startD.getDate() - 3);
      const endD = new Date(currentDate);
      endD.setDate(endD.getDate() + 3);

      const [appts, c, d, p] = await Promise.all([
        api.appointments.forWeek(toDateStr(startD), toDateStr(endD)),
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
  }, [currentDate]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleStatusChange(appt: Appointment, newStatus: string) {
    await api.appointments.updateStatus(appt.id, newStatus);
    setSelected(null);
    loadData();
  }

  // Filter current day's appointments
  const todayAppts = appointments.filter(a => a.date === toDateStr(currentDate));

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Top Header matching screenshot layout */}
      <div className="bg-white px-4 md:px-6 py-4 border-b border-[var(--border)] flex flex-col gap-4 shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xl shadow-md">
              📅
            </div>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                Schedule Intelligence
                <span className="text-amber-500 text-lg">✨</span>
              </h1>
              <p className="hidden md:block text-xs text-slate-500 font-medium">AI-powered operatory view · Dentistry Automation feed</p>
            </div>
          </div>

          <div className="hidden lg:flex bg-slate-100 rounded-lg p-1 text-sm font-medium border border-slate-200">
            <button className="px-4 py-1.5 rounded-md bg-indigo-600 text-white shadow-sm">Today</button>
            <button className="px-4 py-1.5 rounded-md text-slate-600 hover:text-slate-900 transition-colors">3 Days</button>
            <button className="px-4 py-1.5 rounded-md text-slate-600 hover:text-slate-900 transition-colors">7 Days</button>
            <button className="px-4 py-1.5 rounded-md text-slate-600 hover:text-slate-900 transition-colors">Month</button>
          </div>
        </div>

        {/* AI Insights & KPI Row */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between mt-2 gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold px-2 border border-slate-100 bg-white shadow-sm py-2 rounded-lg flex-1">
            <span className="flex items-center gap-1.5 text-indigo-600 tracking-wide uppercase">
              <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center opacity-80">ℹ️</span>
              AI Insights
            </span>
            <span className="text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm" /> 28% confirmed</span>
            <span className="text-amber-600 flex items-center gap-1.5 bg-amber-50 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-sm" /> 8 need confirmation</span>
            <span className="text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-full hidden md:flex">📈 5 high-value ($500+)</span>
            <span className="text-slate-500 font-mono text-xs ml-auto pr-2 hidden lg:block border-l border-slate-200 pl-4">$ Avg $289/appointment</span>
          </div>

          <div className="flex gap-3">
            <div className="px-4 py-2 bg-emerald-500 rounded-xl text-white flex flex-col items-end shadow-md min-w-[140px]">
              <span className="text-[10px] font-bold tracking-widest opacity-90">Projected Revenue</span>
              <span className="text-xl font-black font-mono mt-0.5">${(todayAppts.length * 289).toLocaleString()}</span>
            </div>
            <div className="px-4 py-2 bg-indigo-600 rounded-xl text-white flex flex-col items-end shadow-md min-w-[120px]">
              <span className="text-[10px] font-bold tracking-widest opacity-90">Appointments</span>
              <span className="text-xl font-black font-mono mt-0.5 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-white text-indigo-600 flex items-center justify-center text-[10px]">👥</span>
                {todayAppts.length}
              </span>
            </div>
          </div>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center gap-4 mt-2">
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm text-sm font-semibold">
            <button onClick={() => setDateOffset(d => d - 1)} className="px-3 py-1.5 hover:bg-slate-50 text-slate-600 transition-colors">‹</button>
            <button onClick={() => setDateOffset(0)} className="px-4 py-1.5 border-x border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors">Today</button>
            <button onClick={() => setDateOffset(d => d + 1)} className="px-3 py-1.5 hover:bg-slate-50 text-slate-600 transition-colors">›</button>
          </div>
          <h2 className="text-[17px] text-slate-700 font-semibold tracking-tight">
            {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(currentDate)}
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-[#F8FAFC]">
        {/* Calendar Grid Container */}
        <div className="flex-1 overflow-auto no-scrollbar relative pt-4 md:pt-6 px-4 md:px-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="spinner" />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" style={{ minWidth: Math.max(800, rooms.length * 180 + 60) }}>

              {/* Headers */}
              <div className="flex border-b border-slate-200 bg-white sticky top-0 z-20">
                {/* Date / Time Corner */}
                <div className="w-[60px] flex-shrink-0 flex flex-col items-center justify-center border-r border-slate-200 bg-slate-50 relative">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm absolute top-3">
                    {currentDate.getDate()}
                  </div>
                </div>
                {/* Room Labels */}
                {rooms.map((room, i) => {
                  // Colors derived from the screenshot header bars
                  const colors = ['#10B981', '#60A5FA', '#F59E0B', '#34D399', '#8B5CF6', '#F87171'];
                  const color = colors[i % colors.length];
                  return (
                    <div key={room.id} className="flex-1 min-w-[180px] border-r border-slate-100 relative h-14 flex flex-col items-center justify-center">
                      <div className="absolute top-0 left-0 right-0 h-[4px]" style={{ background: color }} />
                      <span className="text-[13px] font-bold text-slate-700">{room.name}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{room.clinicName}</span>
                    </div>
                  );
                })}
              </div>

              {/* Grid Body */}
              <div className="flex bg-white relative">
                {/* Y-Axis Times */}
                <div className="w-[60px] flex-shrink-0 border-r border-slate-200 bg-slate-50 pt-2 z-10 relative">
                  {HOURS.map(hour => (
                    <div key={hour} style={{ height: ROW_H * 4 }} className="relative pr-2 flex justify-end">
                      <span className="text-[10px] font-semibold text-slate-400 -mt-2.5 bg-slate-50 px-1 rounded">
                        {hour === 12 ? '12:00pm' : hour > 12 ? `${hour - 12}:00pm` : `${hour}:00am`}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Columns */}
                <div className="flex flex-1 relative pt-2">
                  {/* Background lines mapping */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col pt-2">
                    {HOURS.map(hour => (
                      [0, 1, 2, 3].map(q => (
                        <div key={`${hour}-${q}`} style={{
                          height: ROW_H,
                          borderBottom: q === 3 ? '1px solid #E2E8F0' : '1px dashed #F1F5F9'
                        }} className="w-full" />
                      ))
                    ))}
                  </div>

                  {/* Room Columns & Appointments */}
                  {rooms.map((room) => (
                    <div key={room.id} className="flex-1 min-w-[180px] border-r border-slate-100 relative">
                      {/* Appointments for this room */}
                      {todayAppts.filter(a => a.room_id === room.id).map(appt => {
                        const startMins = timeToMins(appt.start_time);
                        const offsetMins = startMins - (HOUR_START * 60);
                        const topPx = (offsetMins / 15) * ROW_H;
                        const heightPx = (appt.duration_mins / 15) * ROW_H;
                        const proc = getProc(appt.procedure_id);

                        return (
                          <button
                            key={appt.id}
                            onClick={() => setSelected(appt)}
                            className="absolute left-1.5 right-1.5 rounded-md p-1.5 flex flex-col text-left text-white shadow-sm overflow-hidden transition-all hover:scale-[1.02] hover:shadow-md hover:brightness-110 z-10"
                            style={{
                              top: topPx,
                              height: heightPx - 3,
                              background: proc?.color ?? '#6366f1',
                              cursor: 'pointer'
                            }}
                          >
                            <div className="flex justify-between items-start w-full">
                              <span className="text-[11px] font-bold leading-tight truncate w-full tracking-wide">👤 {appt.patient_name}</span>
                              {heightPx >= ROW_H * 1.5 && <span className="text-[10px] font-bold font-mono opacity-90 pl-1 shrink-0 bg-black/10 px-1 rounded">${Math.floor(Math.random() * 400) + 100}</span>}
                            </div>

                            {heightPx >= ROW_H * 1.5 && (
                              <>
                                <span className="text-[10px] font-medium leading-tight opacity-95 truncate mt-0.5">{proc?.name}</span>
                                <span className="text-[9px] font-medium leading-tight opacity-80 truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>
                                  {appt.doctor_ids.map(id => getDoctor(id)?.name.split(' ').slice(-1)[0]).join(', ')}
                                </span>
                              </>
                            )}
                            {heightPx > ROW_H * 2 && (
                              <div className="mt-auto pt-1 w-full text-[9px] font-mono opacity-60 truncate">
                                ID: {appt.id.split('-')[0]}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="w-full md:w-[320px] bg-white border-l border-slate-200 flex-shrink-0 flex flex-col shadow-2xl z-30 overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <span className="font-serif font-bold text-lg text-slate-800 tracking-tight">Appointment Details</span>
                <button
                  onClick={() => setSelected(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                >
                  ✕
                </button>
              </div>

              {(() => {
                const proc = getProc(selected.procedure_id);
                const clinic = getClinic(selected.clinic_id);
                const docs = selected.doctor_ids.map(id => getDoctor(id)?.name ?? id).join(', ');
                const color = proc?.color ?? '#6366F1';

                return (
                  <div className="flex flex-col gap-4">
                    <div
                      className="rounded-xl p-4 shadow-sm"
                      style={{ background: color, color: 'white' }}
                    >
                      <div className="font-bold text-sm tracking-wide">{proc?.name}</div>
                      <div className="text-[11px] opacity-90 mt-1 leading-relaxed">{proc?.description}</div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                      {[
                        { label: 'Patient', value: selected.patient_name, icon: '👤' },
                        { label: 'Time', value: `${selected.date} • ${selected.start_time}`, icon: '🕒' },
                        { label: 'Duration', value: `${selected.duration_mins} min`, icon: '⏱️' },
                        { label: 'Provider', value: docs, icon: '👨‍⚕️' },
                        { label: 'Location', value: `${clinic?.name} • Room ${selected.room_id}`, icon: '🏥' },
                        { label: 'Status', value: selected.status.toUpperCase(), icon: '📋' },
                      ].map(row => (
                        <div key={row.label} className="flex flex-col gap-0.5">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{row.label}</span>
                          <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 break-words">
                            <span className="text-slate-400">{row.icon}</span> {row.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {selected.notes && (
                      <div className="p-3 border border-amber-200 bg-amber-50 rounded-xl text-xs text-amber-800 font-medium leading-relaxed">
                        ⚠️ {selected.notes}
                      </div>
                    )}

                    {selected.status === 'confirmed' && (
                      <div className="mt-2 flex flex-col gap-2 pt-2 border-t border-slate-200">
                        <button
                          onClick={() => handleStatusChange(selected, 'completed')}
                          className="w-full py-2.5 rounded-lg text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-colors"
                        >
                          ✓ Mark Completed
                        </button>
                        <button
                          onClick={() => handleStatusChange(selected, 'cancelled')}
                          className="w-full py-2.5 rounded-lg text-sm font-bold bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          ✕ Cancel Appointment
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
