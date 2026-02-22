"""
EasyGov Search Engine — Core automation logic.
Executes a search automation: calls PNCP API, filters results,
scores relevance, saves to DB, and triggers notifications.
"""
import json
import logging
from datetime import datetime, timedelta, date
from typing import Any

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SearchAutomation, SearchResult, AutomationRun, Notification
from app.pncp_client import pncp_client

logger = logging.getLogger(__name__)


async def run_automation(automation: SearchAutomation, db: AsyncSession) -> AutomationRun:
    """
    Execute a single search automation cycle:
    1. Call PNCP API with the automation's filters
    2. Filter results by keywords
    3. Deduplicate against existing results
    4. Save new results to DB
    5. Create notification if new results found
    6. Log the run
    """
    run = AutomationRun(
        automation_id=automation.id,
        status="running",
    )
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

        # Apply keyword filters
        filtered = _filter_by_keywords(
            all_contracts,
            automation.keywords,
            automation.keywords_exclude,
        )

        # Apply value filters
        filtered = _filter_by_value(
            filtered,
            automation.valor_minimo,
            automation.valor_maximo,
        )

        # Save new results (deduplicate)
        new_count = 0
        for contract in filtered:
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
                srp=contract.get("srp"),
                status="pending",
            )
            db.add(result)
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
            f"Automation '{automation.name}' completed: "
            f"{run.results_found} found, {new_count} new"
        )

    except Exception as e:
        run.status = "error"
        run.error_message = str(e)[:500]
        run.finished_at = datetime.utcnow()
        await db.commit()
        logger.error(f"Automation '{automation.name}' failed: {e}")

    return run


def _filter_by_keywords(
    contracts: list[dict],
    keywords: list[str] | None,
    keywords_exclude: list[str] | None,
) -> list[dict]:
    """Filter contracts by keyword inclusion/exclusion in objetoCompra."""
    if not keywords and not keywords_exclude:
        return contracts

    filtered = []
    for c in contracts:
        text = (c.get("objetoCompra", "") or "").lower()
        complementar = (c.get("informacaoComplementar", "") or "").lower()
        full_text = f"{text} {complementar}"

        # Must contain at least one keyword (if specified)
        if keywords:
            if not any(kw.lower() in full_text for kw in keywords):
                continue

        # Must not contain any excluded keyword
        if keywords_exclude:
            if any(kw.lower() in full_text for kw in keywords_exclude):
                continue

        filtered.append(c)

    return filtered


def _filter_by_value(
    contracts: list[dict],
    valor_minimo: float | None,
    valor_maximo: float | None,
) -> list[dict]:
    """Filter contracts by estimated value range."""
    if valor_minimo is None and valor_maximo is None:
        return contracts

    filtered = []
    for c in contracts:
        valor = c.get("valorTotalEstimado")
        if valor is None:
            filtered.append(c)  # Keep items without value info
            continue
        if valor_minimo and valor < valor_minimo:
            continue
        if valor_maximo and valor > valor_maximo:
            continue
        filtered.append(c)

    return filtered


def _parse_datetime(value: str | None) -> datetime | None:
    """Parse PNCP datetime strings."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
