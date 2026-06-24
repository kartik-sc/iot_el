"""
Persists incoming telemetry to PostgreSQL and manages fault_event lifecycle.
"""
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.crane import TelemetrySnapshot, FaultEvent

logger = logging.getLogger(__name__)

FAULT_MOTOR_STATES = {"ERROR", "TIMEOUT"}


async def persist_telemetry(
    session: AsyncSession,
    crane_id: uuid.UUID,
    data: dict,
) -> None:
    snapshot = TelemetrySnapshot(
        crane_id=crane_id,
        current_theta=data.get("current_theta"),
        current_R=data.get("current_R"),
        current_H=data.get("current_H"),
        motor_status=data.get("motor_status"),
        system_status=data.get("system_status"),
    )
    session.add(snapshot)

    motor = data.get("motor_status", "IDLE")
    sys_status = data.get("system_status", "OK")
    is_fault = motor in FAULT_MOTOR_STATES or sys_status != "OK"

    if is_fault:
        # Open a new fault event only if there isn't an open one already
        existing = await session.scalar(
            select(FaultEvent)
            .where(FaultEvent.crane_id == crane_id, FaultEvent.resolved_at.is_(None))
        )
        if not existing:
            session.add(FaultEvent(
                crane_id=crane_id,
                motor_status=motor,
                system_status=sys_status,
            ))
    else:
        # Resolve any open fault events
        await session.execute(
            update(FaultEvent)
            .where(FaultEvent.crane_id == crane_id, FaultEvent.resolved_at.is_(None))
            .values(resolved_at=datetime.now(timezone.utc))
        )

    await session.commit()
