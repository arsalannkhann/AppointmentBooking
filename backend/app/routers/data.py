"""routers/data.py — Static data endpoints"""
from fastapi import APIRouter
from app.data_model import CLINICS, DOCTORS, PROCEDURES, SPECIALIZATIONS
from app.schemas import ClinicOut, DoctorOut, ProcedureOut, SpecializationOut
from typing import List

router = APIRouter()

@router.get("/clinics",         response_model=List[ClinicOut])
async def get_clinics():         return CLINICS

@router.get("/doctors",         response_model=List[DoctorOut])
async def get_doctors():         return DOCTORS

@router.get("/procedures",      response_model=List[ProcedureOut])
async def get_procedures():      return PROCEDURES

@router.get("/specializations", response_model=List[SpecializationOut])
async def get_specializations(): return SPECIALIZATIONS
