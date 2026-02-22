const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// TODO: Replace with real auth
const TEMP_USER_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${API_BASE}${path}${separator}user_id=${TEMP_USER_ID}`;

    const res = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    });

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
    srp: boolean | null;
    status: "pending" | "saved" | "discarded";
    relevance_score: number | null;
    is_read: boolean;
    found_at: string;
    acted_at: string | null;
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

    updateResultStatus: (id: string, action: "saved" | "discarded") =>
        apiFetch<SearchResult>(`/results/${id}/action`, {
            method: "PATCH",
            body: JSON.stringify({ action }),
        }),

    batchAction: (result_ids: string[], action: "saved" | "discarded") =>
        apiFetch<{ updated: number }>("/results/batch-action", {
            method: "POST",
            body: JSON.stringify({ result_ids, action }),
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
        apiFetch<EditalAnalysis>(`/analysis/by-result/${resultId}`),

    deleteAnalysis: (id: string) =>
        apiFetch<{ ok: boolean }>(`/analysis/${id}`, { method: "DELETE" }),

    getAnalysisStats: () =>
        apiFetch<AnalysisStats>("/analysis/stats"),
};

