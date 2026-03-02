"""
Dispute timeline alerts service.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DisputeAlertDelivery, Notification, SearchResult

logger = logging.getLogger(__name__)

ALERT_OPENING_D1 = "opening_d1"
ALERT_OPENING_D0 = "opening_d0"
ALERT_CLOSING_H2 = "closing_h2"


def _to_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _truncate(text: str | None, limit: int = 140) -> str:
    if not text:
        return "Edital sem descrição"
    text = " ".join(text.split()).strip()
    if len(text) <= limit:
        return text
    return f"{text[:limit - 1].rstrip()}…"


def _build_alert_content(alert_type: str, result: SearchResult) -> tuple[str, str]:
    subject = _truncate(result.objeto_compra)
    if alert_type == ALERT_OPENING_D1:
        return (
            "Amanhã abre o envio de propostas",
            f"{subject}",
        )
    if alert_type == ALERT_OPENING_D0:
        return (
            "Envio de propostas aberto",
            f"{subject}",
        )
    if alert_type == ALERT_CLOSING_H2:
        return (
            "Envio de propostas encerra em 2 horas",
            f"{subject}",
        )
    return ("Alerta de disputa", subject)


def _is_alert_due(
    *,
    alert_type: str,
    now: datetime,
    opening: datetime | None,
    closing: datetime | None,
) -> tuple[bool, datetime | None]:
    if alert_type == ALERT_OPENING_D1:
        if opening is None or now >= opening:
            return False, None
        scheduled_for = opening - timedelta(hours=24)
        return now >= scheduled_for, scheduled_for

    if alert_type == ALERT_OPENING_D0:
        if opening is None or now < opening:
            return False, None
        scheduled_for = opening
        return now <= opening + timedelta(minutes=30), scheduled_for

    if alert_type == ALERT_CLOSING_H2:
        if closing is None or now >= closing:
            return False, None
        scheduled_for = closing - timedelta(hours=2)
        return now >= scheduled_for, scheduled_for

    return False, None


async def _delivery_exists(
    db: AsyncSession,
    *,
    result_id,
    alert_type: str,
    scheduled_for: datetime,
) -> bool:
    existing = (
        await db.execute(
            select(DisputeAlertDelivery.id).where(
                DisputeAlertDelivery.result_id == result_id,
                DisputeAlertDelivery.alert_type == alert_type,
                DisputeAlertDelivery.scheduled_for == scheduled_for,
            )
        )
    ).scalar_one_or_none()
    return existing is not None


async def check_and_send_dispute_timeline_alerts(
    db: AsyncSession,
    *,
    send_opening_d0: bool = False,
    send_closing_h2: bool = False,
) -> dict[str, int]:
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(hours=24)
    closing_window_end = now + timedelta(hours=2)

    filters = [
        SearchResult.data_abertura_proposta.is_not(None),
        SearchResult.data_encerramento_proposta.is_not(None),
    ]
    results = (
        await db.execute(
            select(SearchResult).where(
                SearchResult.status == "dispute_open",
                or_(*filters),
            )
        )
    ).scalars().all()

    counters = {
        "processed": len(results),
        "sent": 0,
        "deduped": 0,
    }
    alert_types = [ALERT_OPENING_D1]
    if send_opening_d0:
        alert_types.append(ALERT_OPENING_D0)
    if send_closing_h2:
        alert_types.append(ALERT_CLOSING_H2)

    for result in results:
        opening = _to_utc(result.data_abertura_proposta)
        closing = _to_utc(result.data_encerramento_proposta)
        if opening and opening > window_end and not send_opening_d0:
            continue
        if closing and closing > closing_window_end and not send_closing_h2:
            if opening is None or opening > window_end:
                continue

        for alert_type in alert_types:
            is_due, scheduled_for = _is_alert_due(
                alert_type=alert_type,
                now=now,
                opening=opening,
                closing=closing,
            )
            if not is_due or scheduled_for is None:
                continue

            if await _delivery_exists(
                db,
                result_id=result.id,
                alert_type=alert_type,
                scheduled_for=scheduled_for,
            ):
                counters["deduped"] += 1
                continue

            title, body = _build_alert_content(alert_type, result)
            notification = Notification(
                user_id=result.user_id,
                automation_id=result.automation_id,
                channel="in_app",
                title=title,
                body=body,
                metadata_={
                    "result_id": str(result.id),
                    "alert_type": alert_type,
                    "scheduled_for": scheduled_for.isoformat(),
                },
            )
            db.add(notification)
            await db.flush()

            db.add(
                DisputeAlertDelivery(
                    result_id=result.id,
                    user_id=result.user_id,
                    alert_type=alert_type,
                    scheduled_for=scheduled_for,
                    notification_id=notification.id,
                    sent_at=now,
                )
            )
            counters["sent"] += 1

    await db.commit()
    logger.info(
        "Dispute timeline alerts: processed=%s sent=%s deduped=%s",
        counters["processed"],
        counters["sent"],
        counters["deduped"],
    )
    return counters
