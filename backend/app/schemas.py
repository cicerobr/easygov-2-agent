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
    search_in_items: bool = True
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
    search_in_items: Optional[bool] = None
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
    search_in_items: bool
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
    codigo_unidade_compradora: Optional[str]
    nome_unidade_compradora: Optional[str]
    srp: Optional[bool]
    keyword_match_scope: Optional[str]
    keyword_match_evidence: Optional[list[dict]]
    status: str
    relevance_score: Optional[float]
    relevance_reason: Optional[str]
    is_read: bool
    found_at: datetime
    acted_at: Optional[datetime]
    dispute_started_at: Optional[datetime]
    dispute_finished_at: Optional[datetime]
    urgency_state: Optional[str] = None
    time_to_open_seconds: Optional[int] = None
    time_to_close_seconds: Optional[int] = None

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
    codigo_unidade_compradora: Optional[str]
    nome_unidade_compradora: Optional[str]
    srp: Optional[bool]
    keyword_match_scope: Optional[str]
    keyword_match_evidence: Optional[list[dict]]
    status: str
    relevance_score: Optional[float]
    relevance_reason: Optional[str]
    is_read: bool
    found_at: datetime
    acted_at: Optional[datetime]
    dispute_started_at: Optional[datetime]
    dispute_finished_at: Optional[datetime]
    urgency_state: Optional[str] = None
    time_to_open_seconds: Optional[int] = None
    time_to_close_seconds: Optional[int] = None

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
    metadata_: Optional[dict]

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


class AutomationLearningSuggestionResponse(BaseModel):
    automation_id: uuid.UUID
    disputed_count: int
    won_count: int
    lost_count: int
    win_rate: float
    top_loss_reasons: list[str]
    suggested_actions: list[str]


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


# ─── Disputes ────────────────────────────────────────────────────────────────

class DisputeStartResponse(BaseModel):
    id: uuid.UUID
    status: str
    dispute_started_at: Optional[datetime]

    model_config = {"from_attributes": True}


class DisputeFinishRequest(BaseModel):
    action: str = Field(..., pattern="^(won|lost)$")


class DisputeFinishResponse(BaseModel):
    id: uuid.UUID
    status: str
    dispute_finished_at: Optional[datetime]

    model_config = {"from_attributes": True}


class DisputeStatsResponse(BaseModel):
    em_disputa: int
    vencidos: int
    perdidos: int
    total: int


class DisputeHighlightSummaryResponse(BaseModel):
    upcoming_24h_count: int
    open_now_count: int
    closing_24h_count: int
    next_opening_at: Optional[datetime]


class DisputeHighlightItemResponse(BaseModel):
    id: uuid.UUID
    numero_controle_pncp: str
    objeto_compra: Optional[str]
    orgao_nome: Optional[str]
    data_abertura_proposta: Optional[datetime]
    data_encerramento_proposta: Optional[datetime]
    codigo_unidade_compradora: Optional[str]
    urgency_state: Optional[str]
    time_to_open_seconds: Optional[int]
    time_to_close_seconds: Optional[int]

    model_config = {"from_attributes": True}


class DisputeHighlightsResponse(BaseModel):
    summary: DisputeHighlightSummaryResponse
    upcoming: list[DisputeHighlightItemResponse]
    open_now: list[DisputeHighlightItemResponse]
    critical: list[DisputeHighlightItemResponse]


class DisputeMarginSuggestion(BaseModel):
    margem_percentual: float
    preco_venda: float
    imposto_estimado: float
    lucro_liquido_estimado: float


class DisputeItemFinancialInput(BaseModel):
    preco_fornecedor: float = Field(..., ge=0)
    mao_obra: float = Field(..., ge=0)
    materiais_consumo: float = Field(..., ge=0)
    equipamentos: float = Field(..., ge=0)
    frete_logistica: float = Field(..., ge=0)
    aliquota_imposto_percentual: float = Field(..., ge=0, le=100)


class DisputeItemFinancialResponse(BaseModel):
    id: uuid.UUID
    result_id: uuid.UUID
    result_item_id: uuid.UUID
    preco_fornecedor: float
    mao_obra: float
    materiais_consumo: float
    equipamentos: float
    frete_logistica: float
    aliquota_imposto_percentual: float
    custos_totais: float
    precos_sugeridos: list[DisputeMarginSuggestion]
    updated_at: datetime

    model_config = {"from_attributes": True}


class DisputeItemFinancialRow(BaseModel):
    result_item_id: uuid.UUID
    numero_item: int
    descricao: Optional[str]
    quantidade: Optional[float]
    unidade_medida: Optional[str]
    financial: Optional[DisputeItemFinancialResponse]


# ─── Pipeline, Score & Evidence ──────────────────────────────────────────────

class ResultPipelineStateResponse(BaseModel):
    result_id: uuid.UUID
    pipeline_stage: str
    stage_started_at: datetime
    stage_finished_at: Optional[datetime]
    stage_error: Optional[str]
    updated_at: datetime

    model_config = {"from_attributes": True}


class ResultPipelineKpisResponse(BaseModel):
    total_results: int
    triaged_total: int
    pending_total: int
    dispute_total: int
    won_total: int
    lost_total: int
    pending_to_saved_rate: float
    saved_to_dispute_rate: float
    dispute_win_rate: float
    analysis_success_rate: float
    analysis_avg_processing_ms: float
    technical_evidence_coverage_rate: float


class PriorityScoreComponent(BaseModel):
    label: str
    score: float
    max_score: float
    reason: str


class PriorityScoreResponse(BaseModel):
    result_id: uuid.UUID
    total_score: float
    recommendation: str
    components: list[PriorityScoreComponent]


class AnalysisTechnicalEvidenceResponse(BaseModel):
    id: uuid.UUID
    analysis_id: uuid.UUID
    result_id: Optional[uuid.UUID]
    clause_ref: Optional[str]
    source_text: str
    confidence: float
    is_human_validated: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ValidateTechnicalEvidenceRequest(BaseModel):
    is_human_validated: bool = True


# ─── Dispute Timeline & Feedback ─────────────────────────────────────────────

class DisputeTimelineEventResponse(BaseModel):
    event_type: str
    actor_type: str
    created_at: datetime
    payload: Optional[dict]


class DisputeFeedbackRequest(BaseModel):
    loss_reason: Optional[str] = None
    winner_price_delta: Optional[float] = None
    suggested_filter_adjustments: Optional[dict] = None


class DisputeFeedbackResponse(BaseModel):
    id: uuid.UUID
    result_id: uuid.UUID
    loss_reason: Optional[str]
    winner_price_delta: Optional[float]
    suggested_filter_adjustments: Optional[dict]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
