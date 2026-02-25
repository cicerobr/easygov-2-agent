"""
EasyGov Search Engine — Core automation logic.
Executes a search automation: calls PNCP API, filters results,
scores relevance, saves to DB, and triggers notifications.
"""
import asyncio
import logging
import unicodedata
from datetime import datetime, timedelta, date
from typing import Any

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import SearchAutomation, SearchResult, AutomationRun, Notification
from app.pncp_client import pncp_client
from app.services.pipeline_state import set_pipeline_stage

logger = logging.getLogger(__name__)
settings = get_settings()

MAX_EVIDENCES_PER_RESULT = 5
MAX_SNIPPET_LENGTH = 180


def _extract_buying_unit_info(contract: dict[str, Any]) -> tuple[str | None, str | None]:
    unidade = contract.get("unidadeOrgao", {}) or {}
    codigo_unidade_compradora = (
        contract.get("codigoUnidadeCompradora")
        or unidade.get("codigoUnidade")
        or contract.get("codigoUnidadeOrgao")
    )
    nome_unidade_compradora = unidade.get("nomeUnidade")
    return codigo_unidade_compradora, nome_unidade_compradora


async def run_automation(
    automation: SearchAutomation,
    db: AsyncSession,
    run: AutomationRun | None = None,
) -> AutomationRun:
    """
    Execute a single search automation cycle:
    1. Call PNCP API with the automation's filters
    2. Filter results by keywords
    3. Deduplicate against existing results
    4. Save new results to DB
    5. Create notification if new results found
    6. Log the run
    """
    if run is None:
        run = AutomationRun(
            automation_id=automation.id,
            status="running",
        )
        db.add(run)
        await db.flush()
    else:
        run.status = "running"
        run.error_message = None
        run.finished_at = None
        run.results_found = 0
        run.results_new = 0
        run.pages_searched = 0
        db.add(run)
        await db.flush()

    try:
        # Determine date range
        today = date.today()
        data_final = today.strftime("%Y%m%d")

        if automation.search_type == "proposta":
            # For open proposals, look 90 days ahead
            data_final = (today + timedelta(days=90)).strftime("%Y%m%d")

        if automation.search_type in ("publicacao", "atualizacao"):
            # Look back from last run or default 7 days
            if automation.last_run_at:
                data_inicial = automation.last_run_at.strftime("%Y%m%d")
            else:
                data_inicial = (today - timedelta(days=7)).strftime("%Y%m%d")

        # Collect all results across pages and modalidades
        all_contracts = []
        modalidades = automation.modalidade_ids or [8]  # Default to Dispensa

        for modalidade in modalidades:
            page = 1
            while True:
                try:
                    if automation.search_type == "publicacao":
                        response = await pncp_client.buscar_contratacoes_publicacao(
                            data_inicial=data_inicial,
                            data_final=data_final,
                            codigo_modalidade=modalidade,
                            pagina=page,
                            uf=automation.uf,
                            codigo_municipio_ibge=automation.codigo_municipio_ibge,
                            cnpj=automation.cnpj_orgao,
                            codigo_modo_disputa=automation.codigo_modo_disputa,
                        )
                    elif automation.search_type == "proposta":
                        response = await pncp_client.buscar_contratacoes_proposta(
                            data_final=data_final,
                            pagina=page,
                            codigo_modalidade=modalidade,
                            uf=automation.uf,
                            codigo_municipio_ibge=automation.codigo_municipio_ibge,
                            cnpj=automation.cnpj_orgao,
                        )
                    elif automation.search_type == "atualizacao":
                        response = await pncp_client.buscar_contratacoes_atualizacao(
                            data_inicial=data_inicial,
                            data_final=data_final,
                            codigo_modalidade=modalidade,
                            pagina=page,
                            uf=automation.uf,
                            codigo_municipio_ibge=automation.codigo_municipio_ibge,
                            cnpj=automation.cnpj_orgao,
                            codigo_modo_disputa=automation.codigo_modo_disputa,
                        )
                    else:
                        break

                    run.pages_searched += 1
                    data = response.get("data", [])
                    if not data:
                        break

                    all_contracts.extend(data)

                    # Check if there are more pages
                    remaining = response.get("paginasRestantes", 0)
                    if remaining <= 0:
                        break
                    page += 1

                except Exception as e:
                    logger.warning(f"PNCP API error on page {page}: {e}")
                    break

        run.results_found = len(all_contracts)

        # Apply hybrid keyword filters (object OR item)
        filtered, keyword_metrics = await _filter_by_keywords_hybrid(
            all_contracts,
            automation,
        )

        # Apply value filters
        filtered = _filter_matched_contracts_by_value(
            filtered,
            automation.valor_minimo,
            automation.valor_maximo,
        )

        # Save new results (deduplicate)
        new_count = 0
        for matched in filtered:
            contract = matched["contract"]
            numero_pncp = contract.get("numeroControlePNCP", "")
            if not numero_pncp:
                continue

            # Check if already exists
            existing = await db.execute(
                select(SearchResult).where(
                    and_(
                        SearchResult.user_id == automation.user_id,
                        SearchResult.numero_controle_pncp == numero_pncp,
                    )
                )
            )
            if existing.scalar_one_or_none():
                continue

            # Parse org info
            orgao = contract.get("orgaoEntidade", {}) or {}
            unidade = contract.get("unidadeOrgao", {}) or {}
            codigo_unidade_compradora, nome_unidade_compradora = _extract_buying_unit_info(contract)

            result = SearchResult(
                automation_id=automation.id,
                user_id=automation.user_id,
                numero_controle_pncp=numero_pncp,
                cnpj_orgao=orgao.get("cnpj", ""),
                ano_compra=contract.get("anoCompra", 0),
                sequencial_compra=contract.get("sequencialCompra", 0),
                objeto_compra=contract.get("objetoCompra"),
                modalidade_nome=contract.get("modalidadeNome"),
                modo_disputa_nome=contract.get("modoDisputaNome"),
                valor_total_estimado=contract.get("valorTotalEstimado"),
                data_publicacao=_parse_datetime(contract.get("dataPublicacaoPncp")),
                data_abertura_proposta=_parse_datetime(contract.get("dataAberturaProposta")),
                data_encerramento_proposta=_parse_datetime(contract.get("dataEncerramentoProposta")),
                situacao_compra_nome=contract.get("situacaoCompraNome"),
                orgao_nome=orgao.get("razaoSocial"),
                uf=unidade.get("ufSigla"),
                municipio=unidade.get("municipioNome"),
                link_sistema_origem=contract.get("linkSistemaOrigem"),
                link_processo_eletronico=contract.get("linkProcessoEletronico"),
                codigo_unidade_compradora=codigo_unidade_compradora,
                nome_unidade_compradora=nome_unidade_compradora,
                srp=contract.get("srp"),
                keyword_match_scope=matched.get("keyword_match_scope"),
                keyword_match_evidence=matched.get("keyword_match_evidence"),
                status="pending",
            )
            db.add(result)
            # Ensure PK is assigned before creating pipeline state rows.
            await db.flush()
            await set_pipeline_stage(
                db,
                result_id=result.id,
                user_id=automation.user_id,
                stage="captured",
                finished=False,
            )
            new_count += 1

        run.results_new = new_count

        # Create notification if new results found
        if new_count > 0:
            notification = Notification(
                user_id=automation.user_id,
                automation_id=automation.id,
                channel="in_app",
                title=f"🔔 {new_count} novo(s) edital(is) encontrado(s)",
                body=f'A automação "{automation.name}" encontrou {new_count} novo(s) edital(is).',
                metadata_={
                    "automation_name": automation.name,
                    "results_new": new_count,
                    "results_total": run.results_found,
                },
            )
            db.add(notification)

        # Update automation timestamps
        automation.last_run_at = datetime.utcnow()
        if automation.schedule_type == "interval":
            automation.next_run_at = datetime.utcnow() + timedelta(hours=automation.interval_hours)

        # Finalize run
        run.status = "success"
        run.finished_at = datetime.utcnow()
        automation.updated_at = datetime.utcnow()

        await db.commit()
        logger.info(
            "Automation '%s' hybrid keyword metrics: %s",
            automation.name,
            keyword_metrics,
        )
        logger.info(
            f"Automation '{automation.name}' completed: "
            f"{run.results_found} found, {new_count} new"
        )

    except Exception as e:
        logger.error(f"Automation '{automation.name}' failed: {e}")
        try:
            await db.rollback()
        except Exception as rollback_exc:
            logger.error("Rollback failed for automation '%s': %s", automation.name, rollback_exc)

        # Persist failure status in a fresh transaction.
        try:
            persisted_run = await db.get(AutomationRun, run.id)
            if persisted_run is None:
                persisted_run = run
                db.add(persisted_run)
            persisted_run.status = "error"
            persisted_run.error_message = str(e)[:500]
            persisted_run.finished_at = datetime.utcnow()
            await db.commit()
            run = persisted_run
        except Exception as persist_exc:
            logger.error(
                "Failed to persist error status for automation '%s': %s",
                automation.name,
                persist_exc,
            )

    return run


