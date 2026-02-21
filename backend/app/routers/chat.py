"""routers/chat.py — AI chat with Claude, session persistence in Cloud SQL"""

import json
import os
import re
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

import google.generativeai as genai

from app.database import get_db
from app.models import Appointment, ChatSession, ChatMessage
from app.schemas import (
    ChatRequest, ChatResponse, ConfirmBookingRequest,
    BookingRequest, AppointmentOut,
)
from app.data_model import (
    CLINICS, DOCTORS, PROCEDURES, DAY_NAMES,
    get_clinic, get_doctor, get_procedure, find_room_for_procedure,
)
from app.routers.slots import _doctor_slots, _has_conflict, mins_to_time, time_to_mins

router = APIRouter()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")


# ── System prompt ─────────────────────────────────────────────

def build_system_prompt(booked_summary: list) -> str:
    clinics_data = [
        {"id": c["id"], "name": c["name"],
         "rooms": [{"id": r["id"], "label": r["label"], "capabilities": r["capabilities"]}
                   for r in c["rooms"]]}
        for c in CLINICS
    ]
    doctors_data = [
        {"id": d["id"], "name": d["name"], "specializations": d["specializations"],
         "availability": [
             {"clinic": a["clinic_id"],
              "days": [DAY_NAMES[n] for n in a["days"]],
              "hours": f"{a['start_hour']}:00–{a['end_hour']}:00"}
             for a in d["availability"]
         ]}
        for d in DOCTORS
    ]
    procs_data = [
        {"id": p["id"], "name": p["name"], "duration_min": p["duration"],
         "specialists": p["required_specs"],
         "room_needs": p["required_capabilities"],
         "note": p.get("note", p.get("description", "")),
         "follow_up": p.get("follow_up", {}).get("label") if p.get("follow_up") else None}
        for p in PROCEDURES
    ]

    return f"""You are ARIA, a warm and efficient dental booking assistant for MedDent Clinics.
Today is {date.today().strftime('%A, %B %d, %Y')}.

MISSION: Understand the patient's dental issue, map it to the correct procedure, find the best available slot, and confirm a booking.

=== CLINICS & ROOMS ===
{json.dumps(clinics_data, indent=2)}

=== DOCTORS ===
{json.dumps(doctors_data, indent=2)}

=== PROCEDURES ===
{json.dumps(procs_data, indent=2)}

=== RECENT BOOKINGS CONTEXT ===
{json.dumps(booked_summary, indent=2)}

=== CRITICAL RULES ===
- SLOT OPTIMIZATION: When a patient requires multiple appointments (e.g., multiple consultations, or consult + treatment), you MUST schedule them for the EXACT SAME DAY consecutively or as close together as possible. Do not split them across multiple days unless explicitly requested.
- ROOT CANAL: rct_consult (20 min) then rct_treatment (75 min). Dr. Morgan + Room 2 (Downtown or Westside) ONLY.
- IV SEDATION EXTRACTION: wisdom_extraction_iv — Downtown ONLY (iv_sedation in Room 4). Dr. Okafor + Dr. Silva together.
- EMERGENCY TRIAGE: Room 1 general suite only, Dr. Chen or Dr. Patel.
- Always recommend consultation before surgical procedures.
- Dr. Morgan: Downtown Mon/Wed/Fri, Westside Tue/Thu.
- Dr. Okafor: Downtown Tue/Thu, Westside Mon/Wed/Fri.
- Dr. Silva (anesthetist): Downtown only, Tue/Thu.
- Minimise patient visits — combine consult+treatment where possible.
- If clinic lacks capability, explain and redirect to capable clinic.

=== STYLE ===
Be warm, professional, concise. Ask 1–2 questions per turn.
Collect: patient name, symptoms, location preference, time preference.

=== BOOKING OUTPUT ===
When patient confirms, output EXACTLY (include nothing after it):

[BOOKING_REQUEST]
{{
  "patient_name": "Full Name",
  "patient_phone": "+1-...",
  "appointments": [
    {{
      "procedure_id": "procedure_id",
      "clinic_id": "clinic_id",
      "date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "primary_doctor_id": "doctor_id",
      "doctor_ids": ["doctor_id"],
      "notes": "note"
    }}
  ]
}}
[/BOOKING_REQUEST]

Start by greeting the patient and asking what brings them in today."""


