"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    Bot,
    Building2,
    Calendar,
    CheckCircle2,
    ChevronRight,
    CreditCard,
    DollarSign,
    Download,
    ExternalLink,
    FileText,
    Gavel,
    Info,
    Loader2,
    Package,
    Save,
    Scale,
    ShieldCheck,
    TrendingUp,
    Trophy,
    Truck,
    UserX,
    Users,
    X,
} from "lucide-react";

import {
    api,
    type DisputeFeedbackInput,
    type DisputeItemFinancialInput,
    type DisputeItemFinancialResponse,
    type DisputeItemFinancialRow,
    type DisputeTimelineEvent,
    type EditalAnalysis,
    type ResultDocument,
    type ResultItem,
    type SearchResultDetail,
} from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { getAnalysisTags } from "@/lib/analysis-tags";
import { getKeywordScopeLabel } from "@/lib/keyword-evidence";
import {
    getTechnicalQualificationItems,
    hasNoTechnicalQualificationRequirement,
} from "@/lib/technical-requirements";
import { ModalPortal } from "@/components/modal-portal";
import { ConfirmModal } from "@/components/confirm-modal";
import { StickyFooterActions } from "@/components/sticky-footer-actions";

type MainTab = "edital" | "analise_financeira";
type EditalTab = "geral" | "itens" | "documentos" | "detalhes_edital";
type FinishAction = "won" | "lost";
type ModalStatus = "running" | "success" | "error";

const DISPUTE_STATUSES = new Set(["dispute_open", "dispute_won", "dispute_lost"]);

const STATUS_STYLES: Record<string, string> = {
    dispute_open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    dispute_won: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    dispute_lost: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const STATUS_LABELS: Record<string, string> = {
    dispute_open: "Em Disputa",
    dispute_won: "Vencido",
    dispute_lost: "Perdido",
};

const FINANCIAL_PROGRESS_STEPS = [
    { label: "Validando os dados financeiros...", pct: 20 },
    { label: "Consolidando custos do item...", pct: 45 },
    { label: "Calculando cenários de margem líquida...", pct: 75 },
    { label: "Salvando análise financeira...", pct: 95 },
];

interface FinancialModalState {
    open: boolean;
    status: ModalStatus;
    stage: number;
    itemLabel: string;
    error: string | null;
}

type Primitive = string | number | boolean | null | undefined;

type EditalAnalysisItemData = {
    numero?: Primitive;
    descricao?: string;
    especificacao_tecnica?: string;
    grupo_lote?: Primitive;
    marca_referencia?: Primitive;
    ncm?: Primitive;
    catmat_catser?: Primitive;
    exclusivo_me_epp?: boolean;
    amostra_exigida?: boolean;
    quantidade?: Primitive;
    unidade?: Primitive;
    valor_unitario_estimado?: number | null;
    valor_total_estimado?: number | null;
};

type EditalAnalysisData = {
    objeto_resumo?: string;
    objeto_detalhado?: string;
    orgao?: Record<string, Primitive>;
    licitacao?: Record<string, Primitive>;
    valores?: {
        valor_total_estimado?: number | null;
        valor_maximo_aceitavel?: number | null;
    } & Record<string, Primitive>;
    datas?: Record<string, Primitive>;
    entrega?: Record<string, Primitive>;
    pagamento?: Record<string, Primitive>;
    contatos?: Record<string, Primitive>;
    habilitacao?: Record<string, string[] | undefined>;
    itens?: EditalAnalysisItemData[];
    observacoes?: string[];
} & Record<string, unknown>;

function emptyDraft(): DisputeItemFinancialInput {
    return {
        preco_fornecedor: 0,
        mao_obra: 0,
        materiais_consumo: 0,
        equipamentos: 0,
        frete_logistica: 0,
        aliquota_imposto_percentual: 0,
    };
}

function draftFromFinancial(financial: DisputeItemFinancialResponse | null): DisputeItemFinancialInput {
    if (!financial) return emptyDraft();
    return {
        preco_fornecedor: financial.preco_fornecedor,
        mao_obra: financial.mao_obra,
        materiais_consumo: financial.materiais_consumo,
        equipamentos: financial.equipamentos,
        frete_logistica: financial.frete_logistica,
        aliquota_imposto_percentual: financial.aliquota_imposto_percentual,
    };
}

function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        if (error.message.includes(":")) {
            const parts = error.message.split(":");
            return parts[parts.length - 1].trim();
        }
        return error.message;
    }
    return "Falha ao processar esta análise financeira.";
}

