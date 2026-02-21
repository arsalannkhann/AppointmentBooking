"""
schemas.py — Pydantic v2 request/response schemas
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ── Appointment ───────────────────────────────────────────────

class AppointmentCreate(BaseModel):
    procedure_id      : str
    patient_name      : str
    patient_phone     : Optional[str] = None
    patient_email     : Optional[str] = None
    clinic_id         : str
    date              : str                   # YYYY-MM-DD
    start_time        : str                   # HH:MM
    primary_doctor_id : str
    doctor_ids        : List[str]
    notes             : Optional[str] = None
    status            : str = "confirmed"


class AppointmentStatusUpdate(BaseModel):
    status: str  # confirmed | completed | cancelled


class AppointmentOut(BaseModel):
    id                : str
    procedure_id      : str
    patient_name      : str
    patient_phone     : Optional[str]
    patient_email     : Optional[str]
    clinic_id         : str
    room_id           : str
    date              : str
    start_time        : str
    duration_mins     : int
    doctor_ids        : List[str]
    primary_doctor_id : str
    notes             : Optional[str]
    status            : str
    created_at        : Optional[datetime]

    model_config = {"from_attributes": True}


class AppointmentStats(BaseModel):
    total     : int
    today     : int
    this_week : int
    completed : int
    cancelled : int


# ── Slot ─────────────────────────────────────────────────────

class SlotOut(BaseModel):
    procedure_id      : str
    clinic_id         : str
    room_id           : str
    date              : str
    start_time        : str
    duration_mins     : int
    doctor_ids        : List[str]
    primary_doctor_id : str


# ── Chat ─────────────────────────────────────────────────────

class ChatMessageIn(BaseModel):
    role    : str
    content : str


class ChatRequest(BaseModel):
    session_id : str
    messages   : List[ChatMessageIn]


class BookingAppointmentRequest(BaseModel):
    procedure_id      : str
    clinic_id         : str
    date              : str
    start_time        : str
    primary_doctor_id : str
    doctor_ids        : List[str]
    notes             : Optional[str] = None


class BookingRequest(BaseModel):
    patient_name  : str
    patient_phone : Optional[str] = None
    appointments  : List[BookingAppointmentRequest]


class ConfirmBookingRequest(BaseModel):
    booking_request : BookingRequest
    session_id      : str


class ChatResponse(BaseModel):
    content         : str
    session_id      : str
    booking_request : Optional[BookingRequest] = None


# ── Static data pass-through (returned as-is from data_model) ─

class RoomOut(BaseModel):
    id           : str
    name         : str
    label        : str
    capabilities : List[str]


class ClinicOut(BaseModel):
    id         : str
    name       : str
    short_name : str
    address    : str
    phone      : str
    rooms      : List[RoomOut]


class AvailabilityOut(BaseModel):
    clinic_id  : str
    days       : List[int]
    start_hour : int
    end_hour   : int


class DoctorOut(BaseModel):
    id              : str
    name            : str
    title           : str
    specializations : List[str]
    bio             : str
    availability    : List[AvailabilityOut]


class FollowUpOut(BaseModel):
    procedure_id : str
    label        : str


class ProcedureOut(BaseModel):
    id                     : str
    name                   : str
    duration               : int
    required_specs         : List[str]
    required_capabilities  : List[str]
    color                  : str
    description            : str
    note                   : Optional[str] = None
    priority               : Optional[str] = None
    follow_up              : Optional[FollowUpOut] = None
    requires_anesthetist   : bool = False


class SpecializationOut(BaseModel):
    id    : str
    name  : str
    color : str
