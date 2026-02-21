// ─────────────────────────────────────────────────────────
// MedDent Booking System — Shared TypeScript Types
// ─────────────────────────────────────────────────────────

export interface Room {
  id: string;
  name: string;
  label: string;
  capabilities: string[];
}

export interface Clinic {
  id: string;
  name: string;
  short_name: string;
  address: string;
  phone: string;
  rooms: Room[];
}

export interface DoctorAvailability {
  clinic_id: string;
  days: number[];        // 1=Mon … 6=Sat
  start_hour: number;
  end_hour: number;
}

export interface Doctor {
  id: string;
  name: string;
  title: string;
  specializations: string[];
  bio: string;
  availability: DoctorAvailability[];
}

export interface Specialization {
  id: string;
  name: string;
  color: string;
}

export interface FollowUp {
  procedure_id: string;
  label: string;
}

export interface Procedure {
  id: string;
  name: string;
  duration: number;          // minutes
  required_specs: string[];
  required_capabilities: string[];
  color: string;
  description: string;
  note?: string;
  priority?: string;
  follow_up?: FollowUp;
  requires_anesthetist?: boolean;
}

// ── Database / API models ──────────────────────────────────

export type AppointmentStatus = 'confirmed' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  procedure_id: string;
  patient_name: string;
  patient_phone?: string;
  patient_email?: string;
  clinic_id: string;
  room_id: string;
  date: string;           // YYYY-MM-DD
  start_time: string;     // HH:MM
  duration_mins: number;
  doctor_ids: string[];
  primary_doctor_id: string;
  notes?: string;
  status: AppointmentStatus;
  created_at?: string;
}

export interface AvailableSlot {
  procedure_id: string;
  clinic_id: string;
  room_id: string;
  date: string;
  start_time: string;
  duration_mins: number;
  doctor_ids: string[];
  primary_doctor_id: string;
}

// ── Chat types ─────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  booking_request?: BookingRequest;
  confirmed?: boolean;
  rejected?: boolean;
  timestamp?: string;
}

export interface BookingAppointmentRequest {
  procedure_id: string;
  clinic_id: string;
  date: string;
  start_time: string;
  primary_doctor_id: string;
  doctor_ids: string[];
  notes?: string;
}

export interface BookingRequest {
  patient_name: string;
  patient_phone?: string;
  appointments: BookingAppointmentRequest[];
}

// ── API response wrappers ──────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface AppointmentStats {
  total: number;
  today: number;
  this_week: number;
  completed: number;
  cancelled: number;
}

export interface ChatRequest {
  session_id: string;
  messages: Array<{ role: string; content: string }>;
}

export interface ChatResponse {
  content: string;
  session_id: string;
  booking_request?: BookingRequest;
}
