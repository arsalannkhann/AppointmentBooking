"""seed.py — Seeds demo appointments on first boot if DB is empty."""

import json
import uuid
from datetime import date, timedelta

from sqlalchemy import select, func
from app.database import AsyncSessionLocal
from app.models import Appointment
from app.data_model import find_room_for_procedure, get_procedure


async def seed_if_empty():
    async with AsyncSessionLocal() as db:
        count = (await db.execute(select(func.count()).select_from(Appointment))).scalar()
        if count and count > 0:
            return

        today    = date.today()
        tomorrow = today + timedelta(days=1)
        day3     = today + timedelta(days=2)
        day5     = today + timedelta(days=4)

        seeds = [
            {"procedure_id": "general_checkup",  "patient_name": "Marcus Johnson",   "patient_phone": "+1-555-0101",
             "clinic_id": "downtown", "date": str(today),    "start_time": "09:00",
             "doctor_ids": ["dr_chen"],  "primary_doctor_id": "dr_chen",    "notes": "Routine annual check"},
            {"procedure_id": "rct_consult",       "patient_name": "Aisha Williams",   "patient_phone": "+1-555-0202",
             "clinic_id": "downtown", "date": str(today),    "start_time": "10:00",
             "doctor_ids": ["dr_morgan"], "primary_doctor_id": "dr_morgan", "notes": "Upper left molar pain"},
            {"procedure_id": "rct_treatment",     "patient_name": "Aisha Williams",   "patient_phone": "+1-555-0202",
             "clinic_id": "downtown", "date": str(day3),     "start_time": "10:30",
             "doctor_ids": ["dr_morgan"], "primary_doctor_id": "dr_morgan", "notes": "Follow-up RCT — 3-canal molar"},
            {"procedure_id": "wisdom_extraction", "patient_name": "Priya Kumar",      "patient_phone": "+1-555-0303",
             "clinic_id": "westside", "date": str(tomorrow), "start_time": "09:30",
             "doctor_ids": ["dr_okafor"], "primary_doctor_id": "dr_okafor", "notes": "Lower right impacted"},
            {"procedure_id": "emergency_triage",  "patient_name": "Luis Torres",      "patient_phone": "+1-555-0404",
             "clinic_id": "downtown", "date": str(today),    "start_time": "14:00",
             "doctor_ids": ["dr_chen"],  "primary_doctor_id": "dr_chen",    "notes": "Acute pain, broken crown"},
            {"procedure_id": "wisdom_extraction_iv", "patient_name": "Sam Rivera",   "patient_phone": "+1-555-0505",
             "clinic_id": "downtown", "date": str(day5),     "start_time": "08:30",
             "doctor_ids": ["dr_okafor", "dr_silva"], "primary_doctor_id": "dr_okafor",
             "notes": "IV sedation — severe dental anxiety"},
        ]

        for s in seeds:
            proc = get_procedure(s["procedure_id"])
            room = find_room_for_procedure(s["clinic_id"], s["procedure_id"])
            db.add(Appointment(
                id=f"seed-{uuid.uuid4().hex[:8]}",
                procedure_id=s["procedure_id"],
                patient_name=s["patient_name"],
                patient_phone=s.get("patient_phone"),
                clinic_id=s["clinic_id"],
                room_id=room["id"] if room else "R1",
                date=s["date"],
                start_time=s["start_time"],
                duration_mins=proc["duration"] if proc else 30,
                doctor_ids=json.dumps(s["doctor_ids"]),
                primary_doctor_id=s["primary_doctor_id"],
                notes=s.get("notes"),
                status="confirmed",
            ))
        await db.commit()