def _normalized_keywords(values: list[str] | None) -> list[str]:
    return [value.strip() for value in (values or []) if value and value.strip()]


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFD", value)
    without_accents = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return " ".join(without_accents.lower().split())


def _phrase_in_text(normalized_text: str, normalized_keyword: str) -> bool:
    if not normalized_text or not normalized_keyword:
        return False
    text_tokens = normalized_text.split()
    keyword_tokens = normalized_keyword.split()
    if not text_tokens or not keyword_tokens or len(keyword_tokens) > len(text_tokens):
        return False
    size = len(keyword_tokens)
    return any(text_tokens[i:i + size] == keyword_tokens for i in range(len(text_tokens) - size + 1))


def _truncate_text(value: str, limit: int = MAX_SNIPPET_LENGTH) -> str:
    stripped = " ".join(value.split())
    if len(stripped) <= limit:
        return stripped
    return f"{stripped[:limit - 3].rstrip()}..."


def _build_snippet(value: str, keyword: str) -> str:
    compact = " ".join((value or "").split())
    if not compact:
        return ""

    keyword_lower = keyword.lower().strip()
    index = compact.lower().find(keyword_lower) if keyword_lower else -1
    if index < 0:
        return _truncate_text(compact)

    start = max(0, index - 60)
    end = min(len(compact), index + len(keyword) + 80)
    snippet = compact[start:end].strip()
    if start > 0:
        snippet = f"...{snippet}"
    if end < len(compact):
        snippet = f"{snippet}..."
    return _truncate_text(snippet)


