from __future__ import annotations

import re
from typing import Any


def _to_text_entries(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _guess_clause_ref(text: str) -> str | None:
    patterns = [
        r"\b(?:item|subitem|cl[aá]usula|anexo|se[cç][aã]o|cap[ií]tulo)\s+[\d\.\-A-Za-z]+\b",
        r"^\s*\d+(?:\.\d+)+",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
        if match:
            return match.group(0).strip()
    return None


def extract_technical_evidences(analysis_data: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not isinstance(analysis_data, dict):
        return []

    habilitacao = analysis_data.get("habilitacao")
    if not isinstance(habilitacao, dict):
        return []

    evidences: list[dict[str, Any]] = []
    integral_entries = _to_text_entries(habilitacao.get("tecnica_texto_integral"))
    for entry in integral_entries:
        evidences.append(
            {
                "clause_ref": _guess_clause_ref(entry),
                "source_text": entry,
                "confidence": 0.92,
            }
        )

    if not evidences:
        tecnica_entries = _to_text_entries(habilitacao.get("tecnica"))
        for entry in tecnica_entries:
            evidences.append(
                {
                    "clause_ref": _guess_clause_ref(entry),
                    "source_text": entry,
                    "confidence": 0.78,
                }
            )

    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for evidence in evidences:
        key = evidence["source_text"].strip().lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(evidence)
    return deduped
