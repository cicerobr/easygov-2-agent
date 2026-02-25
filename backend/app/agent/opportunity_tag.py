"""Rules to classify an analysis as an 'Oportunidade'."""

from __future__ import annotations

import unicodedata
from typing import Literal
from typing import Any

OPPORTUNITY_TAG = "Oportunidade"


def apply_opportunity_tag_rule(analysis: dict[str, Any]) -> None:
    """
    Add/remove OPPORTUNITY_TAG from analysis["tags"].

    Rule:
    - Add when modalidade is Dispensa and there is explicit evidence of
      NO requirement for atestado/capacidade/qualificação técnica.
    - Remove in all other cases.
    """
    tags = _normalize_tags(analysis.get("tags"))
    is_dispensa = _is_dispensa_modality(analysis)
    technical_requirement = _classify_technical_requirement(analysis.get("habilitacao"))

    # Conservative behavior:
    # Only classify as opportunity when technical non-requirement is explicit.
    if is_dispensa and technical_requirement == "not_requires":
        if OPPORTUNITY_TAG not in tags:
            tags.append(OPPORTUNITY_TAG)
    else:
        tags = [tag for tag in tags if tag != OPPORTUNITY_TAG]

    analysis["tags"] = tags


def _normalize_tags(value: Any) -> list[str]:
    if isinstance(value, list):
        tags = [str(tag).strip() for tag in value if str(tag).strip()]
    elif isinstance(value, str) and value.strip():
        tags = [value.strip()]
    else:
        tags = []
    return list(dict.fromkeys(tags))


def _is_dispensa_modality(analysis: Any) -> bool:
    if not isinstance(analysis, dict):
        return False

    licitacao = analysis.get("licitacao")
    if not isinstance(licitacao, dict):
        return False

    modalidade = licitacao.get("modalidade")
    if not isinstance(modalidade, str):
        return False

    return "dispensa" in _norm(modalidade)


def _classify_technical_requirement(
    habilitacao: Any,
) -> Literal["requires", "not_requires", "unknown"]:
    if not isinstance(habilitacao, dict):
        return "unknown"

    values = _extract_technical_values(habilitacao.get("tecnica"))
    if not values:
        return "unknown"

    saw_explicit_non_requirement = False
    for value in values:
        text = _norm(value)
        if not text:
            continue

        has_technical_context = _has_technical_context(text)
        if not has_technical_context:
            continue

        if _is_negated_requirement(text):
            saw_explicit_non_requirement = True
            continue

        # Any technical context without explicit negation is considered required.
        return "requires"

    if saw_explicit_non_requirement:
        return "not_requires"
    return "unknown"


def _extract_technical_values(tecnica: Any) -> list[str]:
    if tecnica is None:
        return []
    if isinstance(tecnica, str):
        return [tecnica]
    if isinstance(tecnica, list):
        return [str(item) for item in tecnica]
    return [str(tecnica)]


def _has_technical_context(text: str) -> bool:
    technical_markers = (
        "qualificacao tecnica",
        "qualificacao tecnico",
        "qualificacao profissional",
        "tecnico profissional",
        "aptidao tecnica",
        "aptidao profissional",
        "atestado",
        "capacidade tecnica",
        "acervo tecnico",
        "certidao de acervo",
        "cat ",
        "crea",
        "cau",
        "crt",
        "cft",
        "registro profissional",
        "responsavel tecnico",
        "engenheiro responsavel",
        "comprovacao tecnica",
        "experiencia tecnica",
    )
    return any(marker in text for marker in technical_markers)


def _is_negated_requirement(text: str) -> bool:
    negative_markers = (
        "nao exig",
        "nao sera exig",
        "nao e exig",
        "nao sera necessario",
        "nao ha exig",
        "nao havera exig",
        "nao sera solicitado",
        "nao sera obrigatorio",
        "nao obrigatorio",
        "sem exig",
        "sem necessidade",
        "nao sera necessario",
        "dispensad",
        "inexig",
        "desnecessar",
        "facultativ",
        "opcional",
    )
    return any(marker in text for marker in negative_markers)


def _norm(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return ""
    normalized = unicodedata.normalize("NFD", raw)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
