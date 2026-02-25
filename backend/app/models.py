import uuid
from datetime import datetime, time
from typing import Optional

from sqlalchemy import (
    String, Boolean, Integer, Numeric, Text, DateTime, Time,
    ForeignKey, UniqueConstraint, CheckConstraint, ARRAY, JSON,
    Float, Index,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


# ─── Auth (NextAuth.js compatible) ────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String)
    image: Mapped[Optional[str]] = mapped_column(String)
    email_verified: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profile: Mapped[Optional["Profile"]] = relationship(back_populates="user", uselist=False)
    accounts: Mapped[list["Account"]] = relationship(back_populates="user")
    sessions: Mapped[list["Session"]] = relationship(back_populates="user")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    provider: Mapped[str] = mapped_column(String, nullable=False)
    provider_account_id: Mapped[str] = mapped_column(String, nullable=False)
    refresh_token: Mapped[Optional[str]] = mapped_column(String)
    access_token: Mapped[Optional[str]] = mapped_column(String)
    expires_at: Mapped[Optional[int]] = mapped_column(Integer)
    token_type: Mapped[Optional[str]] = mapped_column(String)
    scope: Mapped[Optional[str]] = mapped_column(String)
    id_token: Mapped[Optional[str]] = mapped_column(String)
    session_state: Mapped[Optional[str]] = mapped_column(String)

    user: Mapped["User"] = relationship(back_populates="accounts")

    __table_args__ = (
        UniqueConstraint("provider", "provider_account_id"),
    )


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_token: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped["User"] = relationship(back_populates="sessions")


# ─── Profile ──────────────────────────────────────────────────────────────────

class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    company_name: Mapped[Optional[str]] = mapped_column(String)
    cnpj: Mapped[Optional[str]] = mapped_column(String)
    phone: Mapped[Optional[str]] = mapped_column(String)
    notification_email: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_whatsapp: Mapped[bool] = mapped_column(Boolean, default=False)
    notification_push: Mapped[bool] = mapped_column(Boolean, default=True)
    whatsapp_number: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="profile")
    automations: Mapped[list["SearchAutomation"]] = relationship(back_populates="profile")


# ─── Business Models ─────────────────────────────────────────────────────────

class SearchAutomation(Base):
    __tablename__ = "search_automations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Search filters
    search_type: Mapped[str] = mapped_column(String, nullable=False, default="publicacao")
    modalidade_ids: Mapped[Optional[list[int]]] = mapped_column(ARRAY(Integer))
    uf: Mapped[Optional[str]] = mapped_column(String)
    codigo_municipio_ibge: Mapped[Optional[str]] = mapped_column(String)
    cnpj_orgao: Mapped[Optional[str]] = mapped_column(String)
    codigo_modo_disputa: Mapped[Optional[int]] = mapped_column(Integer)

    # Post-search filters
    keywords: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String))
    keywords_exclude: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String))
    search_in_items: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    valor_minimo: Mapped[Optional[float]] = mapped_column(Numeric)
    valor_maximo: Mapped[Optional[float]] = mapped_column(Numeric)

    # Schedule
    schedule_type: Mapped[str] = mapped_column(String, default="interval")
    interval_hours: Mapped[int] = mapped_column(Integer, default=6)
    daily_times: Mapped[Optional[list[time]]] = mapped_column(ARRAY(Time))
    active_window_start: Mapped[time] = mapped_column(Time, default=time(7, 0))
    active_window_end: Mapped[time] = mapped_column(Time, default=time(22, 0))
    timezone: Mapped[str] = mapped_column(String, default="America/Sao_Paulo")

    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    next_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    profile: Mapped["Profile"] = relationship(back_populates="automations")
    results: Mapped[list["SearchResult"]] = relationship(
        back_populates="automation", cascade="all, delete-orphan"
    )
    runs: Mapped[list["AutomationRun"]] = relationship(
        back_populates="automation", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("search_type IN ('publicacao', 'proposta', 'atualizacao')"),
        CheckConstraint("schedule_type IN ('interval', 'daily', 'custom')"),
    )