export default function DisputaDetailPage() {
    const params = useParams();
    const router = useRouter();
    const resultId = params.id as string;

    const [result, setResult] = useState<SearchResultDetail | null>(null);
    const [linkedAnalysis, setLinkedAnalysis] = useState<EditalAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [mainTab, setMainTab] = useState<MainTab>("edital");
    const [editalTab, setEditalTab] = useState<EditalTab>("geral");

    const [financialRows, setFinancialRows] = useState<DisputeItemFinancialRow[] | null>(null);
    const [financialDrafts, setFinancialDrafts] = useState<Record<string, DisputeItemFinancialInput>>({});
    const [financialLoading, setFinancialLoading] = useState(false);
    const [savingItemId, setSavingItemId] = useState<string | null>(null);

    const [finishConfirm, setFinishConfirm] = useState<FinishAction | null>(null);
    const [finishing, setFinishing] = useState(false);
    const [timelineEvents, setTimelineEvents] = useState<DisputeTimelineEvent[]>([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [feedback, setFeedback] = useState<DisputeFeedbackInput>({
        loss_reason: "",
        winner_price_delta: null,
        suggested_filter_adjustments: null,
    });
    const [savingFeedback, setSavingFeedback] = useState(false);

    const [financialModal, setFinancialModal] = useState<FinancialModalState>({
        open: false,
        status: "running",
        stage: 0,
        itemLabel: "",
        error: null,
    });

    const isOpenDispute = result?.status === "dispute_open";

    const loadResult = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setTimelineLoading(true);

            const [resultRes, analysisRes, timelineRes] = await Promise.allSettled([
                api.getResultDetail(resultId),
                api.getAnalysisByResultId(resultId),
                api.getDisputeTimeline(resultId),
            ]);

            if (resultRes.status === "rejected") {
                throw resultRes.reason;
            }

            setResult(resultRes.value);
            if (analysisRes.status === "fulfilled") {
                setLinkedAnalysis(analysisRes.value);
            } else {
                setLinkedAnalysis(null);
            }

            if (timelineRes.status === "fulfilled") {
                setTimelineEvents(timelineRes.value);
            } else {
                setTimelineEvents([]);
            }
        } catch (err) {
            console.error(err);
            setError("Erro ao carregar os detalhes da disputa.");
        } finally {
            setLoading(false);
            setTimelineLoading(false);
        }
    }, [resultId]);

    const loadFinancialRows = useCallback(async () => {
        try {
            setFinancialLoading(true);
            const rows = await api.listDisputeFinancialItems(resultId);
            setFinancialRows(rows);
            const nextDrafts: Record<string, DisputeItemFinancialInput> = {};
            rows.forEach((row) => {
                nextDrafts[row.result_item_id] = draftFromFinancial(row.financial);
            });
            setFinancialDrafts(nextDrafts);
        } catch (err) {
            console.error(err);
            setFinancialRows([]);
        } finally {
            setFinancialLoading(false);
        }
    }, [resultId]);

    useEffect(() => {
        loadResult();
    }, [loadResult]);

    useEffect(() => {
        if (!loading && result && !DISPUTE_STATUSES.has(result.status)) {
            router.replace("/disputas");
        }
    }, [loading, result, router]);

    useEffect(() => {
        if (mainTab === "analise_financeira" && financialRows === null && !financialLoading) {
            loadFinancialRows();
        }
    }, [financialLoading, financialRows, loadFinancialRows, mainTab]);

    async function handleFinish(action: FinishAction) {
        if (!result) return;
        setFinishing(true);
        try {
            const next = await api.finishDispute(result.id, action);
            setResult({
                ...result,
                status: next.status as SearchResultDetail["status"],
                dispute_finished_at: next.dispute_finished_at,
            });
            window.location.assign(`/disputas?tab=${action === "won" ? "vencidos" : "perdidos"}`);
        } catch (err) {
            console.error(err);
            setError("Não foi possível finalizar a disputa deste edital.");
        } finally {
            setFinishing(false);
            setFinishConfirm(null);
        }
    }

    async function handleSubmitFeedback() {
        if (!result) return;
        setSavingFeedback(true);
        try {
            await api.submitDisputeFeedback(result.id, feedback);
            const refreshed = await api.getDisputeTimeline(result.id);
            setTimelineEvents(refreshed);
        } catch (err) {
            console.error(err);
        } finally {
            setSavingFeedback(false);
        }
    }

    function handleFinancialFieldChange(
        resultItemId: string,
        field: keyof DisputeItemFinancialInput,
        rawValue: string
    ) {
        const numericValue = Number(rawValue);
        setFinancialDrafts((prev) => ({
            ...prev,
            [resultItemId]: {
                ...(prev[resultItemId] || emptyDraft()),
                [field]: Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0,
            },
        }));
    }

    async function handleSaveFinancial(row: DisputeItemFinancialRow) {
        const draft = financialDrafts[row.result_item_id] || emptyDraft();
        setSavingItemId(row.result_item_id);
        setFinancialModal({
            open: true,
            status: "running",
            stage: 0,
            itemLabel: `Item ${row.numero_item}`,
            error: null,
        });

        let currentStage = 0;
        const intervalId = setInterval(() => {
            currentStage += 1;
            setFinancialModal((prev) =>
                prev.status === "running"
                    ? {
                        ...prev,
                        stage: Math.min(currentStage, FINANCIAL_PROGRESS_STEPS.length - 1),
                    }
                    : prev
            );
        }, 900);

        try {
            const saved = await api.upsertDisputeFinancialItem(resultId, row.result_item_id, draft);
            setFinancialRows((prev) =>
                prev
                    ? prev.map((item) =>
                        item.result_item_id === row.result_item_id
                            ? { ...item, financial: saved }
                            : item
                    )
                    : prev
            );
            setFinancialDrafts((prev) => ({
                ...prev,
                [row.result_item_id]: draftFromFinancial(saved),
            }));
            setFinancialModal({
                open: true,
                status: "success",
                stage: FINANCIAL_PROGRESS_STEPS.length,
                itemLabel: `Item ${row.numero_item}`,
                error: null,
            });
        } catch (err) {
            console.error(err);
            setFinancialModal({
                open: true,
                status: "error",
                stage: Math.min(currentStage, FINANCIAL_PROGRESS_STEPS.length - 1),
                itemLabel: `Item ${row.numero_item}`,
                error: extractErrorMessage(err),
            });
        } finally {
            clearInterval(intervalId);
            setSavingItemId(null);
        }
    }

    const financialRowsWithDraft = useMemo(() => {
        if (!financialRows) return [];
        return financialRows.map((row) => ({
            row,
            draft: financialDrafts[row.result_item_id] || emptyDraft(),
        }));
    }, [financialDrafts, financialRows]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "var(--color-primary)" }} />
                    <p style={{ color: "var(--color-text-secondary)" }}>Carregando detalhes da disputa...</p>
                </div>
            </div>
        );
    }

    if (error || !result) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="text-center">
                    <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--color-danger)" }} />
                    <p className="mb-4" style={{ color: "var(--color-danger)" }}>
                        {error || "Disputa não encontrada"}
                    </p>
                    <button onClick={() => router.push("/disputas")} className="btn-primary">
                        Voltar para Disputas
                    </button>
                </div>
            </div>
        );
    }

    if (!DISPUTE_STATUSES.has(result.status)) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto mb-3" style={{ color: "var(--color-primary)" }} />
                    <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                        Redirecionando para Disputas...
                    </p>
                </div>
            </div>
        );
    }

    const editalTabs: { id: EditalTab; label: string; icon: typeof Info; count?: number }[] = [
        { id: "geral", label: "Informações Gerais", icon: Info },
        { id: "itens", label: "Itens", icon: Package, count: result.items.length },
        { id: "documentos", label: "Documentos", icon: FileText, count: result.documents.length },
        { id: "detalhes_edital", label: "Detalhes do Edital", icon: Bot },
    ];

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-6">
                <button
                    onClick={() => router.push("/disputas")}
                    className="flex items-center gap-2 transition-colors mb-4"
                    style={{ color: "var(--color-text-secondary)" }}
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para Disputas
                </button>

                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`badge border ${STATUS_STYLES[result.status]}`}>
                                {STATUS_LABELS[result.status]}
                            </span>
                            {result.modalidade_nome && (
                                <span className="badge" style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)" }}>
                                    {result.modalidade_nome}
                                </span>
                            )}
                        </div>
                        <h1 className="text-xl font-semibold leading-tight mb-1" style={{ color: "var(--color-text-primary)" }}>
                            {result.objeto_compra || "Sem descrição"}
                        </h1>
                        <p className="text-sm font-mono" style={{ color: "var(--color-text-muted)" }}>
                            {result.numero_controle_pncp}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <TopCard
                    icon={Calendar}
                    label="Início de envio de propostas"
                    value={result.data_abertura_proposta ? formatDateTime(result.data_abertura_proposta) : "Não informado"}
                />
                <TopCard
                    icon={Calendar}
                    label="Fim de envio de propostas"
                    value={
                        result.data_encerramento_proposta ? formatDateTime(result.data_encerramento_proposta) : "Não informado"
                    }
                />
                <TopCard
                    icon={Building2}
                    label="Código da Unidade Compradora"
                    value={result.codigo_unidade_compradora || "Não informado"}
                    subtitle={result.nome_unidade_compradora || "Use este código para localizar no compras.gov.br"}
                />
            </div>

            <div className="hidden md:flex items-center justify-end gap-2 mb-6">
                <button
                    onClick={() => setFinishConfirm("won")}
                    disabled={!isOpenDispute || finishing}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!isOpenDispute ? "Disponível apenas para disputas em aberto" : "Marcar edital como ganho"}
                >
                    <Trophy className="w-4 h-4" />
                    Ganhei
                </button>
                <button
                    onClick={() => setFinishConfirm("lost")}
                    disabled={!isOpenDispute || finishing}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!isOpenDispute ? "Disponível apenas para disputas em aberto" : "Marcar edital como perdido"}
                >
                    <UserX className="w-4 h-4" />
                    Perdido
                </button>
            </div>

            <div className="flex gap-1 mb-5 rounded-xl p-1" style={{ background: "var(--color-bg-secondary)" }}>
                <button
                    onClick={() => setMainTab("edital")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${mainTab === "edital" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : ""
                        }`}
                    style={mainTab !== "edital" ? { color: "var(--color-text-secondary)" } : undefined}
                >
                    <FileText className="w-4 h-4" />
                    Edital
                </button>
                <button
                    onClick={() => setMainTab("analise_financeira")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${mainTab === "analise_financeira" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : ""
                        }`}
                    style={mainTab !== "analise_financeira" ? { color: "var(--color-text-secondary)" } : undefined}
                >
                    <TrendingUp className="w-4 h-4" />
                    Análise Financeira
                </button>
            </div>

            {mainTab === "edital" ? (
                <>
                    <div className="flex gap-1 mb-5 rounded-xl p-1" style={{ background: "var(--color-bg-secondary)" }}>
                        {editalTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setEditalTab(tab.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex-1 justify-center ${editalTab === tab.id ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : ""
                                    }`}
                                style={editalTab !== tab.id ? { color: "var(--color-text-secondary)" } : undefined}
                            >
                                <tab.icon className="w-4 h-4" />
                                <span className="hidden sm:inline">{tab.label}</span>
                                <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                                {tab.count !== undefined && (
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${editalTab === tab.id ? "bg-white/20 text-white" : "bg-emerald-500/20 text-emerald-500"
                                            }`}
                                    >
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {editalTab === "geral" && <GeneralTab result={result} />}
                    {editalTab === "itens" && <ItemsTab items={result.items} />}
                    {editalTab === "documentos" && (
                        <DocumentsTabWithoutAI
                            documents={result.documents}
                            cnpjOrgao={result.cnpj_orgao}
                            anoCompra={result.ano_compra}
                            sequencialCompra={result.sequencial_compra}
                        />
                    )}
                    {editalTab === "detalhes_edital" && <EditalDetailsTab analysis={linkedAnalysis} />}
                </>
            ) : (
                <FinancialTab
                    rows={financialRowsWithDraft}
                    loading={financialLoading}
                    savingItemId={savingItemId}
                    onChange={handleFinancialFieldChange}
                    onSave={handleSaveFinancial}
                />
            )}

            <DisputeTimelineSection events={timelineEvents} loading={timelineLoading} />

            {result.status !== "dispute_open" && (
                <DisputeFeedbackSection
                    feedback={feedback}
                    saving={savingFeedback}
                    onChange={setFeedback}
                    onSubmit={handleSubmitFeedback}
                />
            )}

            {isOpenDispute && (
                <StickyFooterActions>
                    <button
                        onClick={() => setFinishConfirm("won")}
                        disabled={finishing}
                        className="btn-success disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Trophy className="w-4 h-4" />
                        Ganhei
                    </button>
                    <button
                        onClick={() => setFinishConfirm("lost")}
                        disabled={finishing}
                        className="btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <UserX className="w-4 h-4" />
                        Perdido
                    </button>
                </StickyFooterActions>
            )}

            <ConfirmModal
                isOpen={finishConfirm !== null}
                title={finishConfirm === "won" ? "Confirmar edital ganho" : "Confirmar edital perdido"}
                message={
                    finishConfirm === "won"
                        ? "Este edital será movido para a aba Vencidos."
                        : "Este edital será movido para a aba Perdidos."
                }
                confirmLabel={finishConfirm === "won" ? "Confirmar Ganhei" : "Confirmar Perdido"}
                cancelLabel="Cancelar"
                variant={finishConfirm === "won" ? "primary" : "danger"}
                isLoading={finishing}
                onCancel={() => setFinishConfirm(null)}
                onConfirm={async () => {
                    if (finishConfirm) await handleFinish(finishConfirm);
                }}
            />

            <FinancialProgressModal
                state={financialModal}
                onClose={() => setFinancialModal((prev) => ({ ...prev, open: false }))}
            />
        </div>
    );
}

