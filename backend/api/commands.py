import uuid
import random
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.connection import get_db
from ..models.crane import Command, Crane
from ..schemas.crane import CommandCreate, CommandOut, CommandPage
from ..services.firebase_listener import write_command_to_firebase

router = APIRouter(prefix="/commands", tags=["commands"])


def _new_cmd_id() -> str:
    return "cmd_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=5))


@router.post("", response_model=CommandOut, status_code=201)
async def send_command(
    body: CommandCreate,
    db: AsyncSession = Depends(get_db),
    # TODO: user_id: str = Depends(get_current_user_id)  — add Clerk auth
):
    crane = await db.get(Crane, body.crane_id)
    if not crane:
        raise HTTPException(404, "Crane not found")

    cmd_id = _new_cmd_id()
    now = datetime.now(timezone.utc)

    firebase_payload = {
        "command_id": cmd_id,
        "target_theta": body.target_theta,
        "target_R": body.target_R,
        "target_H": body.target_H,
        "timestamp": now.isoformat(),
    }
    write_command_to_firebase(crane.firebase_namespace, firebase_payload)

    cmd = Command(
        command_id=cmd_id,
        crane_id=body.crane_id,
        user_id=None,  # TODO: inject from Clerk JWT
        target_theta=body.target_theta,
        target_R=body.target_R,
        target_H=body.target_H,
        sent_at=now,
    )
    db.add(cmd)
    await db.commit()
    await db.refresh(cmd)
    return cmd


@router.get("", response_model=CommandPage)
async def get_commands(
    crane_id: uuid.UUID,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    total = await db.scalar(
        select(func.count()).select_from(Command).where(Command.crane_id == crane_id)
    )
    result = await db.execute(
        select(Command)
        .where(Command.crane_id == crane_id)
        .order_by(Command.sent_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return CommandPage(items=result.scalars().all(), total=total or 0, limit=limit, offset=offset)
