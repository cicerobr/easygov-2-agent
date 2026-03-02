"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    api,
    type PaginatedResults,
    type DisputeHighlightsResponse,
    type DisputeStats,
    type DisputeUrgencyState,
} from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
    Scale,
    ChevronLeft,
    ChevronRight,
    Building2,
    Calendar,
    ExternalLink,
    ArrowRight,
    AlarmClock,
    PlayCircle,
    AlertTriangle,
    Clock3,
} from "lucide-react";
import { SkeletonList } from "@/components/skeleton";
import { InteractiveCard } from "@/components/interactive-card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import {
    getKeywordScopeBadgeClass,
    getKeywordScopeLabel,
    summarizeKeywordEvidence,
} from "@/lib/keyword-evidence";

type DisputeTab = "em_disputa" | "vencidos" | "perdidos";

const TAB_LABELS: Record<DisputeTab, string> = {
    em_disputa: "Em Disputa",
    vencidos: "Vencidos",
    perdidos: "Perdidos",
};

const STATUS_BADGE: Record<DisputeTab, string> = {
    em_disputa: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    vencidos: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    perdidos: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

function formatCountdown(totalSeconds: number | null | undefined): string | null {
    if (typeof totalSeconds !== "number") return null;
    const seconds = Math.abs(Math.floor(totalSeconds));
    if (seconds < 60) return `${seconds}s`;

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;

    if (days > 0) {
        return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
    }
    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
    }
    return `${minutes}min`;
}

function getUrgencyLabel(
    urgencyState: DisputeUrgencyState | null | undefined,
    timeToOpenSeconds: number | null | undefined,
    timeToCloseSeconds: number | null | undefined
): { label: string; className: string } {
    switch (urgencyState) {
        case "upcoming":
            return {
                label: `Abre em ${formatCountdown(timeToOpenSeconds) ?? "instantes"}`,
                className: "bg-sky-500/20 text-sky-300 border-sky-500/30",
            };
        case "closing_soon":
            return {
                label: `Aberto • Encerra em ${formatCountdown(timeToCloseSeconds) ?? "breve"}`,
                className: "bg-rose-500/20 text-rose-300 border-rose-500/30",
            };
        case "open":
            return {
                label: timeToCloseSeconds != null
                    ? `Aberto • Encerra em ${formatCountdown(timeToCloseSeconds) ?? "breve"}`
                    : "Aberto",
                className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
            };
        case "closed_window":
            return {
                label: "Prazo encerrado",
                className: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
            };
        default:
            return {
                label: "Data não informada",
                className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
            };
    }
}

function DisputasPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = useMemo<DisputeTab>(() => {
        const queryTab = searchParams.get("tab");
        if (queryTab === "vencidos" || queryTab === "perdidos" || queryTab === "em_disputa") {
            return queryTab;
        }
        return "em_disputa";
    }, [searchParams]);

    const [tab, setTab] = useState<DisputeTab>(initialTab);
    const [stats, setStats] = useState<DisputeStats | null>(null);
    const [results, setResults] = useState<PaginatedResults | null>(null);
    const [highlights, setHighlights] = useState<DisputeHighlightsResponse | null>(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [statsData, listData, highlightsData] = await Promise.all([
                api.getDisputeStats(),
                api.listDisputes({ tab, page, page_size: 15 }),
                tab === "em_disputa" ? api.getDisputeHighlights("em_disputa", 5) : Promise.resolve(null),
            ]);
            setStats(statsData);
            setResults(listData);
            setHighlights(highlightsData);
        } finally {
            setLoading(false);
        }
    }, [tab, page]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        setTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        setPage(1);
    }, [tab]);

    useEffect(() => {
        const currentTab = searchParams.get("tab");
        if (currentTab === tab) return;
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", tab);
        router.replace(`/disputas?${params.toString()}`);
    }, [router, searchParams, tab]);

    return (
        <div className="max-w-5xl mx-auto">
            <PageHeader
                title="Disputas"
                subtitle={`${stats?.total ?? 0} edital(is) no fluxo de disputas`}
            />

            <div className="flex gap-1 mb-6 rounded-xl p-1" style={{ background: "var(--color-bg-secondary)" }}>
                {(Object.keys(TAB_LABELS) as DisputeTab[]).map((key) => {
                    const count =
                        key === "em_disputa"
                            ? stats?.em_disputa || 0
                            : key === "vencidos"
                                ? stats?.vencidos || 0
                                : stats?.perdidos || 0;
                    return (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${tab === key ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : ""
                                }`}
                            style={tab !== key ? { color: "var(--color-text-secondary)" } : undefined}
                        >
                            {TAB_LABELS[key]}
                            <span
                                className={`px-2 py-0.5 rounded-full text-xs font-bold ${tab === key ? "bg-white/20 text-white" : "bg-emerald-500/20 text-emerald-500"
                                    }`}
                            >
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {!loading && tab === "em_disputa" && highlights && (
                <section className="mb-6 space-y-3">
                    <h2
                        className="text-sm font-semibold"
                        style={{ color: "var(--color-text-secondary)" }}
                    >
                        Radar de Prazos
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="card !p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                                        Próximas Aberturas (24h)
                                    </p>
                                    <p className="text-2xl font-bold mt-1">{highlights.summary.upcoming_24h_count}</p>
                                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                                        {highlights.summary.next_opening_at
                                            ? `Próxima: ${formatDateTime(highlights.summary.next_opening_at)}`
                                            : "Sem abertura prevista"}
                                    </p>
                                </div>
                                <AlarmClock className="w-4 h-4 text-sky-300" />
                            </div>
                        </div>
                        <div className="card !p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                                        Aberto Agora
                                    </p>
                                    <p className="text-2xl font-bold mt-1">{highlights.summary.open_now_count}</p>
                                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                                        Editais com envio em andamento
                                    </p>
                                </div>
                                <PlayCircle className="w-4 h-4 text-emerald-300" />
                            </div>
                        </div>
                        <div className="card !p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                                        Fechamento Crítico (24h)
                                    </p>
                                    <p className="text-2xl font-bold mt-1">{highlights.summary.closing_24h_count}</p>
                                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                                        Priorize os que encerram primeiro
                                    </p>
                                </div>
                                <AlertTriangle className="w-4 h-4 text-rose-300" />
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {loading ? (
                <SkeletonList count={4} />
            ) : results?.data.length === 0 ? (
                <EmptyState
                    icon={Scale}
                    title={`Nenhum edital em ${TAB_LABELS[tab].toLowerCase()}`}
                />
            ) : (
                <>
                    <div className="space-y-3">
                        {results?.data.map((result, i) => {
                            const matchScopeLabel = getKeywordScopeLabel(result.keyword_match_scope);
                            const matchEvidenceSummary = summarizeKeywordEvidence(result.keyword_match_evidence);
                            const urgency = getUrgencyLabel(
                                result.urgency_state,
                                result.time_to_open_seconds,
                                result.time_to_close_seconds
                            );
                            return (
                            <InteractiveCard
                                key={result.id}
                                className={`card card-interactive !p-4 stagger-${Math.min(i + 1, 10)} animate-in`}
                                style={{ animationFillMode: "both", opacity: 0 }}
                                onActivate={() => router.push(`/disputas/${result.id}`)}
                                ariaLabel={`Abrir disputa ${result.objeto_compra || result.numero_controle_pncp}`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`badge border ${STATUS_BADGE[tab]}`}>{TAB_LABELS[tab]}</span>
                                            {tab === "em_disputa" && (
                                                <span className={`badge border ${urgency.className}`}>
                                                    {urgency.label}
                                                </span>
                                            )}
                                            {result.codigo_unidade_compradora && (
                                                <span className="badge" style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)" }}>
                                                    Unidade: {result.codigo_unidade_compradora}
                                                </span>
                                            )}
                                            {matchScopeLabel && (
                                                <span className={`badge ${getKeywordScopeBadgeClass(result.keyword_match_scope)}`}>
                                                    Match: {matchScopeLabel}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-sm font-semibold mb-1 leading-snug" style={{ color: "var(--color-text-primary)" }}>
                                            {result.objeto_compra || "Sem descrição"}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                                            <span className="inline-flex items-center gap-1">
                                                <Building2 className="w-3 h-3" />
                                                {result.orgao_nome || result.cnpj_orgao}
                                            </span>
                                            {tab === "em_disputa" && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock3 className="w-3 h-3" />
                                                    {result.urgency_state === "upcoming"
                                                        ? `Abre: ${formatDateTime(result.data_abertura_proposta)}`
                                                        : `Limite: ${formatDateTime(result.data_encerramento_proposta)}`}
                                                </span>
                                            )}
                                            {result.data_abertura_proposta && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    Início: {formatDateTime(result.data_abertura_proposta)}
                                                </span>
                                            )}
                                            {result.data_encerramento_proposta && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    Fim: {formatDateTime(result.data_encerramento_proposta)}
                                                </span>
                                            )}
                                            {result.valor_total_estimado != null && (
                                                <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
                                                    {formatCurrency(result.valor_total_estimado)}
                                                </span>
                                            )}
                                        </div>
                                        {matchEvidenceSummary && (
                                            <p className="mt-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                                                {matchEvidenceSummary}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {result.link_sistema_origem && (
                                            <a
                                                href={result.link_sistema_origem}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-ghost !p-2"
                                                onClick={(event) => event.stopPropagation()}
                                                title="Abrir no PNCP"
                                                aria-label="Abrir edital no PNCP"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        )}
                                        <button
                                            className="btn-ghost !py-1.5 !px-3"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                router.push(`/disputas/${result.id}`);
                                            }}
                                            title="Ver detalhes da disputa"
                                            aria-label="Ver detalhes da disputa"
                                        >
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </InteractiveCard>
                            );
                        })}
                    </div>

                    {results && results.total_pages > 1 && (
                        <div className="flex items-center justify-center gap-4 mt-8">
                            <button
                                className="btn-ghost"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                <ChevronLeft className="w-4 h-4" /> Anterior
                            </button>
                            <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                                Página {page} de {results.total_pages}
                            </span>
                            <button
                                className="btn-ghost"
                                onClick={() => setPage((p) => Math.min(results.total_pages, p + 1))}
                                disabled={page >= results.total_pages}
                            >
                                Próxima <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default function DisputasPage() {
    return (
        <Suspense fallback={<div className="max-w-5xl mx-auto" />}>
            <DisputasPageContent />
        </Suspense>
    );
}
