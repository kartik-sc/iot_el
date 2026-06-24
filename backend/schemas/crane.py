import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Literal


MotorStatus = Literal["IDLE", "MOVING", "ERROR", "TIMEOUT"]
SystemStatus = Literal["OK", "ERR:LIMIT", "ERR:TIMEOUT", "ERR:MALFORMED"]


# ── Crane ──────────────────────────────────────────────
class CraneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    firebase_namespace: str = Field(default="")


class CraneOut(BaseModel):
    id: uuid.UUID
    name: str
    firebase_namespace: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Commands ───────────────────────────────────────────
class CommandCreate(BaseModel):
    crane_id: uuid.UUID
    target_theta: float
    target_R: float
    target_H: float


class CommandOut(BaseModel):
    id: uuid.UUID
    command_id: str
    crane_id: uuid.UUID
    user_id: str | None
    target_theta: float
    target_R: float
    target_H: float
    sent_at: datetime

    model_config = {"from_attributes": True}


class CommandPage(BaseModel):
    items: list[CommandOut]
    total: int
    limit: int
    offset: int


# ── Telemetry ──────────────────────────────────────────
class TelemetrySnapshotOut(BaseModel):
    id: uuid.UUID
    crane_id: uuid.UUID
    current_theta: float | None
    current_R: float | None
    current_H: float | None
    motor_status: str | None
    system_status: str | None
    recorded_at: datetime

    model_config = {"from_attributes": True}


# ── Faults ─────────────────────────────────────────────
class FaultEventOut(BaseModel):
    id: uuid.UUID
    crane_id: uuid.UUID
    motor_status: str | None
    system_status: str | None
    occurred_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}
