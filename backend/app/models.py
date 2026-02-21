"""
models.py — SQLAlchemy ORM models
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    String, Integer, Text, DateTime, ForeignKey, ARRAY
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, ARRAY as PG_ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def new_uuid() -> str:
    return str(uuid.uuid4())


class Appointment(Base):
    __tablename__ = "appointments"

    id                 : Mapped[str] = mapped_column(String(64), primary_key=True, default=new_uuid)
    procedure_id       : Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    patient_name       : Mapped[str] = mapped_column(String(256), nullable=False)
    patient_phone      : Mapped[str | None] = mapped_column(String(64))
    patient_email      : Mapped[str | None] = mapped_column(String(256))
    clinic_id          : Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    room_id            : Mapped[str] = mapped_column(String(16), nullable=False)
    date               : Mapped[str] = mapped_column(String(10),  nullable=False, index=True)  # YYYY-MM-DD
    start_time         : Mapped[str] = mapped_column(String(5),   nullable=False)              # HH:MM
    duration_mins      : Mapped[int] = mapped_column(Integer,     nullable=False)
    doctor_ids         : Mapped[str] = mapped_column(Text, nullable=False)   # JSON array stored as text
    primary_doctor_id  : Mapped[str] = mapped_column(String(64),  nullable=False, index=True)
    notes              : Mapped[str | None] = mapped_column(Text)
    status             : Mapped[str] = mapped_column(String(32), default="confirmed", index=True)
    created_at         : Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at         : Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id           : Mapped[str]      = mapped_column(String(64), primary_key=True, default=new_uuid)
    patient_name : Mapped[str | None] = mapped_column(String(256))
    started_at   : Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ended_at     : Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    meta_json    : Mapped[str | None] = mapped_column(Text)

    messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage", back_populates="session", cascade="all, delete-orphan"
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id         : Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id : Mapped[str]      = mapped_column(String(64), ForeignKey("chat_sessions.id"), nullable=False, index=True)
    role       : Mapped[str]      = mapped_column(String(16), nullable=False)   # user | assistant
    content    : Mapped[str]      = mapped_column(Text, nullable=False)
    created_at : Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["ChatSession"] = relationship("ChatSession", back_populates="messages")
