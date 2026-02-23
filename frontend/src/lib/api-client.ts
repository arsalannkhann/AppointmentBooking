// ─────────────────────────────────────────────────────────
// api-client.ts — Typed API client for MedDent backend
// ─────────────────────────────────────────────────────────

import type {
  Appointment, AvailableSlot, AppointmentStats,
  Clinic, Doctor, Procedure, Specialization,
  ChatRequest, ChatResponse, BookingRequest,
} from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Static data ────────────────────────────────────────────

export const api = {
  data: {
    clinics: () => apiFetch<Clinic[]>('/api/data/clinics'),
    doctors: () => apiFetch<Doctor[]>('/api/data/doctors'),
    procedures: () => apiFetch<Procedure[]>('/api/data/procedures'),
    specializations: () => apiFetch<Specialization[]>('/api/data/specializations'),
  },

  // ── Appointments ─────────────────────────────────────────

  appointments: {
    list: (status = 'confirmed') =>
      apiFetch<Appointment[]>(`/api/appointments?status=${status}`),

    forWeek: (weekStart: string, weekEnd: string) =>
      apiFetch<Appointment[]>(
        `/api/appointments/week?week_start=${weekStart}&week_end=${weekEnd}`
      ),

    forDate: (date: string) =>
      apiFetch<Appointment[]>(`/api/appointments/date/${date}`),

    stats: () => apiFetch<AppointmentStats>('/api/appointments/stats'),

    create: (appt: Partial<Appointment>) =>
      apiFetch<Appointment>('/api/appointments', {
        method: 'POST',
        body: JSON.stringify(appt),
      }),

    updateStatus: (id: string, status: string) =>
      apiFetch<Appointment>(`/api/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    cancel: (id: string) =>
      apiFetch<{ ok: boolean }>(`/api/appointments/${id}`, { method: 'DELETE' }),

    bulkImport: (appts: any[]) =>
      apiFetch<{ ok: boolean; imported: number }>('/api/appointments/bulk', {
        method: 'POST',
        body: JSON.stringify(appts),
      }),
  },

  // ── Slot finder ───────────────────────────────────────────

  slots: {
    find: (procedureId: string, clinicId?: string, daysAhead = 14) => {
      const params = new URLSearchParams({
        procedure_id: procedureId,
        days_ahead: String(daysAhead),
        ...(clinicId ? { preferred_clinic_id: clinicId } : {}),
      });
      return apiFetch<AvailableSlot[]>(`/api/slots?${params}`);
    },
  },

  // ── Chat / AI ─────────────────────────────────────────────

  chat: {
    send: (req: ChatRequest) =>
      apiFetch<ChatResponse>('/api/chat', {
        method: 'POST',
        body: JSON.stringify(req),
      }),

    confirmBooking: (bookingRequest: BookingRequest, sessionId: string) =>
      apiFetch<Appointment[]>('/api/chat/confirm', {
        method: 'POST',
        body: JSON.stringify({ booking_request: bookingRequest, session_id: sessionId }),
      }),
  },
};

// ── Date utils ─────────────────────────────────────────────

export function getWeekRange(offsetWeeks = 0): { start: Date; end: Date; dates: Date[] } {
  const today = new Date();
  const monday = new Date(today);
  const dow = today.getDay();
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  return { start: monday, end: sunday, dates };
}

export function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function timeToMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
