"""data_model.py — Static clinic data (identical to Streamlit version)"""

CLINICS = [
    {
        "id": "downtown", "name": "MedDent Downtown", "short_name": "Downtown",
        "address": "42 Park Street, Downtown", "phone": "+1 (555) 100-2000",
        "rooms": [
            {"id": "R1", "name": "Room 1", "label": "General Suite",
             "capabilities": ["general", "triage", "cleaning", "filling", "consult", "xray"]},
            {"id": "R2", "name": "Room 2", "label": "Endo Suite",
             "capabilities": ["endodontics", "root_canal", "microscope", "xray", "consult"]},
            {"id": "R4", "name": "Room 4", "label": "Surgical Suite",
             "capabilities": ["oral_surgery", "extraction", "sedation", "iv_sedation", "consult"]},
        ]
    },
    {
        "id": "westside", "name": "MedDent Westside", "short_name": "Westside",
        "address": "18 Oak Avenue, Westside", "phone": "+1 (555) 200-3000",
        "rooms": [
            {"id": "R1", "name": "Room 1", "label": "General Suite",
             "capabilities": ["general", "triage", "cleaning", "filling", "consult", "xray"]},
            {"id": "R4", "name": "Room 4", "label": "Surgical Suite",
             "capabilities": ["oral_surgery", "extraction", "sedation", "consult"]},
        ]
    }
]

SPECIALIZATIONS = [
    {"id": "general",        "name": "General Dentistry", "color": "#4ECDC4"},
    {"id": "endodontics",    "name": "Endodontics",        "color": "#F7C653"},
    {"id": "oral_surgery",   "name": "Oral Surgery",       "color": "#FF6B6B"},
    {"id": "anesthesiology", "name": "Anesthesiology",     "color": "#A78BFA"},
]

DOCTORS = [
    {
        "id": "dr_chen", "name": "Dr. Sarah Chen", "title": "BDS, MFGDP",
        "specializations": ["general"],
        "bio": "10 years experience in general and preventive dentistry.",
        "availability": [
            {"clinic_id": "downtown", "days": [1,2,3,4,5], "start_hour": 9,  "end_hour": 17},
            {"clinic_id": "westside", "days": [6],          "start_hour": 9,  "end_hour": 13},
        ]
    },
    {
        "id": "dr_patel", "name": "Dr. Raj Patel", "title": "BDS, FDS RCS",
        "specializations": ["general"],
        "bio": "Specialist in restorative and cosmetic dentistry.",
        "availability": [
            {"clinic_id": "westside", "days": [1,2,3,4,5], "start_hour": 8,  "end_hour": 16},
            {"clinic_id": "downtown", "days": [6],          "start_hour": 9,  "end_hour": 14},
        ]
    },
    {
        "id": "dr_morgan", "name": "Dr. Emma Morgan", "title": "BDS, MEndo, PhD",
        "specializations": ["endodontics"],
        "bio": "Endodontic specialist with microscope-guided RCT expertise.",
        "availability": [
            {"clinic_id": "downtown", "days": [1,3,5], "start_hour": 10, "end_hour": 18},
            {"clinic_id": "westside", "days": [2,4],   "start_hour": 9,  "end_hour": 15},
        ]
    },
    {
        "id": "dr_okafor", "name": "Dr. James Okafor", "title": "BDS, FDSRCS, MChD",
        "specializations": ["oral_surgery"],
        "bio": "Oral and maxillofacial surgeon — wisdom teeth & implants.",
        "availability": [
            {"clinic_id": "downtown", "days": [2,4],   "start_hour": 8,  "end_hour": 16},
            {"clinic_id": "westside", "days": [1,3,5], "start_hour": 9,  "end_hour": 17},
        ]
    },
    {
        "id": "dr_silva", "name": "Dr. Ana Silva", "title": "MBBS, DA, FRCA",
        "specializations": ["anesthesiology"],
        "bio": "Consultant anesthetist for IV sedation procedures.",
        "availability": [
            {"clinic_id": "downtown", "days": [2,4], "start_hour": 8, "end_hour": 16},
        ]
    },
]

