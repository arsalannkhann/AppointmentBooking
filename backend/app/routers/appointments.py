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
