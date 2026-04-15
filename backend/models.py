from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey,
    Enum as SAEnum, BigInteger, func
)
from sqlalchemy.orm import relationship, DeclarativeBase
import enum


class Base(DeclarativeBase):
    pass


class SeatStatus(str, enum.Enum):
    available = "available"
    occupied = "occupied"


class SessionStatus(str, enum.Enum):
    active = "active"
    ended = "ended"
    timeout = "timeout"
    replaced = "replaced"


class EventType(str, enum.Enum):
    session_started = "session_started"
    session_ended = "session_ended"
    absence_detected = "absence_detected"
    student_returned = "student_returned"
    session_timeout = "session_timeout"
    session_replaced = "session_replaced"


class Student(Base):
    __tablename__ = "students"

    student_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    phone = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    sessions = relationship("Session", back_populates="student")


class ESP32Device(Base):
    __tablename__ = "esp32_devices"

    esp32_id = Column(Integer, primary_key=True, autoincrement=True)
    device_name = Column(String(255), nullable=False)
    ip_address = Column(String(45), nullable=True)
    location = Column(String(255), nullable=True)
    last_seen = Column(DateTime(timezone=True), nullable=True)

    seats = relationship("Seat", back_populates="esp32_device")


class Seat(Base):
    __tablename__ = "seats"

    seat_id = Column(Integer, primary_key=True, autoincrement=True)
    esp32_id = Column(Integer, ForeignKey("esp32_devices.esp32_id"), nullable=True)
    sensor_pin = Column(Integer, nullable=True)
    qr_url = Column(String(512), unique=True, nullable=True)
    status = Column(
        SAEnum(SeatStatus, name="seat_status_enum", create_type=True),
        default=SeatStatus.available,
        nullable=False,
    )

    esp32_device = relationship("ESP32Device", back_populates="seats")
    sessions = relationship("Session", back_populates="seat")
    events = relationship("SeatEvent", back_populates="seat")


class Session(Base):
    __tablename__ = "sessions"

    session_id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.student_id"), nullable=False)
    seat_id = Column(Integer, ForeignKey("seats.seat_id"), nullable=False)
    start_time = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    session_status = Column(
        SAEnum(SessionStatus, name="session_status_enum", create_type=True),
        default=SessionStatus.active,
        nullable=False,
    )
    duration_seconds = Column(BigInteger, nullable=True)

    student = relationship("Student", back_populates="sessions")
    seat = relationship("Seat", back_populates="sessions")
    events = relationship("SeatEvent", back_populates="session")


class SeatEvent(Base):
    __tablename__ = "seat_events"

    event_id = Column(Integer, primary_key=True, autoincrement=True)
    seat_id = Column(Integer, ForeignKey("seats.seat_id"), nullable=False)
    session_id = Column(Integer, ForeignKey("sessions.session_id"), nullable=True)
    event_type = Column(
        SAEnum(EventType, name="event_type_enum", create_type=True),
        nullable=False,
    )
    event_time = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    seat = relationship("Seat", back_populates="events")
    session = relationship("Session", back_populates="events")
