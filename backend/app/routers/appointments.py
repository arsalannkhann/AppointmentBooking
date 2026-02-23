"""
routers/appointments.py — CRUD for appointments with Cloud SQL
"""

import json
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.database import get_db
from app.models import Appointment
from app.schemas import (
    AppointmentCreate, AppointmentOut, AppointmentStats,
    AppointmentStatusUpdate,
)
from app.data_model import get_procedure, find_room_for_procedure

router = APIRouter()


def model_to_out(appt: Appointment) -> AppointmentOut:
    d = {c.name: getattr(appt, c.name) for c in appt.__table__.columns}
    d["doctor_ids"] = json.loads(d.get("doctor_ids", "[]"))
    return AppointmentOut(**d)


@router.get("", response_model=List[AppointmentOut])
async def list_appointments(
    status: str = Query("confirmed"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment)
        .where(Appointment.status == status)
        .order_by(Appointment.date, Appointment.start_time)
    )
    return [model_to_out(a) for a in result.scalars().all()]


@router.get("/stats", response_model=AppointmentStats)
async def appointment_stats(db: AsyncSession = Depends(get_db)):
    today     = str(date.today())
    week_start = str(date.today() - timedelta(days=date.today().weekday()))
    week_end   = str(date.today() + timedelta(days=6 - date.today().weekday()))

    total     = (await db.execute(select(func.count()).select_from(Appointment).where(Appointment.status == "confirmed"))).scalar()
    today_n   = (await db.execute(select(func.count()).select_from(Appointment).where(and_(Appointment.status == "confirmed", Appointment.date == today)))).scalar()
    week_n    = (await db.execute(select(func.count()).select_from(Appointment).where(and_(Appointment.status == "confirmed", Appointment.date >= week_start, Appointment.date <= week_end)))).scalar()
    completed = (await db.execute(select(func.count()).select_from(Appointment).where(Appointment.status == "completed"))).scalar()
    cancelled = (await db.execute(select(func.count()).select_from(Appointment).where(Appointment.status == "cancelled"))).scalar()

    return AppointmentStats(
        total=total or 0, today=today_n or 0, this_week=week_n or 0,
        completed=completed or 0, cancelled=cancelled or 0,
    )


@router.get("/week", response_model=List[AppointmentOut])
async def appointments_for_week(
    week_start: str = Query(...),
    week_end:   str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment)
        .where(
            Appointment.date >= week_start,
            Appointment.date <= week_end,
            Appointment.status != "cancelled",
        )
        .order_by(Appointment.date, Appointment.start_time)
    )
    return [model_to_out(a) for a in result.scalars().all()]


@router.get("/date/{dt}", response_model=List[AppointmentOut])
async def appointments_for_date(dt: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Appointment)
        .where(Appointment.date == dt, Appointment.status != "cancelled")
        .order_by(Appointment.start_time)
    )
    return [model_to_out(a) for a in result.scalars().all()]


@router.post("", response_model=AppointmentOut, status_code=201)
async def create_appointment(body: AppointmentCreate, db: AsyncSession = Depends(get_db)):
    proc = get_procedure(body.procedure_id)
    if not proc:
        raise HTTPException(400, f"Unknown procedure: {body.procedure_id}")
    room = find_room_for_procedure(body.clinic_id, body.procedure_id)
    if not room:
        raise HTTPException(400, f"Clinic {body.clinic_id} cannot handle {body.procedure_id}")

    appt = Appointment(
        procedure_id=body.procedure_id,
        patient_name=body.patient_name,
        patient_phone=body.patient_phone,
        patient_email=body.patient_email,
        clinic_id=body.clinic_id,
        room_id=room["id"],
        date=body.date,
        start_time=body.start_time,
        duration_mins=proc["duration"],
        doctor_ids=json.dumps(body.doctor_ids),
        primary_doctor_id=body.primary_doctor_id,
        notes=body.notes,
        status=body.status or "confirmed",
    )
    db.add(appt)
    await db.commit()
    await db.refresh(appt)
    return model_to_out(appt)