class SearchResult(Base):
    __tablename__ = "search_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    automation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("search_automations.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)

    # PNCP data snapshot
    numero_controle_pncp: Mapped[str] = mapped_column(String, nullable=False)
    cnpj_orgao: Mapped[str] = mapped_column(String, nullable=False)
    ano_compra: Mapped[int] = mapped_column(Integer, nullable=False)
    sequencial_compra: Mapped[int] = mapped_column(Integer, nullable=False)
    objeto_compra: Mapped[Optional[str]] = mapped_column(Text)
    modalidade_nome: Mapped[Optional[str]] = mapped_column(String)
    modo_disputa_nome: Mapped[Optional[str]] = mapped_column(String)
    valor_total_estimado: Mapped[Optional[float]] = mapped_column(Numeric)
    data_publicacao: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    data_abertura_proposta: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    data_encerramento_proposta: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    situacao_compra_nome: Mapped[Optional[str]] = mapped_column(String)
    orgao_nome: Mapped[Optional[str]] = mapped_column(String)
    uf: Mapped[Optional[str]] = mapped_column(String)
    municipio: Mapped[Optional[str]] = mapped_column(String)
    link_sistema_origem: Mapped[Optional[str]] = mapped_column(String)
    link_processo_eletronico: Mapped[Optional[str]] = mapped_column(String)
    codigo_unidade_compradora: Mapped[Optional[str]] = mapped_column(String)
    nome_unidade_compradora: Mapped[Optional[str]] = mapped_column(String)
    srp: Mapped[Optional[bool]] = mapped_column(Boolean)
    keyword_match_scope: Mapped[Optional[str]] = mapped_column(String(16))
    keyword_match_evidence: Mapped[Optional[list[dict]]] = mapped_column(
        "keyword_match_evidence_json", JSONB
    )

    # Result state
    status: Mapped[str] = mapped_column(String, default="pending")
    relevance_score: Mapped[Optional[float]] = mapped_column(Float)
    relevance_reason: Mapped[Optional[str]] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)

    # Cache flags
    items_fetched: Mapped[bool] = mapped_column(Boolean, default=False)
    documents_fetched: Mapped[bool] = mapped_column(Boolean, default=False)

    found_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    acted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    dispute_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    dispute_finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    automation: Mapped["SearchAutomation"] = relationship(back_populates="results")
    documents: Mapped[list["ResultDocument"]] = relationship(back_populates="result", cascade="all, delete-orphan")
    items: Mapped[list["ResultItem"]] = relationship(back_populates="result", cascade="all, delete-orphan")
    financial_items: Mapped[list["DisputeItemFinancial"]] = relationship(
        back_populates="result", cascade="all, delete-orphan"
    )
    pipeline_state: Mapped[Optional["ResultPipelineState"]] = relationship(
        back_populates="result", uselist=False, cascade="all, delete-orphan"
    )
    dispute_events: Mapped[list["DisputeEvent"]] = relationship(
        back_populates="result", cascade="all, delete-orphan"
    )
    dispute_feedback: Mapped[Optional["DisputeFeedback"]] = relationship(
        back_populates="result", uselist=False, cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_search_results_user_found_at", "user_id", "found_at"),
        Index("idx_search_results_user_status_found_at", "user_id", "status", "found_at"),
        Index("idx_search_results_user_is_read", "user_id", "is_read"),
        Index("idx_search_results_user_scope_found_at", "user_id", "keyword_match_scope", "found_at"),
        UniqueConstraint("user_id", "numero_controle_pncp"),
        CheckConstraint(
            "status IN ('pending', 'saved', 'discarded', 'dispute_open', 'dispute_won', 'dispute_lost')"
        ),
        CheckConstraint(
            "(keyword_match_scope IS NULL) OR (keyword_match_scope IN ('object', 'item', 'both'))"
        ),
    )


class ResultDocument(Base):
    __tablename__ = "result_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    result_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("search_results.id", ondelete="CASCADE"), nullable=False)

    sequencial_documento: Mapped[Optional[int]] = mapped_column(Integer)
    titulo: Mapped[Optional[str]] = mapped_column(String)
    tipo_documento_id: Mapped[Optional[int]] = mapped_column(Integer)
    tipo_documento_nome: Mapped[Optional[str]] = mapped_column(String)
    tipo_documento_descricao: Mapped[Optional[str]] = mapped_column(String)
    url: Mapped[Optional[str]] = mapped_column(String)
    uri: Mapped[Optional[str]] = mapped_column(String)
    status_ativo: Mapped[Optional[bool]] = mapped_column(Boolean, default=True)
    data_publicacao_pncp: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Legacy fields
    tipo_documento: Mapped[Optional[str]] = mapped_column(String)
    storage_path: Mapped[Optional[str]] = mapped_column(String)
    url_original: Mapped[Optional[str]] = mapped_column(String)
    downloaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    result: Mapped["SearchResult"] = relationship(back_populates="documents")

    __table_args__ = (
        Index("idx_result_documents_result_id", "result_id"),
    )


