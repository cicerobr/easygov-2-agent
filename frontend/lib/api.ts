const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "/api-proxy/api").replace(/\/$/, "");

// TODO: Replace with real auth
const TEMP_USER_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${API_BASE}${path}${separator}user_id=${TEMP_USER_ID}`;

    let res: Response;
    try {
        res = await fetch(url, {
            cache: "no-store",
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options?.headers,
            },
        });
    } catch (error) {
        const details = error instanceof Error ? error.message : "erro de rede";
        throw new Error(
            `Falha de conexão com a API (${API_BASE}). Verifique se o backend está rodando e acessível. Detalhes: ${details}`
        );
    }

    if (!res.ok) {
        const error = await res.text();
        throw new Error(`API Error ${res.status}: ${error}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Automation {
    id: string;
    user_id: string;
    name: string;
    is_active: boolean;
    search_type: string;
    modalidade_ids: number[] | null;
    uf: string | null;
    codigo_municipio_ibge: string | null;
    cnpj_orgao: string | null;
    codigo_modo_disputa: number | null;
    keywords: string[] | null;
    keywords_exclude: string[] | null;
    search_in_items: boolean;
    valor_minimo: number | null;
    valor_maximo: number | null;
    schedule_type: string;
    interval_hours: number;
    timezone: string;
    last_run_at: string | null;
    next_run_at: string | null;
    created_at: string;
    updated_at: string;
}

export type KeywordMatchScope = "object" | "item" | "both";

export interface KeywordMatchEvidence {
    scope: "object" | "item";
    keyword: string;
    item_numero?: number;
    snippet: string;
    field?: string;
}

export interface SearchResult {
    id: string;
    automation_id: string;
    numero_controle_pncp: string;
    cnpj_orgao: string;
    ano_compra: number;
    sequencial_compra: number;
    objeto_compra: string | null;
    modalidade_nome: string | null;
    modo_disputa_nome: string | null;
    valor_total_estimado: number | null;
    data_publicacao: string | null;
    data_abertura_proposta: string | null;
    data_encerramento_proposta: string | null;
    situacao_compra_nome: string | null;
    orgao_nome: string | null;
    uf: string | null;
    municipio: string | null;
    link_sistema_origem: string | null;
    link_processo_eletronico: string | null;
    codigo_unidade_compradora: string | null;
    nome_unidade_compradora: string | null;
    srp: boolean | null;
    keyword_match_scope?: KeywordMatchScope | null;
    keyword_match_evidence?: KeywordMatchEvidence[] | null;
    status: "pending" | "saved" | "discarded" | "dispute_open" | "dispute_won" | "dispute_lost";
    relevance_score: number | null;
    is_read: boolean;
    found_at: string;
    acted_at: string | null;
    dispute_started_at: string | null;
    dispute_finished_at: string | null;
}

export interface ResultItem {
    id: string;
    numero_item: number;
    descricao: string | null;
    material_ou_servico: string | null;
    material_ou_servico_nome: string | null;
    valor_unitario_estimado: number | null;
    valor_total: number | null;
    quantidade: number | null;
    unidade_medida: string | null;
    situacao_compra_item_nome: string | null;
    criterio_julgamento_nome: string | null;
    tipo_beneficio_nome: string | null;
    tem_resultado: boolean | null;
    orcamento_sigiloso: boolean | null;
    item_categoria_nome: string | null;
    informacao_complementar: string | null;
}

export interface ResultDocument {
    id: string;
    sequencial_documento: number | null;
    titulo: string | null;
    tipo_documento_id: number | null;
    tipo_documento_nome: string | null;
    tipo_documento_descricao: string | null;
    url: string | null;
    uri: string | null;
    status_ativo: boolean | null;
    data_publicacao_pncp: string | null;
}

export interface SearchResultDetail extends SearchResult {
    items: ResultItem[];
    documents: ResultDocument[];
}

