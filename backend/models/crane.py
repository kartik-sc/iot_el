import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from ..database.connection import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Crane(Base):
    __tablename__ = "cranes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    firebase_namespace: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    commands: Mapped[list["Command"]] = relationship(back_populates="crane")
    telemetry_snapshots: Mapped[list["TelemetrySnapshot"]] = relationship(back_populates="crane")
    fault_events: Mapped[list["FaultEvent"]] = relationship(back_populates="crane")


class Command(Base):
    __tablename__ = "commands"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    command_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    crane_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cranes.id"), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    target_theta: Mapped[float] = mapped_column(Float, nullable=False)
    target_R: Mapped[float] = mapped_column(Float, nullable=False)
    target_H: Mapped[float] = mapped_column(Float, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    crane: Mapped["Crane"] = relationship(back_populates="commands")


class TelemetrySnapshot(Base):
    __tablename__ = "telemetry_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crane_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cranes.id"), nullable=False)
    current_theta: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_R: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_H: Mapped[float | None] = mapped_column(Float, nullable=True)
    motor_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    system_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    crane: Mapped["Crane"] = relationship(back_populates="telemetry_snapshots")


class FaultEvent(Base):
    __tablename__ = "fault_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crane_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cranes.id"), nullable=False)
    motor_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    system_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    crane: Mapped["Crane"] = relationship(back_populates="fault_events")