def _extract_item_number(item: dict[str, Any]) -> int | None:
    value = item.get("numeroItem")
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _match_keywords_in_fields(
    fields: list[tuple[str, str]],
    keywords: list[str],
    scope: str,
    item_numero: int | None = None,
    evidence_limit: int = MAX_EVIDENCES_PER_RESULT,
) -> tuple[set[str], list[dict[str, Any]]]:
    if not keywords:
        return set(), []

    normalized_fields: list[tuple[str, str, str]] = []
    for field_name, raw_value in fields:
        raw_text = (raw_value or "").strip()
        if not raw_text:
            continue
        normalized_fields.append((field_name, raw_text, _normalize_text(raw_text)))

    matched_keywords: set[str] = set()
    evidences: list[dict[str, Any]] = []

    for keyword in keywords:
        normalized_keyword = _normalize_text(keyword)
        if not normalized_keyword:
            continue
        for field_name, raw_text, normalized_text in normalized_fields:
            if not _phrase_in_text(normalized_text, normalized_keyword):
                continue
            matched_keywords.add(keyword)
            if len(evidences) < evidence_limit:
                evidence = {
                    "scope": scope,
                    "keyword": keyword,
                    "snippet": _build_snippet(raw_text, keyword),
                    "field": field_name,
                }
                if item_numero is not None:
                    evidence["item_numero"] = item_numero
                evidences.append(evidence)
            break

    return matched_keywords, evidences


def _object_fields(contract: dict[str, Any]) -> list[tuple[str, str]]:
    return [
        ("objetoCompra", contract.get("objetoCompra") or ""),
        ("informacaoComplementar", contract.get("informacaoComplementar") or ""),
    ]


def _item_fields(item: dict[str, Any]) -> list[tuple[str, str]]:
    return [
        ("descricao", item.get("descricao") or ""),
        ("informacaoComplementar", item.get("informacaoComplementar") or ""),
        ("itemCategoriaNome", item.get("itemCategoriaNome") or ""),
    ]