function TopCard({
    icon: Icon,
    label,
    value,
    subtitle,
}: {
    icon: typeof Calendar;
    label: string;
    value: string;
    subtitle?: string;
}) {
    return (
        <div className="card p-4">
            <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Icon className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--color-text-muted)" }}>
                        {label}
                    </p>
                    <p className="text-sm font-semibold break-all" style={{ color: "var(--color-text-primary)" }}>
                        {value}
                    </p>
                    {subtitle && (
                        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function DisputeTimelineSection({
    events,
    loading,
}: {
    events: DisputeTimelineEvent[];
    loading: boolean;
}) {
    const labelMap: Record<string, string> = {
        dispute_started: "Disputa iniciada",
        financial_saved: "Análise financeira salva",
        dispute_won: "Edital marcado como vencido",
        dispute_lost: "Edital marcado como perdido",
        feedback_submitted: "Feedback registrado",
    };

    return (
        <div className="card p-5 mt-6">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
                Timeline da Disputa
            </h3>
            {loading ? (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Carregando eventos...
                </p>
            ) : events.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Sem eventos registrados ainda.
                </p>
            ) : (
                <div className="space-y-2">
                    {events.map((event, index) => (
                        <div
                            key={`${event.event_type}-${event.created_at}-${index}`}
                            className="rounded-lg p-3"
                            style={{
                                background: "var(--color-bg-secondary)",
                                border: "1px solid var(--color-border)",
                            }}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                                    {labelMap[event.event_type] || event.event_type}
                                </p>
                                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                    {formatDateTime(event.created_at)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function DisputeFeedbackSection({
    feedback,
    saving,
    onChange,
    onSubmit,
}: {
    feedback: DisputeFeedbackInput;
    saving: boolean;
    onChange: (value: DisputeFeedbackInput) => void;
    onSubmit: () => void;
}) {
    return (
        <div className="card p-5 mt-4">
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
                Feedback da Disputa
            </h3>
            <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
                Registre os aprendizados para melhorar filtros e priorização automática.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
                <label className="block">
                    <span className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>
                        Motivo principal
                    </span>
                    <input
                        type="text"
                        value={feedback.loss_reason || ""}
                        onChange={(event) =>
                            onChange({ ...feedback, loss_reason: event.target.value })
                        }
                        className="w-full rounded-lg px-3 py-2 text-sm"
                        style={{
                            background: "var(--color-bg-secondary)",
                            border: "1px solid var(--color-border)",
                            color: "var(--color-text-primary)",
                        }}
                        aria-label="Motivo principal da disputa"
                        placeholder="Ex: preço acima do vencedor, prazo, exigência técnica..."
                    />
                </label>

                <label className="block">
                    <span className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>
                        Diferença para o vencedor (R$)
                    </span>
                    <input
                        type="number"
                        value={feedback.winner_price_delta ?? ""}
                        onChange={(event) =>
                            onChange({
                                ...feedback,
                                winner_price_delta:
                                    event.target.value === "" ? null : Number(event.target.value),
                            })
                        }
                        className="w-full rounded-lg px-3 py-2 text-sm"
                        style={{
                            background: "var(--color-bg-secondary)",
                            border: "1px solid var(--color-border)",
                            color: "var(--color-text-primary)",
                        }}
                        aria-label="Diferença para o vencedor em reais"
                    />
                </label>
            </div>

            <button onClick={onSubmit} disabled={saving} className="btn-primary !px-4 !py-2">
                {saving ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Salvando feedback...
                    </>
                ) : (
                    "Salvar feedback"
                )}
            </button>
        </div>
    );
}

function GeneralTab({ result }: { result: SearchResultDetail }) {
    const matchScopeLabel = getKeywordScopeLabel(result.keyword_match_scope);
    const matchEvidence = result.keyword_match_evidence || [];
    const infoSections = [
        {
            title: "Órgão / Entidade",
            icon: Building2,
            items: [
                { label: "Nome", value: result.orgao_nome },
                { label: "CNPJ", value: formatCNPJ(result.cnpj_orgao) },
                { label: "UF", value: result.uf },
                { label: "Município", value: result.municipio },
                { label: "Código Unidade Compradora", value: result.codigo_unidade_compradora },
                { label: "Nome Unidade Compradora", value: result.nome_unidade_compradora },
            ],
        },
        {
            title: "Contratação",
            icon: Scale,
            items: [
                { label: "Modalidade", value: result.modalidade_nome },
                { label: "Modo de Disputa", value: result.modo_disputa_nome },
                { label: "Situação", value: result.situacao_compra_nome },
                {
                    label: "Valor Total Estimado",
                    value: result.valor_total_estimado != null ? formatCurrency(result.valor_total_estimado) : null,
                    highlight: true,
                },
                { label: "SRP (Registro de Preços)", value: result.srp ? "Sim" : "Não" },
            ],
        },
        {
            title: "Datas",
            icon: Calendar,
            items: [
                { label: "Publicação", value: result.data_publicacao ? formatDateTime(result.data_publicacao) : null },
                {
                    label: "Abertura de Propostas",
                    value: result.data_abertura_proposta ? formatDateTime(result.data_abertura_proposta) : null,
                },
                {
                    label: "Encerramento de Propostas",
                    value: result.data_encerramento_proposta
                        ? formatDateTime(result.data_encerramento_proposta)
                        : null,
                    highlight: true,
                },
                { label: "Entrou em disputa", value: result.dispute_started_at ? formatDateTime(result.dispute_started_at) : null },
            ],
        },
    ];

    return (
        <div className="space-y-4">
            <div className="card p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-secondary)" }}>
                    Resumo da Contratação
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <StatMini
                        label="Valor Estimado"
                        value={result.valor_total_estimado != null ? formatCurrency(result.valor_total_estimado) : "Sigiloso"}
                        icon={CreditCard}
                        color="green"
                    />
                    <StatMini label="Itens" value={String(result.items.length)} icon={Package} color="blue" />
                    <StatMini label="Documentos" value={String(result.documents.length)} icon={FileText} color="emerald" />
                    <StatMini
                        label="Status Disputa"
                        value={STATUS_LABELS[result.status] || "—"}
                        icon={Gavel}
                        color="yellow"
                    />
                </div>
            </div>

            {infoSections.map((section) => (
                <div key={section.title} className="card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <section.icon className="w-5 h-5 text-emerald-500" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                            {section.title}
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {section.items.map((item) => (
                            <div key={item.label}>
                                <span className="text-xs uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                                    {item.label}
                                </span>
                                <p
                                    className="text-sm mt-0.5"
                                    style={{
                                        color: item.highlight ? "var(--color-success)" : "var(--color-text-primary)",
                                        fontWeight: item.highlight ? 600 : 400,
                                    }}
                                >
                                    {item.value || "—"}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {matchEvidence.length > 0 && (
                <div className="card p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Info className="w-5 h-5 text-emerald-500" />
                        <h3
                            className="text-sm font-semibold uppercase tracking-wider"
                            style={{ color: "var(--color-text-secondary)" }}
                        >
                            Por que este edital entrou
                        </h3>
                    </div>
                    {matchScopeLabel && (
                        <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
                            Origem do match: {matchScopeLabel}
                        </p>
                    )}
                    <div className="space-y-3">
                        {matchEvidence.map((evidence, index) => (
                            <div
                                key={`${evidence.scope}-${evidence.keyword}-${index}`}
                                className="rounded-lg border p-3"
                                style={{ borderColor: "var(--color-border)" }}
                            >
                                <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>
                                    {evidence.scope === "item"
                                        ? `Item ${evidence.item_numero ?? "?"}`
                                        : "Objeto"}{" "}
                                    • Palavra-chave: {evidence.keyword}
                                </p>
                                <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>
                                    {evidence.snippet}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function ItemsTab({ items }: { items: ResultItem[] }) {
    if (items.length === 0) {
        return (
            <div className="card p-12 text-center">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" style={{ color: "var(--color-text-muted)" }} />
                <p style={{ color: "var(--color-text-secondary)" }}>Nenhum item encontrado para este edital.</p>
            </div>
        );
    }

    const totalValue = items.reduce((sum, item) => sum + (item.valor_total || 0), 0);

    return (
        <div className="space-y-4">
            <div className="card p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Package className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                                Total de itens
                            </p>
                            <p className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
                                {items.length}
                            </p>
                        </div>
                    </div>
                    {totalValue > 0 && (
                        <div className="text-right">
                            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                                Valor total estimado
                            </p>
                            <p className="text-lg font-bold" style={{ color: "var(--color-success)" }}>
                                {formatCurrency(totalValue)}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                {items.map((item) => (
                    <div key={item.id} className="card p-5">
                        <div className="flex items-start gap-4">
                            <div className="shrink-0 w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                                <span className="text-sm font-bold text-emerald-500">{item.numero_item}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium mb-2 leading-relaxed" style={{ color: "var(--color-text-primary)" }}>
                                    {item.descricao || "Sem descrição"}
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <InfoCell
                                        label="Quantidade"
                                        value={
                                            item.quantidade != null
                                                ? `${item.quantidade} ${item.unidade_medida || ""}`
                                                : "—"
                                        }
                                    />
                                    <InfoCell
                                        label="Valor Unitário"
                                        value={
                                            item.valor_unitario_estimado != null && !item.orcamento_sigiloso
                                                ? formatCurrency(item.valor_unitario_estimado)
                                                : "—"
                                        }
                                    />
                                    <InfoCell
                                        label="Valor Total"
                                        value={
                                            item.valor_total != null && !item.orcamento_sigiloso
                                                ? formatCurrency(item.valor_total)
                                                : "—"
                                        }
                                    />
                                    <InfoCell label="Categoria" value={item.item_categoria_nome || "—"} />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function DocumentsTabWithoutAI({
    documents,
    cnpjOrgao,
    anoCompra,
    sequencialCompra,
}: {
    documents: ResultDocument[];
    cnpjOrgao: string;
    anoCompra: number;
    sequencialCompra: number;
}) {
    if (documents.length === 0) {
        return (
            <div className="card p-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" style={{ color: "var(--color-text-muted)" }} />
                <p style={{ color: "var(--color-text-secondary)" }}>
                    Nenhum documento encontrado para este edital.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="card p-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                        <FileText className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                            Documentos disponíveis
                        </p>
                        <p className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
                            {documents.length}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {documents.map((doc) => {
                    const downloadUrl = doc.url || doc.uri;
                    return (
                        <div key={doc.id} className="card p-4">
                            <div className="flex items-start gap-3">
                                <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    📄
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium truncate mb-1" style={{ color: "var(--color-text-primary)" }}>
                                        {doc.titulo || "Documento sem título"}
                                    </h4>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {doc.tipo_documento_nome && (
                                            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                                {doc.tipo_documento_nome}
                                            </span>
                                        )}
                                        {doc.data_publicacao_pncp && (
                                            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                                • {formatDate(doc.data_publicacao_pncp)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {downloadUrl && (
                                    <a
                                        href={downloadUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 rounded-lg hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"
                                        style={{ color: "var(--color-text-muted)" }}
                                        title="Baixar documento"
                                    >
                                        <Download className="w-4 h-4" />
                                    </a>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="card p-4">
                <a
                    href={`https://pncp.gov.br/app/editais/${cnpjOrgao}/${anoCompra}/${sequencialCompra}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                    <ExternalLink className="w-4 h-4" />
                    Ver todos os documentos no Portal PNCP
                    <ChevronRight className="w-3 h-3" />
                </a>
            </div>
        </div>
    );
}

function EditalDetailsTab({ analysis }: { analysis: EditalAnalysis | null }) {
    if (!analysis) {
        return (
            <div className="card p-6">
                <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>
                    Detalhes do Edital
                </h3>
                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                    Este edital ainda não possui uma análise salva de detalhes com IA.
                </p>
            </div>
        );
    }

    const data = analysis.analysis_data as EditalAnalysisData | null;
    if (!data) {
        return (
            <div className="card p-6">
                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                    Dados da análise não estão disponíveis.
                </p>
            </div>
        );
    }

    const analysisTags = getAnalysisTags(data);
    const orgao = data.orgao || {};
    const licitacao = data.licitacao || {};
    const valores = data.valores || {};
    const datas = data.datas || {};
    const entrega = data.entrega || {};
    const pagamento = data.pagamento || {};
    const contatos = data.contatos || {};
    const hab = data.habilitacao || {};
    const technicalItems = getTechnicalQualificationItems(data);
    const hasNoTechnicalRequirement = hasNoTechnicalQualificationRequirement(data);
    const itens = Array.isArray(data.itens) ? data.itens : [];
    const obs = Array.isArray(data.observacoes) ? data.observacoes : [];

    const fmtCur = (value: number | null | undefined) => {
        if (value === null || value === undefined) return "—";
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    };

    return (
        <div className="space-y-6">
            <div className="card p-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ background: "rgba(99,102,241,0.1)" }}>
                        <Bot className="w-5 h-5" style={{ color: "var(--color-primary)" }} />
                    </div>
                    <div>
                        <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                            Análise gerada por IA
                        </p>
                        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                            {analysis.llm_model} · {analysis.tokens_used?.toLocaleString()} tokens ·{" "}
                            {((analysis.processing_time_ms || 0) / 1000).toFixed(1)}s · {analysis.page_count} páginas
                        </p>
                    </div>
                </div>
            </div>

            {data.objeto_resumo && (
                <div className="card p-5" style={{ borderLeft: "3px solid var(--color-primary)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-primary)" }}>
                        Objeto da Contratação
                    </p>
                    <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>
                        {data.objeto_detalhado || data.objeto_resumo}
                    </p>
                </div>
            )}

            {analysisTags.length > 0 && (
                <div className="card p-5">
                    <h4 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-secondary)" }}>
                        Tags
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {analysisTags.map((tag) => {
                            const isOpportunity = tag.toLocaleLowerCase("pt-BR") === "oportunidade";
                            return (
                                <span
                                    key={tag}
                                    className="badge border"
                                    style={
                                        isOpportunity
                                            ? {
                                                background: "rgba(16, 185, 129, 0.12)",
                                                color: "#34D399",
                                                borderColor: "rgba(16, 185, 129, 0.35)",
                                            }
                                            : {
                                                background: "var(--color-bg-tertiary)",
                                                color: "var(--color-text-secondary)",
                                                borderColor: "var(--color-border)",
                                            }
                                    }
                                >
                                    {tag}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Building2 className="w-4 h-4 text-emerald-500" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                            Órgão
                        </h4>
                    </div>
                    <InfoRow label="Nome" value={orgao.nome} />
                    <InfoRow label="CNPJ" value={orgao.cnpj} />
                    <InfoRow label="UF" value={orgao.uf} />
                    <InfoRow label="Município" value={orgao.municipio} />
                </div>

                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Gavel className="w-4 h-4 text-emerald-500" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                            Licitação
                        </h4>
                    </div>
                    <InfoRow label="Modalidade" value={licitacao.modalidade} />
                    <InfoRow label="Modo de Disputa" value={licitacao.modo_disputa} />
                    <InfoRow label="Nº Processo" value={licitacao.numero_processo} />
                    <InfoRow label="Critério" value={licitacao.criterio_julgamento} />
                    <InfoRow label="SRP" value={licitacao.srp} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                            Valores
                        </h4>
                    </div>
                    <InfoRow label="Valor Total Estimado" value={fmtCur(valores.valor_total_estimado)} />
                    <InfoRow
                        label="Valor Máximo Aceitável"
                        value={valores.valor_maximo_aceitavel ? fmtCur(valores.valor_maximo_aceitavel) : null}
                    />
                </div>

                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                            Datas
                        </h4>
                    </div>
                    <InfoRow label="Publicação" value={datas.publicacao} />
                    <InfoRow label="Abertura Propostas" value={datas.abertura_propostas} />
                    <InfoRow label="Início Disputa" value={datas.inicio_disputa} />
                </div>
            </div>

            {itens.length > 0 && (
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Package className="w-4 h-4 text-blue-400" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                            Itens ({itens.length})
                        </h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ borderBottom: "2px solid var(--color-border)" }}>
                                    <th className="text-left py-2 px-2 font-medium" style={{ color: "var(--color-text-muted)" }}>
                                        #
                                    </th>
                                    <th className="text-left py-2 px-2 font-medium" style={{ color: "var(--color-text-muted)" }}>
                                        Descrição / Especificação
                                    </th>
                                    <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--color-text-muted)" }}>
                                        Qtd
                                    </th>
                                    <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--color-text-muted)" }}>
                                        Vlr. Unit.
                                    </th>
                                    <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--color-text-muted)" }}>
                                        Vlr. Total
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {itens.map((item: EditalAnalysisItemData, idx: number) => (
                                    <tr key={idx} style={{ borderBottom: "1px solid var(--color-border)" }}>
                                        <td className="py-3 px-2 align-top" style={{ color: "var(--color-text-muted)" }}>
                                            {item.numero || idx + 1}
                                        </td>
                                        <td className="py-3 px-2 align-top">
                                            <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                                                {item.descricao}
                                            </p>
                                            {item.especificacao_tecnica && (
                                                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                                                    {item.especificacao_tecnica}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                {item.grupo_lote && (
                                                    <span
                                                        className="text-xs px-1.5 py-0.5 rounded"
                                                        style={{ background: "rgba(99,102,241,0.1)", color: "var(--color-primary)" }}
                                                    >
                                                        Lote: {item.grupo_lote}
                                                    </span>
                                                )}
                                                {item.marca_referencia && (
                                                    <span
                                                        className="text-xs px-1.5 py-0.5 rounded"
                                                        style={{ background: "rgba(245,158,11,0.1)", color: "var(--color-warning)" }}
                                                    >
                                                        Ref: {item.marca_referencia}
                                                    </span>
                                                )}
                                                {item.ncm && (
                                                    <span
                                                        className="text-xs px-1.5 py-0.5 rounded"
                                                        style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)" }}
                                                    >
                                                        NCM: {item.ncm}
                                                    </span>
                                                )}
                                                {item.catmat_catser && (
                                                    <span
                                                        className="text-xs px-1.5 py-0.5 rounded"
                                                        style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)" }}
                                                    >
                                                        {item.catmat_catser}
                                                    </span>
                                                )}
                                                {item.exclusivo_me_epp && (
                                                    <span
                                                        className="text-xs px-1.5 py-0.5 rounded"
                                                        style={{ background: "rgba(34,197,94,0.1)", color: "var(--color-success)" }}
                                                    >
                                                        ME/EPP
                                                    </span>
                                                )}
                                                {item.amostra_exigida && (
                                                    <span
                                                        className="text-xs px-1.5 py-0.5 rounded"
                                                        style={{ background: "rgba(239,68,68,0.1)", color: "var(--color-danger)" }}
                                                    >
                                                        Amostra
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-2 text-right align-top" style={{ color: "var(--color-text-primary)" }}>
                                            {item.quantidade ?? "—"} {item.unidade || ""}
                                        </td>
                                        <td className="py-3 px-2 text-right align-top" style={{ color: "var(--color-text-primary)" }}>
                                            {fmtCur(item.valor_unitario_estimado)}
                                        </td>
                                        <td
                                            className="py-3 px-2 text-right align-top font-medium"
                                            style={{ color: "var(--color-primary)" }}
                                        >
                                            {fmtCur(item.valor_total_estimado)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="card p-5" style={{ borderLeft: "3px solid var(--color-primary)" }}>
                <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                        Qualificação Técnica Exigida
                    </h4>
                </div>

                {hasNoTechnicalRequirement ? (
                    <div
                        className="p-3 rounded-lg"
                        style={{
                            background: "rgba(16, 185, 129, 0.08)",
                            border: "1px solid rgba(16, 185, 129, 0.2)",
                        }}
                    >
                        <p className="text-sm" style={{ color: "var(--color-success)" }}>
                            Não há exigência de atestado de capacidade técnica ou documentação técnica específica.
                        </p>
                    </div>
                ) : technicalItems.length > 0 ? (
                    <ul className="space-y-2">
                        {technicalItems.map((item: string, index: number) => (
                            <li
                                key={`${index}-${item.slice(0, 24)}`}
                                className="flex items-start gap-2 text-sm"
                                style={{ color: "var(--color-text-primary)" }}
                            >
                                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--color-success)" }} />
                                <span className="whitespace-pre-wrap">{item}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                        A análise não encontrou detalhes suficientes sobre qualificação técnica.
                    </p>
                )}
            </div>

            {["juridica", "fiscal", "trabalhista", "economica"].some(
                (key) => Array.isArray(hab[key]) && hab[key].length > 0
            ) && (
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <ShieldCheck className="w-4 h-4 text-green-400" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                            Habilitação
                        </h4>
                    </div>
                    {["juridica", "fiscal", "trabalhista", "economica"].map((key) => {
                        const items = hab[key] || [];
                        if (items.length === 0) return null;
                        const labels: Record<string, string> = {
                            juridica: "Jurídica",
                            fiscal: "Fiscal",
                            trabalhista: "Trabalhista",
                            economica: "Econômico-Financeira",
                        };
                        return (
                            <div key={key} className="mb-3">
                                <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>
                                    {labels[key]}
                                </p>
                                <ul className="space-y-1">
                                    {items.map((item: string, i: number) => (
                                        <li
                                            key={i}
                                            className="flex items-start gap-2 text-xs"
                                            style={{ color: "var(--color-text-secondary)" }}
                                        >
                                            <CheckCircle2
                                                className="w-3 h-3 flex-shrink-0 mt-0.5"
                                                style={{ color: "var(--color-success)" }}
                                            />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            )}

            {(entrega.prazo || pagamento.condicoes) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {entrega.prazo && (
                        <div className="card p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Truck className="w-4 h-4 text-blue-400" />
                                <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                                    Entrega
                                </h4>
                            </div>
                            <InfoRow label="Prazo" value={entrega.prazo} />
                            <InfoRow label="Local" value={entrega.local} />
                        </div>
                    )}
                    {pagamento.condicoes && (
                        <div className="card p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <CreditCard className="w-4 h-4 text-green-400" />
                                <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                                    Pagamento
                                </h4>
                            </div>
                            <InfoRow label="Condições" value={pagamento.condicoes} />
                            <InfoRow label="Prazo" value={pagamento.prazo} />
                        </div>
                    )}
                </div>
            )}

            {obs.length > 0 && (
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                            Pontos de Atenção
                        </h4>
                    </div>
                    <div className="space-y-2">
                        {obs.map((item: string, i: number) => (
                            <div
                                key={i}
                                className="flex items-start gap-2 p-3 rounded-lg"
                                style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}
                            >
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
                                <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>
                                    {item}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {(contatos.pregoeiro || contatos.email) && (
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="w-4 h-4 text-emerald-500" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                            Contatos
                        </h4>
                    </div>
                    {contatos.pregoeiro && <InfoRow label="Pregoeiro" value={contatos.pregoeiro} />}
                    {contatos.email && <InfoRow label="Email" value={contatos.email} />}
                    {contatos.telefone && <InfoRow label="Telefone" value={contatos.telefone} />}
                </div>
            )}
        </div>
    );
}

function FinancialTab({
    rows,
    loading,
    savingItemId,
    onChange,
    onSave,
}: {
    rows: { row: DisputeItemFinancialRow; draft: DisputeItemFinancialInput }[];
    loading: boolean;
    savingItemId: string | null;
    onChange: (resultItemId: string, field: keyof DisputeItemFinancialInput, rawValue: string) => void;
    onSave: (row: DisputeItemFinancialRow) => Promise<void>;
}) {
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    const editingEntry = useMemo(
        () => rows.find(({ row }) => row.result_item_id === editingItemId) ?? null,
        [editingItemId, rows]
    );

    if (loading) {
        return (
            <div className="card p-10 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "var(--color-primary)" }} />
                <p style={{ color: "var(--color-text-secondary)" }}>Carregando itens da análise financeira...</p>
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="card p-10 text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
                <p style={{ color: "var(--color-text-secondary)" }}>
                    Nenhum item encontrado para calcular análise financeira.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="card p-4">
                <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
                    Cálculo de preço de venda por item
                </h3>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Informe os custos do item e a alíquota de imposto para gerar os cenários de margem líquida.
                </p>
            </div>

            {rows.map(({ row, draft }) => {
                const denominatorAlert = 1 - draft.aliquota_imposto_percentual / 100 - 0.35 <= 0;
                const hasFinancial = Boolean(row.financial);
                return (
                    <div key={row.result_item_id} className="card p-5">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <h4 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                    Item {row.numero_item}
                                </h4>
                                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                                    {row.descricao || "Sem descrição"}
                                </p>
                                {row.quantidade != null && (
                                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                                        Quantidade: {row.quantidade} {row.unidade_medida || ""}
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={() => setEditingItemId(row.result_item_id)}
                                disabled={savingItemId === row.result_item_id}
                                className="btn-primary !px-3 !py-2 disabled:opacity-60"
                            >
                                {hasFinancial ? (
                                    "Editar custos"
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Informar custos
                                    </>
                                )}
                            </button>
                        </div>

                        {denominatorAlert && (
                            <div
                                className="rounded-lg p-3 mb-3"
                                style={{
                                    background: "rgba(245, 158, 11, 0.08)",
                                    border: "1px solid rgba(245, 158, 11, 0.25)",
                                }}
                            >
                                <p className="text-xs" style={{ color: "var(--color-warning)" }}>
                                    Com esta alíquota, o cálculo para margem de 35% pode ficar inválido.
                                </p>
                            </div>
                        )}

                        {row.financial && (
                            <div className="rounded-xl p-4" style={{ background: "var(--color-bg-secondary)" }}>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                        Cenários calculados
                                    </p>
                                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                        Custos totais: {formatCurrency(row.financial.custos_totais)}
                                    </p>
                                </div>
                                <div className="overflow-x-auto hidden md:block">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                                                <th className="text-left py-2" style={{ color: "var(--color-text-muted)" }}>Margem</th>
                                                <th className="text-right py-2" style={{ color: "var(--color-text-muted)" }}>Preço de Venda</th>
                                                <th className="text-right py-2" style={{ color: "var(--color-text-muted)" }}>Imposto Estimado</th>
                                                <th className="text-right py-2" style={{ color: "var(--color-text-muted)" }}>Lucro Líquido</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {row.financial.precos_sugeridos.map((scenario) => (
                                                <tr key={scenario.margem_percentual} style={{ borderBottom: "1px solid var(--color-border)" }}>
                                                    <td className="py-2" style={{ color: "var(--color-text-primary)" }}>
                                                        {scenario.margem_percentual.toFixed(0)}%
                                                    </td>
                                                    <td className="py-2 text-right font-semibold" style={{ color: "var(--color-success)" }}>
                                                        {formatCurrency(scenario.preco_venda)}
                                                    </td>
                                                    <td className="py-2 text-right" style={{ color: "var(--color-text-secondary)" }}>
                                                        {formatCurrency(scenario.imposto_estimado)}
                                                    </td>
                                                    <td className="py-2 text-right" style={{ color: "var(--color-text-primary)" }}>
                                                        {formatCurrency(scenario.lucro_liquido_estimado)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="md:hidden space-y-2">
                                    {row.financial.precos_sugeridos.map((scenario) => (
                                        <div
                                            key={scenario.margem_percentual}
                                            className="rounded-lg p-3"
                                            style={{
                                                background: "var(--color-bg-card)",
                                                border: "1px solid var(--color-border)",
                                            }}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
                                                    Margem alvo
                                                </span>
                                                <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                                    {scenario.margem_percentual.toFixed(0)}%
                                                </span>
                                            </div>
                                            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Preço de venda</p>
                                            <p className="text-base font-semibold mb-2" style={{ color: "var(--color-success)" }}>
                                                {formatCurrency(scenario.preco_venda)}
                                            </p>
                                            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                                Imposto: {formatCurrency(scenario.imposto_estimado)}
                                            </p>
                                            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                                Lucro líquido: {formatCurrency(scenario.lucro_liquido_estimado)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            <FinancialInputModal
                open={Boolean(editingItemId && editingEntry)}
                row={editingEntry?.row ?? null}
                draft={editingEntry?.draft ?? emptyDraft()}
                saving={Boolean(editingEntry && savingItemId === editingEntry.row.result_item_id)}
                onClose={() => setEditingItemId(null)}
                onChange={(field, value) => {
                    if (!editingEntry) return;
                    onChange(editingEntry.row.result_item_id, field, value);
                }}
                onSave={async () => {
                    if (!editingEntry) return;
                    await onSave(editingEntry.row);
                    setEditingItemId(null);
                }}
            />
        </div>
    );
}

function FinancialInputModal({
    open,
    row,
    draft,
    saving,
    onClose,
    onChange,
    onSave,
}: {
    open: boolean;
    row: DisputeItemFinancialRow | null;
    draft: DisputeItemFinancialInput;
    saving: boolean;
    onClose: () => void;
    onChange: (field: keyof DisputeItemFinancialInput, value: string) => void;
    onSave: () => Promise<void>;
}) {
    if (!open || !row) return null;

    const denominatorAlert = 1 - draft.aliquota_imposto_percentual / 100 - 0.35 <= 0;

    return (
        <ModalPortal>
            <div
                className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
                style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            >
                <button
                    type="button"
                    className="absolute inset-0"
                    aria-label="Fechar modal de análise financeira"
                    onClick={!saving ? onClose : undefined}
                    onKeyDown={(event) => {
                        if ((event.key === "Enter" || event.key === " ") && !saving) {
                            event.preventDefault();
                            onClose();
                        }
                    }}
                />
                <div
                    className="rounded-t-2xl md:rounded-2xl shadow-2xl w-full h-[100dvh] md:h-auto md:max-w-3xl md:mx-4 overflow-hidden flex flex-col"
                    style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}
                >
                    <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <div>
                            <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                Análise Financeira • Item {row.numero_item}
                            </h3>
                            <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
                                {row.descricao || "Sem descrição"}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={saving}
                            className="p-1.5 rounded-lg disabled:opacity-50"
                            style={{ color: "var(--color-text-muted)" }}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-5 overflow-y-auto flex-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <FinancialField
                                label="Preço do fornecedor (R$)"
                                value={draft.preco_fornecedor}
                                onChange={(value) => onChange("preco_fornecedor", value)}
                            />
                            <FinancialField
                                label="Mão de Obra (R$)"
                                value={draft.mao_obra}
                                onChange={(value) => onChange("mao_obra", value)}
                            />
                            <FinancialField
                                label="Materiais de consumo (R$)"
                                value={draft.materiais_consumo}
                                onChange={(value) => onChange("materiais_consumo", value)}
                            />
                            <FinancialField
                                label="Equipamentos (R$)"
                                value={draft.equipamentos}
                                onChange={(value) => onChange("equipamentos", value)}
                            />
                            <FinancialField
                                label="Frete e Logística (R$)"
                                value={draft.frete_logistica}
                                onChange={(value) => onChange("frete_logistica", value)}
                            />
                            <FinancialField
                                label="Alíquota de Imposto (%)"
                                value={draft.aliquota_imposto_percentual}
                                onChange={(value) => onChange("aliquota_imposto_percentual", value)}
                                isPercent
                            />
                        </div>

                        {denominatorAlert && (
                            <div
                                className="rounded-lg p-3 mt-3"
                                style={{
                                    background: "rgba(245, 158, 11, 0.08)",
                                    border: "1px solid rgba(245, 158, 11, 0.25)",
                                }}
                            >
                                <p className="text-xs" style={{ color: "var(--color-warning)" }}>
                                    Com esta alíquota, o cálculo para margem de 35% pode ficar inválido.
                                </p>
                            </div>
                        )}
                    </div>

                    <div
                        className="flex items-center justify-end gap-2 p-5 sticky bottom-0"
                        style={{ borderTop: "1px solid var(--color-border)" }}
                    >
                        <button onClick={onClose} disabled={saving} className="btn-ghost !px-4 !py-2">
                            Cancelar
                        </button>
                        <button onClick={onSave} disabled={saving} className="btn-primary !px-4 !py-2 disabled:opacity-60">
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Salvar e calcular
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
}

function FinancialField({
    label,
    value,
    onChange,
    isPercent = false,
}: {
    label: string;
    value: number;
    onChange: (value: string) => void;
    isPercent?: boolean;
}) {
    return (
        <label className="block">
            <span className="text-xs mb-1 block" style={{ color: "var(--color-text-muted)" }}>
                {label}
            </span>
            <input
                type="number"
                min={0}
                step={isPercent ? 0.01 : 0.01}
                value={Number.isFinite(value) ? value : 0}
                onChange={(event) => onChange(event.target.value)}
                aria-label={label}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                    background: "var(--color-bg-secondary)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                }}
            />
        </label>
    );
}

function FinancialProgressModal({
    state,
    onClose,
}: {
    state: FinancialModalState;
    onClose: () => void;
}) {
    if (!state.open) return null;

    const currentIndex = Math.min(state.stage, FINANCIAL_PROGRESS_STEPS.length - 1);
    const progress = state.status === "success" ? 100 : FINANCIAL_PROGRESS_STEPS[currentIndex].pct;

    return (
        <ModalPortal>
            <div
                className="fixed inset-0 z-50 flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            >
                <button
                    type="button"
                    className="absolute inset-0"
                    aria-label="Fechar progresso da análise financeira"
                    onClick={state.status !== "running" ? onClose : undefined}
                    onKeyDown={(event) => {
                        if ((event.key === "Enter" || event.key === " ") && state.status !== "running") {
                            event.preventDefault();
                            onClose();
                        }
                    }}
                />
                <div
                    className="rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
                    style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}
                >
                    <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <div className="flex items-center gap-3">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))" }}
                            >
                                <TrendingUp className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                    Análise Financeira
                                </h3>
                                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                    {state.itemLabel}
                                </p>
                            </div>
                        </div>
                        {state.status !== "running" && (
                            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "var(--color-text-muted)" }}>
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="p-5">
                        {state.status === "error" ? (
                            <div className="text-center py-3">
                                <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-danger)" }} />
                                <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>
                                    {state.error || "Falha ao processar análise financeira."}
                                </p>
                                <button onClick={onClose} className="btn-ghost mt-4">
                                    Fechar
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--color-bg-tertiary)" }}>
                                    <div
                                        className="h-full rounded-full transition-all duration-700 ease-out"
                                        style={{
                                            width: `${progress}%`,
                                            background: "linear-gradient(90deg, var(--color-primary), var(--color-primary-hover))",
                                        }}
                                    />
                                </div>

                                <div className="space-y-2">
                                    {FINANCIAL_PROGRESS_STEPS.map((step, index) => (
                                        <div key={step.label} className="flex items-center gap-2.5">
                                            {index < state.stage || state.status === "success" ? (
                                                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-success)" }} />
                                            ) : index === state.stage && state.status === "running" ? (
                                                <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: "var(--color-primary)" }} />
                                            ) : (
                                                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ border: "2px solid var(--color-border)" }} />
                                            )}
                                            <span className="text-sm" style={{ color: index <= state.stage ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>
                                                {step.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {state.status === "success" && (
                                    <div
                                        className="p-3 rounded-lg flex items-center gap-2"
                                        style={{
                                            background: "rgba(34, 197, 94, 0.08)",
                                            border: "1px solid rgba(34, 197, 94, 0.2)",
                                        }}
                                    >
                                        <CheckCircle2 className="w-4 h-4" style={{ color: "var(--color-success)" }} />
                                        <p className="text-sm" style={{ color: "var(--color-success)" }}>
                                            Análise financeira salva com sucesso.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
}

function StatMini({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string;
    value: string;
    icon: typeof CreditCard;
    color: "green" | "blue" | "emerald" | "yellow";
}) {
    const colorMap: Record<string, string> = {
        green: "bg-green-500/10 text-green-400",
        blue: "bg-blue-500/10 text-blue-400",
        emerald: "bg-emerald-500/10 text-emerald-500",
        yellow: "bg-yellow-500/10 text-yellow-400",
    };

    return (
        <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{
                background: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border)",
            }}
        >
            <div className={`p-2 rounded-lg ${colorMap[color]}`}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
                <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                    {label}
                </p>
                <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                    {value}
                </p>
            </div>
        </div>
    );
}

function InfoCell({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {label}
            </span>
            <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                {value}
            </p>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
    const display = value == null ? "—" : typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value);
    return (
        <div className="flex items-baseline justify-between py-1.5" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {label}
            </span>
            <span className="text-sm font-medium text-right max-w-[60%]" style={{ color: "var(--color-text-primary)" }}>
                {display}
            </span>
        </div>
    );
}

function formatCNPJ(cnpj: string): string {
    if (!cnpj || cnpj.length !== 14) return cnpj;
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
