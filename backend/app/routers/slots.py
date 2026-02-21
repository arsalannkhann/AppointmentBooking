"""routers/slots.py — Real-time slot finder"""

import json
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Appointment
from app.schemas import SlotOut
from app.data_model import (
    CLINICS, DOCTORS, PROCEDURES,
    get_procedure, find_room_for_procedure,
)

router = APIRouter()


def time_to_mins(hhmm: str) -> int:
    h, m = map(int, hhmm.split(":"))
    return h * 60 + m


def mins_to_time(mins: int) -> str:
    return f"{mins // 60:02d}:{mins % 60:02d}"


def _doctor_slots(doctor: dict, clinic_id: str, our_dow: int) -> set:
    """Return set of available start-minutes (15-min granularity) for a doctor on a given day."""
    avail = next(
        (a for a in doctor["availability"]
         if a["clinic_id"] == clinic_id and our_dow in a["days"]),
        None
    )
    if not avail:
        return set()
    start = avail["start_hour"] * 60
    end   = avail["end_hour"]   * 60
    return set(range(start, end - 14, 15))


def _has_conflict(start_m: int, dur: int, clinic_id: str, room_id: str,
                  doctor_ids: list, day_booked: list) -> bool:
    end_m = start_m + dur
    for b in day_booked:
        b_start = time_to_mins(b["start_time"])
        b_end   = b_start + b["duration_mins"]
        if start_m >= b_end or end_m <= b_start:
            continue
        b_docs = json.loads(b["doctor_ids"]) if isinstance(b["doctor_ids"], str) else b["doctor_ids"]
        if b["clinic_id"] == clinic_id and (
            b["room_id"] == room_id or
            any(d in b_docs for d in doctor_ids)
        ):
            return True
    return False


@router.get("", response_model=List[SlotOut])
async def find_slots(
    procedure_id:        str           = Query(...),
    preferred_clinic_id: Optional[str] = Query(None),
    days_ahead:          int           = Query(14, ge=1, le=60),
    max_results:         int           = Query(8,  ge=1, le=30),
    db: AsyncSession = Depends(get_db),
):
    proc = get_procedure(procedure_id)
    if not proc:
        return []

    dur          = proc["duration"]
    slots_needed = (dur + 14) // 15
    today        = date.today()
    end_day      = today + timedelta(days=days_ahead)

    # Fetch all booked slots from DB in range
    rows = await db.execute(
        select(Appointment)
        .where(
            Appointment.date >= str(today),
            Appointment.date <= str(end_day),
            Appointment.status != "cancelled",
        )
    )
    booked_appts = [
        {
            "date":         a.date,
            "clinic_id":    a.clinic_id,
            "room_id":      a.room_id,
            "start_time":   a.start_time,
            "duration_mins": a.duration_mins,
            "doctor_ids":   a.doctor_ids,
        }
        for a in rows.scalars().all()
    ]

    clinics = [c for c in CLINICS if not preferred_clinic_id or c["id"] == preferred_clinic_id]
    results: list[SlotOut] = []

    # day.weekday(): 0=Mon … 6=Sun; our avail uses 1=Mon … 5=Fri, 6=Sat, 0=Sun
    _dow_map = {0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 0}

    for day_off in range(days_ahead):
        if len(results) >= max_results * 2:
            break
        check = today + timedelta(days=day_off)
        ds    = str(check)
        our_dow = _dow_map[check.weekday()]
        day_booked = [b for b in booked_appts if b["date"] == ds]

        for clinic in clinics:
            room = find_room_for_procedure(clinic["id"], procedure_id)
            if not room:
                continue

            if proc.get("requires_anesthetist"):
                surgeons     = [d for d in DOCTORS if "oral_surgery"   in d["specializations"]]
                anesthetists = [d for d in DOCTORS if "anesthesiology" in d["specializations"]]
                for surg in surgeons:
                    s_set = _doctor_slots(surg, clinic["id"], our_dow)
                    for anes in anesthetists:
                        a_set = _doctor_slots(anes, clinic["id"], our_dow)
                        overlap = s_set & a_set
                        for sm in sorted(overlap):
                            if not all((sm + i*15) in overlap for i in range(slots_needed)):
                                continue
                            if _has_conflict(sm, dur, clinic["id"], room["id"],
                                             [surg["id"], anes["id"]], day_booked):
                                continue
                            results.append(SlotOut(
                                procedure_id=procedure_id, clinic_id=clinic["id"],
                                room_id=room["id"], date=ds, start_time=mins_to_time(sm),
                                duration_mins=dur, doctor_ids=[surg["id"], anes["id"]],
                                primary_doctor_id=surg["id"],
                            ))
                            if len(results) >= max_results:
                                return results
                            break
            else:
                primary_spec = proc["required_specs"][0]
                match_docs   = [d for d in DOCTORS if primary_spec in d["specializations"]]
                for doctor in match_docs:
                    d_slots = _doctor_slots(doctor, clinic["id"], our_dow)
                    for sm in sorted(d_slots):
                        if not all((sm + i*15) in d_slots for i in range(slots_needed)):
                            continue
                        if _has_conflict(sm, dur, clinic["id"], room["id"],
                                         [doctor["id"]], day_booked):
                            continue
                        results.append(SlotOut(
                            procedure_id=procedure_id, clinic_id=clinic["id"],
                            room_id=room["id"], date=ds, start_time=mins_to_time(sm),
                            duration_mins=dur, doctor_ids=[doctor["id"]],
                            primary_doctor_id=doctor["id"],
                        ))
                        break  # one slot per doctor per day

    return results[:max_results]