async def _fetch_all_items_for_contract(
    contract: dict[str, Any],
    timeout_sec: int,
) -> list[dict[str, Any]]:
    orgao = contract.get("orgaoEntidade", {}) or {}
    cnpj = contract.get("cnpjOrgaoEntidade") or orgao.get("cnpj")
    ano = contract.get("anoCompra")
    sequencial = contract.get("sequencialCompra")
    if not cnpj or ano is None or sequencial is None:
        return []

    items: list[dict[str, Any]] = []
    page = 1

    while True:
        response = await asyncio.wait_for(
            pncp_client.listar_itens_contratacao(
                cnpj=str(cnpj),
                ano=int(ano),
                sequencial=int(sequencial),
                pagina=page,
                tamanho_pagina=50,
            ),
            timeout=float(timeout_sec),
        )

        if isinstance(response, list):
            items.extend([item for item in response if isinstance(item, dict)])
            break

        page_items = response.get("data", [])
        if isinstance(page_items, list):
            items.extend([item for item in page_items if isinstance(item, dict)])
        else:
            page_items = []

        pages_remaining = response.get("paginasRestantes")
        total_pages = response.get("totalPaginas")
        if pages_remaining is not None:
            try:
                if int(pages_remaining) <= 0:
                    break
            except (TypeError, ValueError):
                if not page_items:
                    break
        elif total_pages is not None:
            try:
                if page >= int(total_pages):
                    break
            except (TypeError, ValueError):
                if not page_items:
                    break
        elif not page_items:
            break

        page += 1

    return items


async def _match_items_for_contract(
    contract: dict[str, Any],
    include_keywords: list[str],
    exclude_keywords: list[str],
    timeout_sec: int,
) -> dict[str, Any]:
    items = await _fetch_all_items_for_contract(contract, timeout_sec=timeout_sec)
    include_matches: set[str] = set()
    exclude_matches: set[str] = set()
    evidences: list[dict[str, Any]] = []

    for item in items:
        item_numero = _extract_item_number(item)
        fields = _item_fields(item)

        item_include, include_evidence = _match_keywords_in_fields(
            fields=fields,
            keywords=include_keywords,
            scope="item",
            item_numero=item_numero,
            evidence_limit=MAX_EVIDENCES_PER_RESULT,
        )
        include_matches.update(item_include)
        for evidence in include_evidence:
            if len(evidences) >= MAX_EVIDENCES_PER_RESULT:
                break
            evidences.append(evidence)

        item_exclude, _ = _match_keywords_in_fields(
            fields=fields,
            keywords=exclude_keywords,
            scope="item",
            item_numero=item_numero,
            evidence_limit=0,
        )
        exclude_matches.update(item_exclude)

        if len(evidences) >= MAX_EVIDENCES_PER_RESULT and not exclude_keywords:
            break

    return {
        "include_matches": include_matches,
        "exclude_matches": exclude_matches,
        "evidence": evidences,
    }


def _derive_scope(object_match: bool, item_match: bool) -> str | None:
    if object_match and item_match:
        return "both"
    if object_match:
        return "object"
    if item_match:
        return "item"
    return None


