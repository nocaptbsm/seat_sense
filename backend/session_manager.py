from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from models import Seat, Session, SeatEvent, SeatStatus, SessionStatus, EventType
from schemas import SeatBroadcast


class SessionManager:
    """Manages seat sessions and WebSocket broadcasts."""

    def __init__(self):
        # Injected at startup to avoid circular imports
        self.ws_manager = None

    # ── Public API ─────────────────────────────────────────────────────────

    async def start_session(
        self, db: AsyncSession, student_id: int, seat_id: int
    ) -> Session:
        """
        Closes any existing active session on the seat (status=replaced),
        creates a new session, logs session_started, and broadcasts via WebSocket.
        """
        # 1. Close any existing active session on this seat
        result = await db.execute(
            select(Session).where(
                Session.seat_id == seat_id,
                Session.session_status == SessionStatus.active,
            )
        )
        existing: Optional[Session] = result.scalars().first()

        if existing:
            now = datetime.now(timezone.utc)
            duration = int((now - existing.start_time.replace(tzinfo=timezone.utc)).total_seconds())
            existing.session_status = SessionStatus.replaced  # type: ignore[assignment]
            existing.end_time = now  # type: ignore[assignment]
            existing.duration_seconds = duration  # type: ignore[assignment]
            db.add(existing)

            # Log session_replaced event
            replaced_event = SeatEvent(
                seat_id=seat_id,
                session_id=existing.session_id,
                event_type=EventType.session_replaced,
            )
            db.add(replaced_event)

        # 2. Create new session
        new_session = Session(
            student_id=student_id,
            seat_id=seat_id,
            session_status=SessionStatus.active,
        )
        db.add(new_session)
        await db.flush()  # get session_id

        # 3. Log session_started event
        started_event = SeatEvent(
            seat_id=seat_id,
            session_id=new_session.session_id,
            event_type=EventType.session_started,
        )
        db.add(started_event)

        # Notice: We no longer forcefully update seat.status here.
        # It is strictly governed by the ESP32 physical sensor!

        await db.commit()
        await db.refresh(new_session)

        # 4. Broadcast
        # The seat physically MUST be occupied already (enforced by routes.py)
        await self._broadcast(
            seat_id=seat_id,  # type: ignore[arg-type]
            status="occupied",
            student_id=student_id,
            session_id=new_session.session_id,  # type: ignore[arg-type]
            start_time=new_session.start_time,  # type: ignore[arg-type]
        )

        return new_session

    async def handle_sensor_update(
        self, db: AsyncSession, seat_id: int, occupied: bool
    ) -> None:
        """
        Called on every ESP32 heartbeat POST /seat-status.
        - occupied=False → if active session exists, end it instantly.
        """
        if not occupied:
            # End active session instantly
            result = await db.execute(
                select(Session).where(
                    Session.seat_id == seat_id,
                    Session.session_status == SessionStatus.active,
                )
            )
            session: Optional[Session] = result.scalars().first()
            if session:
                now = datetime.now(timezone.utc)
                start = session.start_time
                if start.tzinfo is None:
                    start = start.replace(tzinfo=timezone.utc)
                
                session.session_status = SessionStatus.ended  # type: ignore[assignment]
                session.end_time = now  # type: ignore[assignment]
                session.duration_seconds = int((now - start).total_seconds())  # type: ignore[assignment]
                db.add(session)

                event = SeatEvent(
                    seat_id=seat_id,
                    session_id=session.session_id,
                    event_type=EventType.session_ended,
                )
                db.add(event)
                await db.commit()

    async def end_session_manually(
        self, db: AsyncSession, session_id: int
    ) -> Optional[Session]:
        """Closes a session with status=ended. DOES NOT mark seat as available."""
        result = await db.execute(
            select(Session).where(Session.session_id == session_id)
        )
        session: Optional[Session] = result.scalars().first()
        if not session:
            return None

        now = datetime.now(timezone.utc)
        start = session.start_time
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)

        session.session_status = SessionStatus.ended  # type: ignore[assignment]
        session.end_time = now  # type: ignore[assignment]
        session.duration_seconds = int((now - start).total_seconds())  # type: ignore[assignment]
        db.add(session)

        event = SeatEvent(
            seat_id=session.seat_id,
            session_id=session_id,
            event_type=EventType.session_ended,
        )
        db.add(event)

        # Notice: We no longer update the Seat status to Available!
        # The sensor remains the absolute source of truth.

        await db.commit()
        await db.refresh(session)

        # Broadcast the true physical state of the seat, just delinking the student details
        seat_result = await db.execute(select(Seat).where(Seat.seat_id == session.seat_id))
        actual_seat = seat_result.scalars().first()
        
        status_str = actual_seat.status.value if hasattr(actual_seat.status, "value") else actual_seat.status  # type: ignore[union-attr]

        await self._broadcast(
            seat_id=session.seat_id,  # type: ignore[arg-type]
            status=status_str,  # type: ignore[arg-type]
            student_id=None,
            session_id=None,
        )

        return session

    # ── Internal helpers ───────────────────────────────────────────────────

    async def _broadcast(
        self,
        seat_id: int,
        status: str,
        student_id: Optional[int] = None,
        session_id: Optional[int] = None,
        start_time: Optional[datetime] = None,
    ) -> None:
        if self.ws_manager is None:
            return
        payload = SeatBroadcast(
            seat_id=seat_id,
            status=status,
            student_id=student_id,
            session_id=session_id,
            start_time=start_time,
        )
        await self.ws_manager.broadcast(payload.model_dump_json())


# Singleton instance
session_manager = SessionManager()
