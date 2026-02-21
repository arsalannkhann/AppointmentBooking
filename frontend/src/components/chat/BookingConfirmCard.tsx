'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import type { BookingRequest, Clinic, Doctor, Procedure } from '@/types';

interface Props {
  booking: BookingRequest;
  onConfirm: (booking: BookingRequest) => Promise<void>;
  onReject: () => void;
}

export default function BookingConfirmCard({ booking, onConfirm, onReject }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);

  useEffect(() => {
    Promise.all([api.data.clinics(), api.data.doctors(), api.data.procedures()])
      .then(([c, d, p]) => { setClinics(c); setDoctors(d); setProcedures(p); })
      .catch(() => null);
  }, []);

  const getClinic = (id: string) => clinics.find(c => c.id === id);
  const getDoctor = (id: string) => doctors.find(d => d.id === id);
  const getProcedure = (id: string) => procedures.find(p => p.id === id);

  async function handleConfirm() {
    setConfirming(true);
    await onConfirm(booking);
    setConfirming(false);
  }

  return (
    <div
      className="mt-3 rounded-xl p-4 transition-all"
      style={{ background: 'var(--card)', border: '1.5px solid var(--primary)', boxShadow: '0 4px 12px -2px rgba(13, 148, 136, 0.15)' }}
    >
      <div
        className="font-serif text-sm font-semibold mb-3 flex items-center gap-2"
        style={{ color: 'var(--primary)' }}
      >
        📋 Appointment Plan — Please Confirm
      </div>

      <div className="flex flex-col gap-2 mb-3">
        {booking.appointments.map((appt, i) => {
          const proc = getProcedure(appt.procedure_id);
          const clinic = getClinic(appt.clinic_id);
          const docNames = (appt.doctor_ids ?? [appt.primary_doctor_id])
            .map(id => getDoctor(id)?.name ?? id)
            .join(' + ');
          const color = proc?.color ?? '#aaa';

          return (
            <div
              key={i}
              className="rounded-lg p-3"
              style={{
                background: 'var(--card2)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${color}`,
              }}
            >
              <div className="font-semibold text-sm mb-1" style={{ color }}>
                {proc?.name ?? appt.procedure_id}
              </div>
              <div
                className="flex flex-wrap gap-x-4 gap-y-1"
                style={{ fontSize: 12, color: 'var(--text2)' }}
              >
                <span>📅 {appt.date}</span>
                <span>⏰ {appt.start_time}</span>
                <span>⏱ {proc?.duration ?? '?'} min</span>
                <span>👨‍⚕️ {docNames}</span>
                <span>🏥 {clinic?.short_name ?? appt.clinic_id}</span>
              </div>
              {appt.notes && (
                <div className="mt-1" style={{ fontSize: 11, color: 'var(--text3)' }}>
                  💬 {appt.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {booking.patient_name && (
        <div
          className="mb-3 text-xs px-3 py-1 rounded-lg"
          style={{ background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid rgba(13,148,136,0.2)' }}
        >
          Patient: <strong>{booking.patient_name}</strong>
          {booking.patient_phone && ` · ${booking.patient_phone}`}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
          style={{
            background: confirming ? 'var(--border2)' : 'var(--primary)',
            color: 'white',
            border: 'none',
            cursor: confirming ? 'not-allowed' : 'pointer',
          }}
        >
          {confirming ? '⏳ Booking…' : '✓ Confirm Booking'}
        </button>
        <button
          onClick={onReject}
          className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
          style={{
            background: 'transparent',
            color: 'var(--text2)',
            border: '1px solid var(--border2)',
            cursor: 'pointer',
          }}
          onMouseOver={e => {
            (e.target as HTMLElement).style.borderColor = 'var(--red)';
            (e.target as HTMLElement).style.color = 'var(--red)';
          }}
          onMouseOut={e => {
            (e.target as HTMLElement).style.borderColor = 'var(--border2)';
            (e.target as HTMLElement).style.color = 'var(--text2)';
          }}
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}