async def _filter_by_keywords_hybrid(
    contracts: list[dict[str, Any]],
    automation: SearchAutomation,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    include_keywords = _normalized_keywords(automation.keywords)
    exclude_keywords = _normalized_keywords(automation.keywords_exclude)
    include_required = bool(include_keywords)

    if not include_keywords and not exclude_keywords:
        passthrough = [
            {
                "contract": contract,
                "keyword_match_scope": None,
                "keyword_match_evidence": None,
            }
            for contract in contracts
        ]
        return passthrough, {
            "item_checks_attempted": 0,
            "item_checks_succeeded": 0,
            "item_checks_failed": 0,
            "results_matched_by_item": 0,
            "item_checks_skipped_by_limit": 0,
        }

    evaluations: list[dict[str, Any]] = []
    for contract in contracts:
        object_include_matches, object_evidence = _match_keywords_in_fields(
            fields=_object_fields(contract),
            keywords=include_keywords,
            scope="object",
            evidence_limit=MAX_EVIDENCES_PER_RESULT,
        )
        object_exclude_matches, _ = _match_keywords_in_fields(
            fields=_object_fields(contract),
            keywords=exclude_keywords,
            scope="object",
            evidence_limit=0,
        )
        evaluations.append(
            {
                "contract": contract,
                "object_include_matches": object_include_matches,
                "object_exclude_matches": object_exclude_matches,
                "object_evidence": object_evidence,
                "item_include_matches": set(),
                "item_exclude_matches": set(),
                "item_evidence": [],
                "item_checked": False,
                "item_error": False,
            }
        )

    include_candidates: list[int] = []
    exclude_candidates: list[int] = []
    if automation.search_in_items:
        for idx, evaluation in enumerate(evaluations):
            object_has_include = bool(evaluation["object_include_matches"])
            if include_required and not object_has_include:
                include_candidates.append(idx)
                continue
            if exclude_keywords and (object_has_include or not include_required):
                exclude_candidates.append(idx)

    ordered_candidates = include_candidates + [idx for idx in exclude_candidates if idx not in include_candidates]
    limited_candidates = ordered_candidates[: settings.item_check_limit_per_run]
    skipped_candidates = max(0, len(ordered_candidates) - len(limited_candidates))

    metrics = {
        "item_checks_attempted": len(limited_candidates),
        "item_checks_succeeded": 0,
        "item_checks_failed": 0,
        "results_matched_by_item": 0,
        "item_checks_skipped_by_limit": skipped_candidates,
    }

    if limited_candidates:
        semaphore = asyncio.Semaphore(max(1, settings.item_fetch_concurrency))

        async def evaluate_candidate(candidate_idx: int) -> tuple[int, dict[str, Any] | None, Exception | None]:
            async with semaphore:
                try:
                    item_match = await _match_items_for_contract(
                        evaluations[candidate_idx]["contract"],
                        include_keywords=include_keywords,
                        exclude_keywords=exclude_keywords,
                        timeout_sec=settings.item_fetch_timeout_sec,
                    )
                    return candidate_idx, item_match, None
                except Exception as exc:
                    return candidate_idx, None, exc

        results = await asyncio.gather(*(evaluate_candidate(idx) for idx in limited_candidates))
        for idx, item_match, error in results:
            evaluation = evaluations[idx]
            evaluation["item_checked"] = True
            if error is not None:
                evaluation["item_error"] = True
                metrics["item_checks_failed"] += 1
                logger.warning(
                    "Item fetch failed for contrato=%s: %s",
                    evaluation["contract"].get("numeroControlePNCP"),
                    error,
                )
                continue

            metrics["item_checks_succeeded"] += 1
            evaluation["item_include_matches"] = item_match["include_matches"]
            evaluation["item_exclude_matches"] = item_match["exclude_matches"]
            evaluation["item_evidence"] = item_match["evidence"][:MAX_EVIDENCES_PER_RESULT]
            if evaluation["item_include_matches"] and not evaluation["object_include_matches"]:
                metrics["results_matched_by_item"] += 1

    filtered: list[dict[str, Any]] = []
    for idx, evaluation in enumerate(evaluations):
        object_include = bool(evaluation["object_include_matches"])
        item_include = bool(evaluation["item_include_matches"])
        include_match = (object_include or item_include) if include_required else True

        if include_required and not include_match:
            continue

        if include_required and not object_include:
            # Needed item match but was not checked (limit) or failed; retry naturally on next run.
            if idx in include_candidates and (
                not evaluation["item_checked"] or evaluation["item_error"]
            ):
                continue

        object_excluded = bool(evaluation["object_exclude_matches"])
        item_excluded = bool(evaluation["item_exclude_matches"])
        if object_excluded or item_excluded:
            continue

        scope = _derive_scope(object_include, item_include) if include_required else None
        evidence: list[dict[str, Any]] = []
        if scope:
            evidence.extend(evaluation["object_evidence"])
            for item_evidence in evaluation["item_evidence"]:
                if len(evidence) >= MAX_EVIDENCES_PER_RESULT:
                    break
                evidence.append(item_evidence)

        filtered.append(
            {
                "contract": evaluation["contract"],
                "keyword_match_scope": scope,
                "keyword_match_evidence": evidence or None,
            }
        )

    return filtered, metrics


def _filter_matched_contracts_by_value(
    matched_contracts: list[dict[str, Any]],
    valor_minimo: float | None,
    valor_maximo: float | None,
) -> list[dict[str, Any]]:
    """Filter contracts by estimated value range."""
    if valor_minimo is None and valor_maximo is None:
        return matched_contracts

    filtered: list[dict[str, Any]] = []
    for matched in matched_contracts:
        c = matched["contract"]
        valor = c.get("valorTotalEstimado")
        if valor is None:
            filtered.append(matched)  # Keep items without value info
            continue
        if valor_minimo is not None and valor < valor_minimo:
            continue
        if valor_maximo is not None and valor > valor_maximo:
            continue
        filtered.append(matched)

    return filtered


def _parse_datetime(value: str | None) -> datetime | None:
    """Parse PNCP datetime strings."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
