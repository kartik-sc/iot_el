import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.connection import get_db
from ..models.crane import Crane
from ..schemas.crane import CraneCreate, CraneOut

router = APIRouter(prefix="/cranes", tags=["cranes"])


@router.get("", response_model=list[CraneOut])
async def list_cranes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Crane).order_by(Crane.created_at))
    return result.scalars().all()


@router.post("", response_model=CraneOut, status_code=201)
async def create_crane(body: CraneCreate, db: AsyncSession = Depends(get_db)):
    crane = Crane(**body.model_dump())
    db.add(crane)
    await db.commit()
    await db.refresh(crane)
    return crane


@router.get("/{crane_id}", response_model=CraneOut)
async def get_crane(crane_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    crane = await db.get(Crane, crane_id)
    if not crane:
        raise HTTPException(404, "Crane not found")
    return crane
