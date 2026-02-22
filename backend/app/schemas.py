import uuid
from datetime import datetime, time
from typing import Optional

from pydantic import BaseModel, Field


# ─── Profile ──────────────────────────────────────────────────────────────────

class ProfileCreate(BaseModel):
    company_name: Optional[str] = None
    cnpj: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None


class ProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    cnpj: Optional[str] = None
    phone: Optional[str] = None
    notification_email: Optional[bool] = None
    notification_whatsapp: Optional[bool] = None
    notification_push: Optional[bool] = None
    whatsapp_number: Optional[str] = None


class ProfileResponse(BaseModel):
    id: uuid.UUID
    company_name: Optional[str]
    cnpj: Optional[str]
    phone: Optional[str]
    notification_email: bool
    notification_whatsapp: bool
    notification_push: bool
    whatsapp_number: Optional[str]

    model_config = {"from_attributes": True}


# ─── Search Automation ────────────────────────────────────────────────────────

class AutomationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    search_type: str = Field(default="publicacao", pattern="^(publicacao|proposta|atualizacao)$")

    # Search filters
    modalidade_ids: Optional[list[int]] = None
    uf: Optional[str] = Field(None, max_length=2)
    codigo_municipio_ibge: Optional[str] = None
    cnpj_orgao: Optional[str] = None
    codigo_modo_disputa: Optional[int] = None

    # Post-search filters
    keywords: Optional[list[str]] = None
    keywords_exclude: Optional[list[str]] = None
    valor_minimo: Optional[float] = None
    valor_maximo: Optional[float] = None

    # Schedule
    schedule_type: str = Field(default="interval", pattern="^(interval|daily|custom)$")
    interval_hours: int = Field(default=6, ge=1, le=24)
    daily_times: Optional[list[str]] = None  # ["08:00", "14:00"]
    active_window_start: str = "07:00"
    active_window_end: str = "22:00"
    timezone: str = "America/Sao_Paulo"


class AutomationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    is_active: Optional[bool] = None
    search_type: Optional[str] = Field(None, pattern="^(publicacao|proposta|atualizacao)$")
    modalidade_ids: Optional[list[int]] = None
    uf: Optional[str] = Field(None, max_length=2)
    codigo_municipio_ibge: Optional[str] = None
    cnpj_orgao: Optional[str] = None
    codigo_modo_disputa: Optional[int] = None
    keywords: Optional[list[str]] = None
    keywords_exclude: Optional[list[str]] = None
    valor_minimo: Optional[float] = None
    valor_maximo: Optional[float] = None
    schedule_type: Optional[str] = Field(None, pattern="^(interval|daily|custom)$")
    interval_hours: Optional[int] = Field(None, ge=1, le=24)
    daily_times: Optional[list[str]] = None
    active_window_start: Optional[str] = None
    active_window_end: Optional[str] = None


class AutomationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    is_active: bool
    search_type: str
    modalidade_ids: Optional[list[int]]
    uf: Optional[str]
    codigo_municipio_ibge: Optional[str]
    cnpj_orgao: Optional[str]
    codigo_modo_disputa: Optional[int]
    keywords: Optional[list[str]]
    keywords_exclude: Optional[list[str]]
    valor_minimo: Optional[float]
    valor_maximo: Optional[float]
    schedule_type: str
    interval_hours: int
    daily_times: Optional[list[time]]
    active_window_start: Optional[time]
    active_window_end: Optional[time]
    timezone: str
    last_run_at: Optional[datetime]
    next_run_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Search Results ───────────────────────────────────────────────────────────

class ResultActionRequest(BaseModel):
    action: str = Field(..., pattern="^(saved|discarded)$")


class ResultBatchActionRequest(BaseModel):
    result_ids: list[uuid.UUID]
    action: str = Field(..., pattern="^(saved|discarded)$")


class SearchResultResponse(BaseModel):
    id: uuid.UUID
    automation_id: uuid.UUID
    numero_controle_pncp: str
    cnpj_orgao: str
    ano_compra: int
    sequencial_compra: int
    objeto_compra: Optional[str]
    modalidade_nome: Optional[str]
    modo_disputa_nome: Optional[str]
    valor_total_estimado: Optional[float]
    data_publicacao: Optional[datetime]
    data_abertura_proposta: Optional[datetime]
    data_encerramento_proposta: Optional[datetime]
    situacao_compra_nome: Optional[str]
    orgao_nome: Optional[str]
    uf: Optional[str]
    municipio: Optional[str]
    link_sistema_origem: Optional[str]
    link_processo_eletronico: Optional[str]
    srp: Optional[bool]
    status: str
    relevance_score: Optional[float]
    relevance_reason: Optional[str]
    is_read: bool
    found_at: datetime
    acted_at: Optional[datetime]

    model_config = {"from_attributes": True}