class ResultItem(Base):
    __tablename__ = "result_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    result_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("search_results.id", ondelete="CASCADE"), nullable=False)

    numero_item: Mapped[int] = mapped_column(Integer, nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text)
    material_ou_servico: Mapped[Optional[str]] = mapped_column(String)  # M or S
    material_ou_servico_nome: Mapped[Optional[str]] = mapped_column(String)
    valor_unitario_estimado: Mapped[Optional[float]] = mapped_column(Numeric)
    valor_total: Mapped[Optional[float]] = mapped_column(Numeric)
    quantidade: Mapped[Optional[float]] = mapped_column(Numeric)
    unidade_medida: Mapped[Optional[str]] = mapped_column(String)
    situacao_compra_item_nome: Mapped[Optional[str]] = mapped_column(String)
    criterio_julgamento_nome: Mapped[Optional[str]] = mapped_column(String)
    tipo_beneficio_nome: Mapped[Optional[str]] = mapped_column(String)
    tem_resultado: Mapped[Optional[bool]] = mapped_column(Boolean)
    orcamento_sigiloso: Mapped[Optional[bool]] = mapped_column(Boolean)
    item_categoria_nome: Mapped[Optional[str]] = mapped_column(String)
    informacao_complementar: Mapped[Optional[str]] = mapped_column(Text)

    result: Mapped["SearchResult"] = relationship(back_populates="items")
    dispute_financial: Mapped[Optional["DisputeItemFinancial"]] = relationship(
        back_populates="result_item", uselist=False, cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_result_items_result_id", "result_id"),
    )


class DisputeItemFinancial(Base):
    __tablename__ = "dispute_item_financials"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    result_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("search_results.id", ondelete="CASCADE"), nullable=False)
    result_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("result_items.id", ondelete="CASCADE"), nullable=False)

    preco_fornecedor: Mapped[float] = mapped_column(Numeric, nullable=False, default=0)
    mao_obra: Mapped[float] = mapped_column(Numeric, nullable=False, default=0)
    materiais_consumo: Mapped[float] = mapped_column(Numeric, nullable=False, default=0)
    equipamentos: Mapped[float] = mapped_column(Numeric, nullable=False, default=0)
    frete_logistica: Mapped[float] = mapped_column(Numeric, nullable=False, default=0)
    aliquota_imposto_percentual: Mapped[float] = mapped_column(Numeric, nullable=False, default=0)

    custos_totais: Mapped[float] = mapped_column(Numeric, nullable=False, default=0)
    precos_sugeridos_json: Mapped[Optional[dict]] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    result: Mapped["SearchResult"] = relationship(back_populates="financial_items")
    result_item: Mapped["ResultItem"] = relationship(back_populates="dispute_financial")

    __table_args__ = (
        UniqueConstraint("result_item_id"),
        Index("idx_dispute_item_financials_result_id", "result_id"),
        Index("idx_dispute_item_financials_user_id", "user_id"),
    )