PROCEDURES = [
    {
        "id": "emergency_triage", "name": "Emergency Triage", "duration": 15,
        "required_specs": ["general"], "required_capabilities": ["general", "triage"],
        "color": "#FF6B6B", "description": "Urgent same/next-day pain or trauma assessment",
        "priority": "urgent", "note": "Room 1 (General Suite) only",
        "follow_up": None, "requires_anesthetist": False,
    },
    {
        "id": "general_checkup", "name": "General Checkup & Clean", "duration": 30,
        "required_specs": ["general"], "required_capabilities": ["general", "cleaning"],
        "color": "#4ECDC4", "description": "Routine examination, x-ray and professional cleaning",
        "follow_up": None, "requires_anesthetist": False,
    },
    {
        "id": "filling", "name": "Tooth Filling", "duration": 45,
        "required_specs": ["general"], "required_capabilities": ["general", "filling"],
        "color": "#38BDF8", "description": "Composite or amalgam restoration",
        "follow_up": None, "requires_anesthetist": False,
    },
    {
        "id": "rct_consult", "name": "Root Canal Consultation", "duration": 20,
        "required_specs": ["endodontics"], "required_capabilities": ["endodontics", "consult"],
        "color": "#F7C653", "description": "Initial endodontic assessment",
        "note": "Room 2 (Endo Suite) required — microscope + X-ray available",
        "follow_up": {"procedure_id": "rct_treatment", "label": "Root Canal Treatment"},
        "requires_anesthetist": False,
    },
    {
        "id": "rct_treatment", "name": "Root Canal Treatment", "duration": 75,
        "required_specs": ["endodontics"],
        "required_capabilities": ["endodontics", "root_canal", "microscope", "xray"],
        "color": "#FB923C", "description": "Full RCT: 60–90 min; microscope + X-ray mandatory",
        "note": "Room 2 only.",
        "follow_up": None, "requires_anesthetist": False,
    },
    {
        "id": "wisdom_consult", "name": "Wisdom Tooth Consultation", "duration": 15,
        "required_specs": ["oral_surgery"], "required_capabilities": ["oral_surgery", "consult"],
        "color": "#C084FC", "description": "Assessment of impacted wisdom teeth",
        "follow_up": {"procedure_id": "wisdom_extraction", "label": "Wisdom Tooth Extraction"},
        "requires_anesthetist": False,
    },
    {
        "id": "wisdom_extraction", "name": "Wisdom Tooth Extraction", "duration": 75,
        "required_specs": ["oral_surgery"], "required_capabilities": ["oral_surgery", "extraction"],
        "color": "#F87171", "description": "Surgical extraction — 60–90 min",
        "note": "Room 4 (Surgical Suite) at either clinic",
        "follow_up": None, "requires_anesthetist": False,
    },
    {
        "id": "wisdom_extraction_iv", "name": "Wisdom Extraction (IV Sedation)", "duration": 90,
        "required_specs": ["oral_surgery", "anesthesiology"],
        "required_capabilities": ["oral_surgery", "extraction", "iv_sedation"],
        "color": "#EF4444", "description": "IV sedation extraction — oral surgeon + anesthetist",
        "note": "Downtown only (Room 4 has IV sedation). Dr. Okafor + Dr. Silva required.",
        "follow_up": None, "requires_anesthetist": True,
    },
]

DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

def get_clinic(cid):    return next((c for c in CLINICS    if c["id"] == cid), None)
def get_doctor(did):    return next((d for d in DOCTORS    if d["id"] == did), None)
def get_procedure(pid): return next((p for p in PROCEDURES if p["id"] == pid), None)
def get_spec(sid):      return next((s for s in SPECIALIZATIONS if s["id"] == sid), None)

def find_room_for_procedure(clinic_id: str, procedure_id: str):
    proc   = get_procedure(procedure_id)
    clinic = get_clinic(clinic_id)
    if not proc or not clinic:
        return None
    return next(
        (r for r in clinic["rooms"]
         if all(c in r["capabilities"] for c in proc["required_capabilities"])),
        None
    )