class PaginatedResults(BaseModel):
    data: list[SearchResultResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ─── Result Items ─────────────────────────────────────────────────────────────

class ResultItemResponse(BaseModel):
    id: uuid.UUID
    numero_item: int
    descricao: Optional[str]
    material_ou_servico: Optional[str]
    material_ou_servico_nome: Optional[str]
    valor_unitario_estimado: Optional[float]
    valor_total: Optional[float]
    quantidade: Optional[float]
    unidade_medida: Optional[str]
    situacao_compra_item_nome: Optional[str]
    criterio_julgamento_nome: Optional[str]
    tipo_beneficio_nome: Optional[str]
    tem_resultado: Optional[bool]
    orcamento_sigiloso: Optional[bool]
    item_categoria_nome: Optional[str]
    informacao_complementar: Optional[str]

    model_config = {"from_attributes": True}


# ─── Result Documents ─────────────────────────────────────────────────────────

class ResultDocumentResponse(BaseModel):
    id: uuid.UUID
    sequencial_documento: Optional[int]
    titulo: Optional[str]
    tipo_documento_id: Optional[int]
    tipo_documento_nome: Optional[str]
    tipo_documento_descricao: Optional[str]
    url: Optional[str]
    uri: Optional[str]
    status_ativo: Optional[bool]
    data_publicacao_pncp: Optional[datetime]

    model_config = {"from_attributes": True}


# ─── Result Detail (Full) ────────────────────────────────────────────────────

class SearchResultDetailResponse(BaseModel):
    """Full detail response including items and documents."""
    id: uuid.UUID
    automation_id: uuid.UUID
    numero_controle_pncp: str
    cnpj_orgao: str
    ano_compra: int
    sequencial_compra: int
    objeto_compra: Optional[str]
    modalidade_nome: Optional[str]
    modo_disputa_nome: Optional[str]
    valor_total_estimado: Optional[float]
    data_publicacao: Optional[datetime]
    data_abertura_proposta: Optional[datetime]
    data_encerramento_proposta: Optional[datetime]
    situacao_compra_nome: Optional[str]
    orgao_nome: Optional[str]
    uf: Optional[str]
    municipio: Optional[str]
    link_sistema_origem: Optional[str]
    link_processo_eletronico: Optional[str]
    srp: Optional[bool]
    status: str
    relevance_score: Optional[float]
    relevance_reason: Optional[str]
    is_read: bool
    found_at: datetime
    acted_at: Optional[datetime]

    # Nested data
    items: list[ResultItemResponse]
    documents: list[ResultDocumentResponse]

    model_config = {"from_attributes": True}


# ─── Notifications ────────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: uuid.UUID
    channel: str
    title: str
    body: Optional[str]
    is_read: bool
    sent_at: datetime

    model_config = {"from_attributes": True}


# ─── Automation Runs ──────────────────────────────────────────────────────────

class AutomationRunResponse(BaseModel):
    id: uuid.UUID
    automation_id: uuid.UUID
    started_at: datetime
    finished_at: Optional[datetime]
    status: str
    results_found: int
    results_new: int
    error_message: Optional[str]
    pages_searched: int

    model_config = {"from_attributes": True}


# ─── Edital Analysis ─────────────────────────────────────────────────────────

class EditalAnalysisResponse(BaseModel):
    id: uuid.UUID
    result_id: Optional[uuid.UUID]
    document_id: Optional[uuid.UUID]
    source_type: str
    pdf_filename: Optional[str]
    pdf_size_bytes: Optional[int]
    status: str
    error_message: Optional[str]
    page_count: Optional[int]
    analysis_data: Optional[dict]
    llm_model: Optional[str]
    tokens_used: Optional[int]
    processing_time_ms: Optional[int]
    created_at: datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class EditalAnalysisListResponse(BaseModel):
    data: list[EditalAnalysisResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class AnalyzeFromPncpRequest(BaseModel):
    document_id: uuid.UUID


class AnalyzeBatchFromPncpRequest(BaseModel):
    document_ids: list[uuid.UUID]