class ResultPipelineState(Base):
    __tablename__ = "result_pipeline_states"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    result_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("search_results.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    pipeline_stage: Mapped[str] = mapped_column(String, nullable=False, default="captured")
    stage_started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    stage_finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    stage_error: Mapped[Optional[str]] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    result: Mapped["SearchResult"] = relationship(back_populates="pipeline_state")

    __table_args__ = (
        UniqueConstraint("result_id"),
        Index("idx_result_pipeline_states_user_stage", "user_id", "pipeline_stage"),
        CheckConstraint(
            "pipeline_stage IN ('captured', 'triaged_saved', 'triaged_discarded', "
            "'analysis_processing', 'analysis_completed', 'analysis_error', "
            "'dispute_open', 'dispute_won', 'dispute_lost')"
        ),
    )


class DisputeEvent(Base):
    __tablename__ = "dispute_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    result_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("search_results.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    actor_type: Mapped[str] = mapped_column(String, nullable=False, default="human")
    payload: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    result: Mapped["SearchResult"] = relationship(back_populates="dispute_events")

    __table_args__ = (
        Index("idx_dispute_events_result_created", "result_id", "created_at"),
        CheckConstraint(
            "event_type IN ('dispute_started', 'financial_saved', 'dispute_won', 'dispute_lost', 'feedback_submitted')"
        ),
        CheckConstraint("actor_type IN ('human', 'system')"),
    )


class DisputeFeedback(Base):
    __tablename__ = "dispute_feedbacks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    result_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("search_results.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    loss_reason: Mapped[Optional[str]] = mapped_column(Text)
    winner_price_delta: Mapped[Optional[float]] = mapped_column(Numeric)
    suggested_filter_adjustments: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    result: Mapped["SearchResult"] = relationship(back_populates="dispute_feedback")

    __table_args__ = (
        UniqueConstraint("result_id"),
        Index("idx_dispute_feedbacks_user_id", "user_id"),
    )


class AutomationRun(Base):
    __tablename__ = "automation_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    automation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("search_automations.id", ondelete="CASCADE"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String, default="running")
    results_found: Mapped[int] = mapped_column(Integer, default=0)
    results_new: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    pages_searched: Mapped[int] = mapped_column(Integer, default=0)

    automation: Mapped["SearchAutomation"] = relationship(back_populates="runs")

    __table_args__ = (
        CheckConstraint("status IN ('running', 'success', 'error')"),
    )


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    automation_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("search_automations.id", ondelete="SET NULL"))
    channel: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSON)

    __table_args__ = (
        CheckConstraint("channel IN ('in_app', 'email', 'whatsapp', 'push')"),
    )


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[str] = mapped_column(String, default="#3B82F6")

    __table_args__ = (
        UniqueConstraint("user_id", "name"),
    )


class EditalAnalysis(Base):
    __tablename__ = "edital_analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    result_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("search_results.id", ondelete="SET NULL"))
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("result_documents.id", ondelete="SET NULL"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)

    # PDF source
    source_type: Mapped[str] = mapped_column(String, nullable=False)  # 'upload' or 'pncp_download'
    pdf_filename: Mapped[Optional[str]] = mapped_column(String)
    pdf_storage_path: Mapped[Optional[str]] = mapped_column(String)
    pdf_size_bytes: Mapped[Optional[int]] = mapped_column(Integer)

    # Processing status
    status: Mapped[str] = mapped_column(String, default="pending")
    error_message: Mapped[Optional[str]] = mapped_column(Text)

    # Extracted data
    extracted_text: Mapped[Optional[str]] = mapped_column(Text)
    page_count: Mapped[Optional[int]] = mapped_column(Integer)

    # LLM analysis result (JSON)
    analysis_data: Mapped[Optional[dict]] = mapped_column("analysis_data", JSON)

    # LLM metadata
    llm_model: Mapped[Optional[str]] = mapped_column(String)
    tokens_used: Mapped[Optional[int]] = mapped_column(Integer)
    processing_time_ms: Mapped[Optional[int]] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    technical_evidences: Mapped[list["AnalysisTechnicalEvidence"]] = relationship(
        back_populates="analysis", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("source_type IN ('upload', 'pncp_download')"),
        CheckConstraint("status IN ('pending', 'processing', 'completed', 'error')"),
    )


class AnalysisTechnicalEvidence(Base):
    __tablename__ = "analysis_technical_evidences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("edital_analyses.id", ondelete="CASCADE"), nullable=False
    )
    result_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("search_results.id", ondelete="SET NULL")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False
    )
    clause_ref: Mapped[Optional[str]] = mapped_column(String)
    source_text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.75)
    is_human_validated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    analysis: Mapped["EditalAnalysis"] = relationship(back_populates="technical_evidences")

    __table_args__ = (
        Index("idx_analysis_technical_evidences_analysis_id", "analysis_id"),
        Index("idx_analysis_technical_evidences_result_id", "result_id"),
        Index("idx_analysis_technical_evidences_user_id", "user_id"),
    )