def parse_booking(text: str) -> Optional[dict]:
    match = re.search(r'\[BOOKING_REQUEST\](.*?)\[/BOOKING_REQUEST\]', text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1).strip())
    except Exception:
        return None


def strip_booking(text: str) -> str:
    return re.sub(r'\[BOOKING_REQUEST\].*?\[/BOOKING_REQUEST\]', '', text, flags=re.DOTALL).strip()


# ── Chat endpoint ─────────────────────────────────────────────

@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    if not GOOGLE_API_KEY:
        raise HTTPException(503, "GOOGLE_API_KEY not configured")

    # Ensure session exists in DB
    session = await db.get(ChatSession, body.session_id)
    if not session:
        session = ChatSession(id=body.session_id)
        db.add(session)
        await db.commit()

    # Fetch a brief snapshot of recent booked appointments for context
    from sqlalchemy import select as sa_select
    rows = await db.execute(
        sa_select(Appointment)
        .where(Appointment.status == "confirmed")
        .order_by(Appointment.date)
        .limit(20)
    )
    booked_summary = [
        {"date": a.date, "time": a.start_time, "procedure": a.procedure_id,
         "clinic": a.clinic_id, "doctor": a.primary_doctor_id}
        for a in rows.scalars().all()
    ]

    # Save user message
    last_msg = body.messages[-1] if body.messages else None
    if last_msg and last_msg.role == "user" and last_msg.content != "Hello":
        db.add(ChatMessage(session_id=body.session_id, role="user", content=last_msg.content))
        await db.commit()

    # Call Gemini
    genai.configure(api_key=GOOGLE_API_KEY)
    
    # Format messages for Gemini
    api_messages = []
    for m in body.messages:
        stripped_content = strip_booking(m.content)
        if stripped_content:
            api_messages.append({
                "role": "user" if m.role == "user" else "model",
                "parts": [stripped_content]
            })

    model = genai.GenerativeModel(
        model_name="gemini-3-flash-preview",
        system_instruction=build_system_prompt(booked_summary)
    )
    
    response = model.generate_content(
        api_messages
    )
    ai_text = response.text

    # Save assistant response
    db.add(ChatMessage(session_id=body.session_id, role="assistant", content=ai_text))
    await db.commit()

    booking = parse_booking(ai_text)
    booking_obj = BookingRequest(**booking) if booking else None

    return ChatResponse(
        content=ai_text,
        session_id=body.session_id,
        booking_request=booking_obj,
    )


# ── Confirm booking endpoint ──────────────────────────────────

@router.post("/confirm", response_model=list[AppointmentOut], status_code=201)
async def confirm_booking(body: ConfirmBookingRequest, db: AsyncSession = Depends(get_db)):
    created = []
    for appt_req in body.booking_request.appointments:
        proc = get_procedure(appt_req.procedure_id)
        if not proc:
            raise HTTPException(400, f"Unknown procedure: {appt_req.procedure_id}")
        room = find_room_for_procedure(appt_req.clinic_id, appt_req.procedure_id)
        if not room:
            raise HTTPException(400, f"Clinic {appt_req.clinic_id} cannot handle {appt_req.procedure_id}")

        appt = Appointment(
            procedure_id=appt_req.procedure_id,
            patient_name=body.booking_request.patient_name,
            patient_phone=body.booking_request.patient_phone,
            clinic_id=appt_req.clinic_id,
            room_id=room["id"],
            date=appt_req.date,
            start_time=appt_req.start_time,
            duration_mins=proc["duration"],
            doctor_ids=json.dumps(appt_req.doctor_ids),
            primary_doctor_id=appt_req.primary_doctor_id,
            notes=appt_req.notes,
            status="confirmed",
        )
        db.add(appt)
        created.append(appt)

    await db.commit()
    for a in created:
        await db.refresh(a)

    # Return as AppointmentOut
    from app.routers.appointments import model_to_out
    return [model_to_out(a) for a in created]
