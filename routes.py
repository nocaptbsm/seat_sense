from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Student, Seat, Session, SeatEvent, ESP32Device, SeatStatus, SessionStatus
from schemas import (
    StudentCreate, StudentOut,
    SeatOut,
    StartSessionRequest, StartSessionResponse,
    SessionOut,
    SeatStatusUpdate, SeatStatusResponse,
    DashboardSummary,
)
from session_manager import session_manager

router = APIRouter(prefix="/api/v1")


# ── Students ───────────────────────────────────────────────────────────────

@router.post("/students", response_model=StudentOut, status_code=201)
async def create_student(payload: StudentCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(Student).where(Student.email == payload.email)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Email already registered.")

    student = Student(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
    )
    db.add(student)
    await db.flush()
    await db.refresh(student)
    return student


@router.get("/students/{student_id}", response_model=StudentOut)
async def get_student(student_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Student).where(Student.student_id == student_id)
    )
    student = result.scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    return student


# ── Seats ──────────────────────────────────────────────────────────────────

@router.get("/seats", response_model=List[SeatOut])
async def list_seats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Seat).order_by(Seat.seat_id))
    return result.scalars().all()


@router.get("/seats/{seat_id}", response_model=SeatOut)
async def get_seat(seat_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Seat).where(Seat.seat_id == seat_id))
    seat = result.scalars().first()
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found.")
    return seat


# ── Sessions ───────────────────────────────────────────────────────────────

@router.post("/start-session", response_model=StartSessionResponse)
async def start_session(payload: StartSessionRequest, db: AsyncSession = Depends(get_db)):
    # Validate seat exists
    seat_result = await db.execute(select(Seat).where(Seat.seat_id == payload.seat_id))
    seat: Optional[Seat] = seat_result.scalars().first()
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found.")

    # Validate student exists
    student_result = await db.execute(
        select(Student).where(Student.student_id == payload.student_id)
    )
    student = student_result.scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    # Seat sensor must have already reported presence
    if seat.status != SeatStatus.occupied:
        raise HTTPException(
            status_code=409,
            detail="Seat sensor reports empty. Sit down on the seat first, then scan again.",
        )

    new_session = await session_manager.start_session(
        db=db,
        student_id=payload.student_id,
        seat_id=payload.seat_id,
    )

    return StartSessionResponse(
        session_id=new_session.session_id,
        student_id=new_session.student_id,
        seat_id=new_session.seat_id,
        start_time=new_session.start_time,
        session_status=new_session.session_status.value
        if hasattr(new_session.session_status, "value")
        else new_session.session_status,
    )


@router.get("/sessions/active/{student_id}", response_model=Optional[SessionOut])
async def get_active_session(student_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Session).where(
            Session.student_id == student_id,
            Session.session_status == SessionStatus.active,
        )
    )
    session = result.scalars().first()
    return session


@router.post("/sessions/{session_id}/end", response_model=SessionOut)
async def end_session(session_id: int, db: AsyncSession = Depends(get_db)):
    session = await session_manager.end_session_manually(db=db, session_id=session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session


# ── ESP32 Heartbeat ────────────────────────────────────────────────────────

@router.post("/seat-status", response_model=SeatStatusResponse)
async def update_seat_status(payload: SeatStatusUpdate, db: AsyncSession = Depends(get_db)):
    # Validate seat
    seat_result = await db.execute(select(Seat).where(Seat.seat_id == payload.seat_id))
    seat: Optional[Seat] = seat_result.scalars().first()
    if not seat:
        raise HTTPException(status_code=404, detail="Seat not found.")

    # Update seat status in DB
    new_status = SeatStatus.occupied if payload.occupied else SeatStatus.available
    seat.status = new_status
    db.add(seat)

    # Update ESP32 last_seen if esp32_id provided
    if payload.esp32_id is not None:
        esp_result = await db.execute(
            select(ESP32Device).where(ESP32Device.esp32_id == payload.esp32_id)
        )
        device: Optional[ESP32Device] = esp_result.scalars().first()
        if device:
            device.last_seen = datetime.now(timezone.utc)
            db.add(device)

    await db.flush()

    # Delegate session logic to session_manager
    await session_manager.handle_sensor_update(
        db=db,
        seat_id=payload.seat_id,
        occupied=payload.occupied,
    )

    # Broadcast physical status change instantly to the frontend
    active_session_result = await db.execute(
        select(Session).where(
            Session.seat_id == payload.seat_id,
            Session.session_status == SessionStatus.active,
        )
    )
    active_session = active_session_result.scalars().first()

    await session_manager._broadcast(
        seat_id=payload.seat_id,
        status=new_status.value if hasattr(new_status, "value") else new_status,
        student_id=active_session.student_id if active_session else None,
        session_id=active_session.session_id if active_session else None,
        start_time=active_session.start_time if active_session else None,
    )

    return SeatStatusResponse(
        seat_id=payload.seat_id,
        status=new_status.value,
        message="Status updated successfully.",
    )


# ── Dashboard ──────────────────────────────────────────────────────────────

@router.get("/dashboard/summary", response_model=DashboardSummary)
async def dashboard_summary(db: AsyncSession = Depends(get_db)):
    total_result = await db.execute(select(func.count()).select_from(Seat))
    total_seats: int = total_result.scalar_one()

    occupied_result = await db.execute(
        select(func.count()).select_from(Seat).where(Seat.status == SeatStatus.occupied)
    )
    occupied_seats: int = occupied_result.scalar_one()

    active_result = await db.execute(
        select(func.count()).select_from(Session).where(
            Session.session_status == SessionStatus.active
        )
    )
    active_sessions: int = active_result.scalar_one()

    return DashboardSummary(
        total_seats=total_seats,
        occupied_seats=occupied_seats,
        available_seats=total_seats - occupied_seats,
        active_sessions=active_sessions,
    )


@router.get("/dashboard/sessions", response_model=List[SessionOut])
async def dashboard_sessions(
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session).order_by(desc(Session.start_time)).limit(limit)
    )
    return result.scalars().all()
