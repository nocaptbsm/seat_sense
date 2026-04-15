from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


# ── Student ──────────────────────────────────────────────────────────────────

class StudentCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    student_id: int
    name: str
    email: EmailStr
    phone: Optional[str] = None
    created_at: datetime


# ── Seat ─────────────────────────────────────────────────────────────────────

class SeatOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    seat_id: int
    esp32_id: Optional[int] = None
    sensor_pin: Optional[int] = None
    qr_url: Optional[str] = None
    status: str


# ── Session ───────────────────────────────────────────────────────────────────

class StartSessionRequest(BaseModel):
    student_id: int
    seat_id: int


class StartSessionResponse(BaseModel):
    session_id: int
    student_id: int
    seat_id: int
    start_time: datetime
    session_status: str


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: int
    student_id: int
    seat_id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    session_status: str
    duration_seconds: Optional[int] = None


# ── Seat Status (ESP32 heartbeat) ─────────────────────────────────────────────

class SeatStatusUpdate(BaseModel):
    seat_id: int
    occupied: bool
    esp32_id: Optional[int] = None


class SeatStatusResponse(BaseModel):
    seat_id: int
    status: str
    message: str


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardSummary(BaseModel):
    total_seats: int
    occupied_seats: int
    available_seats: int
    active_sessions: int


# ── WebSocket broadcast payload ───────────────────────────────────────────────

class SeatBroadcast(BaseModel):
    seat_id: int
    status: str
    student_id: Optional[int] = None
    session_id: Optional[int] = None
    start_time: Optional[datetime] = None
