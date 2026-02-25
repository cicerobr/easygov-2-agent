from __future__ import annotations

from datetime import datetime, timezone


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def score_deadline_component(deadline: datetime | None) -> float:
    if not deadline:
        return 8.0
    now = datetime.now(timezone.utc)
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    hours_left = (deadline - now).total_seconds() / 3600
    if hours_left <= 0:
        return 0.0
    if hours_left <= 24:
        return 35.0
    if hours_left <= 72:
        return 28.0
    if hours_left <= 7 * 24:
        return 18.0
    return 10.0


def score_financial_component(valor_total_estimado: float | None) -> float:
    if valor_total_estimado is None:
        return 8.0
    if valor_total_estimado >= 2_000_000:
        return 25.0
    if valor_total_estimado >= 500_000:
        return 21.0
    if valor_total_estimado >= 100_000:
        return 16.0
    if valor_total_estimado >= 30_000:
        return 12.0
    return 8.0


def score_technical_component(
    evidence_count: int,
    has_no_technical_requirement: bool,
    analysis_completed: bool,
) -> float:
    if has_no_technical_requirement:
        return 25.0
    if evidence_count >= 3:
        return 20.0
    if evidence_count >= 1:
        return 16.0
    if analysis_completed:
        return 10.0
    return 6.0


def score_historical_component(win_rate: float | None) -> float:
    if win_rate is None:
        return 8.0
    return _clamp(win_rate * 15.0, 0.0, 15.0)
