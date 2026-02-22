"""
API Routes — Notifications
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Notification
from app.schemas import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["Notificações"])


async def get_current_user_id(x_user_id: str = Query(..., alias="user_id")) -> uuid.UUID:
    return uuid.UUID(x_user_id)


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    user_id: uuid.UUID = Depends(get_current_user_id),
    unread_only: bool = False,
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List notifications for the current user."""
    conditions = [Notification.user_id == user_id]
    if unread_only:
        conditions.append(Notification.is_read == False)

    result = await db.execute(
        select(Notification)
        .where(and_(*conditions))
        .order_by(Notification.sent_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/unread-count")
async def get_unread_count(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the count of unread notifications."""
    count = (await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
    )).scalar() or 0
    return {"unread_count": count}


@router.patch("/{notification_id}/read")
async def mark_as_read(
    notification_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Mark a notification as read."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")

    notif.is_read = True
    await db.commit()
    return {"ok": True}


@router.post("/mark-all-read")
async def mark_all_read(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read."""
    stmt = (
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
        .values(is_read=True)
    )
    result = await db.execute(stmt)
    await db.commit()
    return {"updated": result.rowcount}
