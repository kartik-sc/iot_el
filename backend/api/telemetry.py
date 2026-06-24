import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.connection import get_db
from ..models.crane import TelemetrySnapshot, FaultEvent
from ..schemas.crane import TelemetrySnapshotOut, FaultEventOut

router = APIRouter(tags=["telemetry"])


@router.get("/telemetry/history", response_model=list[TelemetrySnapshotOut])
async def get_telemetry_history(
    crane_id: uuid.UUID,
    from_dt: datetime = Query(alias="from"),
    to_dt: datetime = Query(alias="to"),
    limit: int = Query(default=500, le=2000),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TelemetrySnapshot)
        .where(
            TelemetrySnapshot.crane_id == crane_id,
            TelemetrySnapshot.recorded_at >= from_dt,
            TelemetrySnapshot.recorded_at <= to_dt,
        )
        .order_by(TelemetrySnapshot.recorded_at.asc())
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/telemetry/latest", response_model=TelemetrySnapshotOut | None)
async def get_telemetry_latest(crane_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TelemetrySnapshot)
        .where(TelemetrySnapshot.crane_id == crane_id)
        .order_by(TelemetrySnapshot.recorded_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


@router.get("/faults", response_model=list[FaultEventOut])
async def get_faults(
    crane_id: uuid.UUID,
    resolved: bool | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db),
):
    q = select(FaultEvent).where(FaultEvent.crane_id == crane_id)
    if resolved is False:
        q = q.where(FaultEvent.resolved_at.is_(None))
    elif resolved is True:
        q = q.where(FaultEvent.resolved_at.is_not(None))
    q = q.order_by(FaultEvent.occurred_at.desc()).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()