@router.patch("/{appt_id}/status", response_model=AppointmentOut)
async def update_status(
    appt_id: str,
    body: AppointmentStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    appt = await db.get(Appointment, appt_id)
    if not appt:
        raise HTTPException(404, "Appointment not found")
    appt.status = body.status
    await db.commit()
    await db.refresh(appt)
    return model_to_out(appt)


@router.delete("/{appt_id}")
async def cancel_appointment(appt_id: str, db: AsyncSession = Depends(get_db)):
    appt = await db.get(Appointment, appt_id)
    if not appt:
        raise HTTPException(404, "Appointment not found")
    appt.status = "cancelled"
    await db.commit()
    return {"ok": True}


@router.post("/bulk", response_model=dict, status_code=201)
async def bulk_import_appointments(body: List[dict], db: AsyncSession = Depends(get_db)):
    from datetime import datetime
    from app.routers.slots import _has_conflict, time_to_mins
    
    # Pre-fetch existing bookings for collision detection
    dates = list(set([item.get("date") for item in body if item.get("date")]))
    if dates:
        existing_rows = await db.execute(
            select(Appointment).where(Appointment.date.in_(dates), Appointment.status != "cancelled")
        )
        booked_appts = [
            {
                "date": a.date,
                "clinic_id": a.clinic_id,
                "room_id": a.room_id,
                "start_time": a.start_time,
                "duration_mins": a.duration_mins,
                "doctor_ids": a.doctor_ids,
            }
            for a in existing_rows.scalars().all()
        ]
    else:
        booked_appts = []

    imported = 0
    skipped = 0
    
    for item in body:
        item_id = item.get("id")
        if item_id:
            existing = await db.get(Appointment, item_id)
            if existing: # Ignore if UUID is already in DB
                skipped += 1
                continue
        
        doctor_ids = item.get("doctor_ids", [])
        start_time = item.get("start_time")
        dur = item.get("duration_mins", 30)
        clinic_id = item.get("clinic_id")
        room_id = item.get("room_id")
        date_str = item.get("date")

        # Live clash computation
        if date_str and start_time and clinic_id and room_id:
            start_m = time_to_mins(start_time)
            day_booked = [b for b in booked_appts if b["date"] == date_str]
            if _has_conflict(start_m, dur, clinic_id, room_id, doctor_ids, day_booked):
                skipped += 1
                continue

        # Format doctor IDs to DB JSON
        doc_json = json.dumps(doctor_ids) if isinstance(doctor_ids, list) else doctor_ids

        # Parse legacy string dates if available
        created_at_dt = None
        created_at_str = item.get("created_at")
        if created_at_str:
            try: created_at_dt = datetime.fromisoformat(created_at_str)
            except ValueError: pass

        appt = Appointment(
            id=item_id,
            procedure_id=item.get("procedure_id"),
            patient_name=item.get("patient_name"),
            patient_phone=item.get("patient_phone"),
            patient_email=item.get("patient_email"),
            clinic_id=clinic_id,
            room_id=room_id,
            date=date_str,
            start_time=start_time,
            duration_mins=dur,
            doctor_ids=doc_json,
            primary_doctor_id=item.get("primary_doctor_id"),
            notes=item.get("notes"),
            status=item.get("status", "confirmed")
        )
        if created_at_dt:
            appt.created_at = created_at_dt

        # Append to our local validation cache so inner-array items clash against each other!
        booked_appts.append({
            "date": date_str,
            "clinic_id": clinic_id,
            "room_id": room_id,
            "start_time": start_time,
            "duration_mins": dur,
            "doctor_ids": doc_json
        })

        db.add(appt)
        imported += 1
    
    await db.commit()
    return {"ok": True, "imported": imported, "skipped": skipped}