export interface PaginatedResults {
    data: SearchResult[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface ResultStats {
    pending: number;
    unread: number;
    saved: number;
    discarded: number;
    total: number;
}

export interface ResultPipelineState {
    result_id: string;
    pipeline_stage: string;
    stage_started_at: string;
    stage_finished_at: string | null;
    stage_error: string | null;
    updated_at: string;
}

export interface ResultPipelineKpis {
    total_results: number;
    triaged_total: number;
    pending_total: number;
    dispute_total: number;
    won_total: number;
    lost_total: number;
    pending_to_saved_rate: number;
    saved_to_dispute_rate: number;
    dispute_win_rate: number;
    analysis_success_rate: number;
    analysis_avg_processing_ms: number;
    technical_evidence_coverage_rate: number;
}

export interface PriorityScoreComponent {
    label: string;
    score: number;
    max_score: number;
    reason: string;
}

export interface ResultPriorityScore {
    result_id: string;
    total_score: number;
    recommendation: string;
    components: PriorityScoreComponent[];
}

export interface DisputeStats {
    em_disputa: number;
    vencidos: number;
    perdidos: number;
    total: number;
}

export interface DisputeStartResponse {
    id: string;
    status: string;
    dispute_started_at: string | null;
}

export interface DisputeFinishResponse {
    id: string;
    status: string;
    dispute_finished_at: string | null;
}

export interface Notification {
    id: string;
    channel: string;
    title: string;
    body: string | null;
    is_read: boolean;
    sent_at: string;
}

export interface AutomationRun {
    id: string;
    automation_id: string;
    started_at: string;
    finished_at: string | null;
    status: string;
    results_found: number;
    results_new: number;
    error_message: string | null;
    pages_searched: number;
}

export interface AutomationLearningSuggestions {
    automation_id: string;
    disputed_count: number;
    won_count: number;
    lost_count: number;
    win_rate: number;
    top_loss_reasons: string[];
    suggested_actions: string[];
}

export interface EditalAnalysis {
    id: string;
    result_id: string | null;
    document_id: string | null;
    source_type: "upload" | "pncp_download";
    pdf_filename: string | null;
    pdf_size_bytes: number | null;
    status: "pending" | "processing" | "completed" | "error";
    error_message: string | null;
    page_count: number | null;
    analysis_data: Record<string, unknown> | null;
    llm_model: string | null;
    tokens_used: number | null;
    processing_time_ms: number | null;
    created_at: string;
    completed_at: string | null;
}

export interface AnalysisTechnicalEvidence {
    id: string;
    analysis_id: string;
    result_id: string | null;
    clause_ref: string | null;
    source_text: string;
    confidence: number;
    is_human_validated: boolean;
    created_at: string;
    updated_at: string;
}

export interface PaginatedAnalyses {
    data: EditalAnalysis[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface AnalysisStats {
    total: number;
    completed: number;
    processing: number;
    errors: number;
}

export interface DisputeMarginSuggestion {
    margem_percentual: number;
    preco_venda: number;
    imposto_estimado: number;
    lucro_liquido_estimado: number;
}

export interface DisputeItemFinancialInput {
    preco_fornecedor: number;
    mao_obra: number;
    materiais_consumo: number;
    equipamentos: number;
    frete_logistica: number;
    aliquota_imposto_percentual: number;
}

export interface DisputeItemFinancialResponse {
    id: string;
    result_id: string;
    result_item_id: string;
    preco_fornecedor: number;
    mao_obra: number;
    materiais_consumo: number;
    equipamentos: number;
    frete_logistica: number;
    aliquota_imposto_percentual: number;
    custos_totais: number;
    precos_sugeridos: DisputeMarginSuggestion[];
    updated_at: string;
}

export interface DisputeItemFinancialRow {
    result_item_id: string;
    numero_item: number;
    descricao: string | null;
    quantidade: number | null;
    unidade_medida: string | null;
    financial: DisputeItemFinancialResponse | null;
}

export interface DisputeTimelineEvent {
    event_type: "dispute_started" | "financial_saved" | "dispute_won" | "dispute_lost" | "feedback_submitted";
    actor_type: "human" | "system";
    created_at: string;
    payload: Record<string, unknown> | null;
}

export interface DisputeFeedbackInput {
    loss_reason?: string | null;
    winner_price_delta?: number | null;
    suggested_filter_adjustments?: Record<string, unknown> | null;
}

export interface DisputeFeedbackResponse {
    id: string;
    result_id: string;
    loss_reason: string | null;
    winner_price_delta: number | null;
    suggested_filter_adjustments: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

// ─── API Functions ───────────────────────────────────────────────────────────

export const api = {
    // Automations
    listAutomations: () => apiFetch<Automation[]>("/automations"),

    createAutomation: (data: Partial<Automation>) =>
        apiFetch<Automation>("/automations", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    updateAutomation: (id: string, data: Partial<Automation>) =>
        apiFetch<Automation>(`/automations/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    deleteAutomation: (id: string) =>
        apiFetch<void>(`/automations/${id}`, { method: "DELETE" }),

    triggerAutomation: (id: string) =>
        apiFetch<AutomationRun>(`/automations/${id}/run`, { method: "POST" }),

    listAutomationRuns: (id: string) =>
        apiFetch<AutomationRun[]>(`/automations/${id}/runs`),

    getAutomationLearningSuggestions: (id: string) =>
        apiFetch<AutomationLearningSuggestions>(`/automations/${id}/learning-suggestions`),

    // Results
    listResults: (params: {
        status?: string;
        page?: number;
        page_size?: number;
        automation_id?: string;
    }) => {
        const qs = new URLSearchParams();
        if (params.status) qs.set("status", params.status);
        if (params.page) qs.set("page", String(params.page));
        if (params.page_size) qs.set("page_size", String(params.page_size));
        if (params.automation_id) qs.set("automation_id", params.automation_id);
        return apiFetch<PaginatedResults>(`/results?${qs.toString()}`);
    },

    getResultDetail: (id: string) =>
        apiFetch<SearchResultDetail>(`/results/${id}`),

    getResultStats: () => apiFetch<ResultStats>("/results/stats"),

    getResultKpis: () => apiFetch<ResultPipelineKpis>("/results/kpis"),

    updateResultStatus: (id: string, action: "saved" | "discarded") =>
        apiFetch<SearchResult>(`/results/${id}/action`, {
            method: "PATCH",
            body: JSON.stringify({ action }),
        }),

    getResultPipelineState: (id: string) =>
        apiFetch<ResultPipelineState>(`/results/${id}/pipeline-state`),

    getResultPriorityScore: (id: string) =>
        apiFetch<ResultPriorityScore>(`/results/${id}/priority-score`),

    batchAction: (result_ids: string[], action: "saved" | "discarded") =>
        apiFetch<{ updated: number }>("/results/batch-action", {
            method: "POST",
            body: JSON.stringify({ result_ids, action }),
        }),

    // Disputes
    listDisputes: (params: {
        tab?: "em_disputa" | "vencidos" | "perdidos";
        page?: number;
        page_size?: number;
    }) => {
        const qs = new URLSearchParams();
        qs.set("tab", params.tab || "em_disputa");
        if (params.page) qs.set("page", String(params.page));
        if (params.page_size) qs.set("page_size", String(params.page_size));
        return apiFetch<PaginatedResults>(`/disputes?${qs.toString()}`);
    },

    getDisputeStats: () => apiFetch<DisputeStats>("/disputes/stats"),

    startDispute: (resultId: string) =>
        apiFetch<DisputeStartResponse>(`/disputes/${resultId}/start`, {
            method: "POST",
        }),

    finishDispute: (resultId: string, action: "won" | "lost") =>
        apiFetch<DisputeFinishResponse>(`/disputes/${resultId}/finish`, {
            method: "POST",
            body: JSON.stringify({ action }),
        }),

    listDisputeFinancialItems: (resultId: string) =>
        apiFetch<DisputeItemFinancialRow[]>(`/disputes/${resultId}/financial-items`),

    upsertDisputeFinancialItem: (
        resultId: string,
        resultItemId: string,
        data: DisputeItemFinancialInput
    ) =>
        apiFetch<DisputeItemFinancialResponse>(
            `/disputes/${resultId}/financial-items/${resultItemId}`,
            {
                method: "PUT",
                body: JSON.stringify(data),
            }
        ),

    getDisputeTimeline: (resultId: string) =>
        apiFetch<DisputeTimelineEvent[]>(`/disputes/${resultId}/timeline`),

    submitDisputeFeedback: (resultId: string, data: DisputeFeedbackInput) =>
        apiFetch<DisputeFeedbackResponse>(`/disputes/${resultId}/feedback`, {
            method: "POST",
            body: JSON.stringify(data),
        }),

    // Notifications
    listNotifications: (unread_only = false) =>
        apiFetch<Notification[]>(
            `/notifications?unread_only=${unread_only}`
        ),

    getUnreadCount: () =>
        apiFetch<{ unread_count: number }>("/notifications/unread-count"),

    markAllRead: () =>
        apiFetch<{ updated: number }>("/notifications/mark-all-read", {
            method: "POST",
        }),

    // ─── Analysis ────────────────────────────────────────────────────────

    uploadPdfForAnalysis: async (file: File): Promise<EditalAnalysis> => {
        const formData = new FormData();
        formData.append("file", file);
        const separator = "?";
        const url = `${API_BASE}/analysis/upload${separator}user_id=${TEMP_USER_ID}`;
        const res = await fetch(url, { method: "POST", body: formData });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        return res.json();
    },

    uploadBatchPdfs: async (files: File[]): Promise<EditalAnalysis[]> => {
        const formData = new FormData();
        files.forEach((f) => formData.append("files", f));
        const url = `${API_BASE}/analysis/upload-batch?user_id=${TEMP_USER_ID}`;
        const res = await fetch(url, { method: "POST", body: formData });
        if (!res.ok) throw new Error(`Batch upload failed: ${res.status}`);
        return res.json();
    },

    analyzeFromPncp: (documentId: string) =>
        apiFetch<EditalAnalysis>("/analysis/from-pncp", {
            method: "POST",
            body: JSON.stringify({ document_id: documentId }),
        }),

    analyzeBatchFromPncp: (documentIds: string[]) =>
        apiFetch<EditalAnalysis[]>("/analysis/batch-from-pncp", {
            method: "POST",
            body: JSON.stringify({ document_ids: documentIds }),
        }),

    listAnalyses: (params: { status?: string; page?: number; page_size?: number }) => {
        const qs = new URLSearchParams();
        if (params.status && params.status !== "all") qs.set("status", params.status);
        if (params.page) qs.set("page", String(params.page));
        if (params.page_size) qs.set("page_size", String(params.page_size));
        return apiFetch<PaginatedAnalyses>(`/analysis?${qs.toString()}`);
    },

    getAnalysis: (id: string) =>
        apiFetch<EditalAnalysis>(`/analysis/${id}`),

    getAnalysisByResultId: (resultId: string) =>
        apiFetch<EditalAnalysis | null>(`/analysis/by-result/${resultId}`),

    getTechnicalEvidence: (resultId: string) =>
        apiFetch<AnalysisTechnicalEvidence[]>(`/analysis/${resultId}/technical-evidence`),

    validateTechnicalEvidence: (evidenceId: string, is_human_validated = true) =>
        apiFetch<AnalysisTechnicalEvidence>(`/analysis/technical-evidence/${evidenceId}/validate`, {
            method: "PATCH",
            body: JSON.stringify({ is_human_validated }),
        }),

    deleteAnalysis: (id: string) =>
        apiFetch<{ ok: boolean }>(`/analysis/${id}`, { method: "DELETE" }),

    getAnalysisStats: () =>
        apiFetch<AnalysisStats>("/analysis/stats"),
};
