"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, type PaginatedResults } from "@/lib/api";
import { hasOpportunityTag } from "@/lib/analysis-tags";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
    Bookmark,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Building2,
    MapPin,
    Calendar,
    DollarSign,
    FileText,
    Trash2,
    ArrowRight,
    Scale,
} from "lucide-react";
import { useToast } from "@/components/toast";
import { SkeletonList } from "@/components/skeleton";
import { ConfirmModal } from "@/components/confirm-modal";
import { InteractiveCard } from "@/components/interactive-card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import {
    getKeywordScopeBadgeClass,
    getKeywordScopeLabel,
    summarizeKeywordEvidence,
} from "@/lib/keyword-evidence";

export default function SalvosPage() {
    const router = useRouter();
    const toast = useToast();
    const [results, setResults] = useState<PaginatedResults | null>(null);
    const [opportunityByResultId, setOpportunityByResultId] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [discardTarget, setDiscardTarget] = useState<{
        id: string;
        objeto: string | null;
    } | null>(null);
    const [discardingId, setDiscardingId] = useState<string | null>(null);
    const [disputingId, setDisputingId] = useState<string | null>(null);

    const removeSavedResultFromState = useCallback((resultId: string) => {
        setResults((prev) => {
            if (!prev) return prev;
            const filteredData = prev.data.filter((item) => item.id !== resultId);
            const removedCount = prev.data.length - filteredData.length;
            if (removedCount === 0) return prev;
            const nextTotal = Math.max(0, prev.total - removedCount);
            if (nextTotal <= 0 || filteredData.length === 0) {
                return null;
            }
            return {
                ...prev,
                data: filteredData,
                total: nextTotal,
                total_pages: Math.max(1, Math.ceil(nextTotal / Math.max(1, prev.page_size))),
            };
        });
        setOpportunityByResultId((prev) => {
            if (!prev[resultId]) return prev;
            const next = { ...prev };
            delete next[resultId];
            return next;
        });
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.listResults({ status: "saved", page, page_size: 15 });
            setResults(data);

            if (data.data.length === 0) {
                setOpportunityByResultId({});
                return;
            }

            const analyses = await Promise.allSettled(
                data.data.map(async (result) => {
                    const linkedAnalysis = await api.getAnalysisByResultId(result.id);
                    return {
                        resultId: result.id,
                        hasOpportunity: hasOpportunityTag(linkedAnalysis?.analysis_data),
                    };
                })
            );

            const opportunityMap: Record<string, boolean> = {};
            for (const item of analyses) {
                if (item.status !== "fulfilled") continue;
                opportunityMap[item.value.resultId] = item.value.hasOpportunity;
            }
            setOpportunityByResultId(opportunityMap);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        load();
    }, [load]);

    function requestDiscard(id: string, objeto: string | null) {
        setDiscardTarget({ id, objeto });
    }

    async function confirmDiscard() {
        if (!discardTarget) return;
        const { id } = discardTarget;

        setDiscardingId(id);
        try {
            await api.updateResultStatus(id, "discarded");
            removeSavedResultFromState(id);
            toast.success("Edital removido dos salvos");
            await load();
        } catch {
            toast.error("Falha ao descartar edital. Tente novamente.");
        } finally {
            setDiscardingId(null);
            setDiscardTarget(null);
        }
    }

    async function handleStartDispute(id: string) {
        setDisputingId(id);
        try {
            await api.startDispute(id);
            removeSavedResultFromState(id);
            toast.success("Edital enviado para Disputas");
            router.push("/disputas");
        } catch {
            toast.error("Não foi possível enviar o edital para Disputas.");
        } finally {
            setDisputingId(null);
        }
    }

    return (
        <div className="max-w-5xl mx-auto">
            <PageHeader
                title="Editais Salvos"
                subtitle={`${results?.total ?? 0} edital(is) salvo(s)`}
            />

            {loading ? (
                <SkeletonList count={4} />
            ) : results?.data.length === 0 ? (
                <EmptyState
                    icon={Bookmark}
                    title="Nenhum edital salvo"
                    description="Salve editais do seu inbox para acompanhá-los aqui."
                />
            ) : (
                <>
                    <div className="space-y-3">
                        {results?.data.map((result, i) => {
                            const matchScopeLabel = getKeywordScopeLabel(result.keyword_match_scope);
                            const matchEvidenceSummary = summarizeKeywordEvidence(result.keyword_match_evidence);
                            return (
                            <InteractiveCard
                                key={result.id}
                                className={`card card-interactive !p-4 stagger-${Math.min(i + 1, 10)} animate-in`}
                                style={{
                                    animationFillMode: "both",
                                    opacity: 0,
                                }}
                                onActivate={() => router.push(`/salvos/${result.id}`)}
                                ariaLabel={`Abrir edital salvo ${result.objeto_compra || result.numero_controle_pncp}`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="badge badge-saved">Salvo</span>
                                            {opportunityByResultId[result.id] && (
                                                <span className="badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                    Oportunidade
                                                </span>
                                            )}
                                            {result.situacao_compra_nome && (
                                                <span className="badge badge-pending">
                                                    {result.situacao_compra_nome}
                                                </span>
                                            )}
                                            {matchScopeLabel && (
                                                <span className={`badge ${getKeywordScopeBadgeClass(result.keyword_match_scope)}`}>
                                                    Match: {matchScopeLabel}
                                                </span>
                                            )}
                                        </div>
                                        <h3
                                            className="text-sm font-semibold mb-1 leading-snug transition-colors duration-200"
                                            style={{ color: "var(--color-text-primary)" }}
                                            onMouseEnter={(e) =>
                                                (e.currentTarget.style.color = "var(--color-primary)")
                                            }
                                            onMouseLeave={(e) =>
                                                (e.currentTarget.style.color = "var(--color-text-primary)")
                                            }
                                        >
                                            {result.objeto_compra || "Sem descrição"}
                                        </h3>
                                        <div
                                            className="flex flex-wrap items-center gap-3 text-xs"
                                            style={{ color: "var(--color-text-muted)" }}
                                        >
                                            <span className="inline-flex items-center gap-1">
                                                <Building2 className="w-3 h-3" />
                                                {result.orgao_nome || result.cnpj_orgao}
                                            </span>
                                            {result.uf && (
                                                <span className="inline-flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />
                                                    {result.municipio
                                                        ? `${result.municipio}/${result.uf}`
                                                        : result.uf}
                                                </span>
                                            )}
                                            {result.modalidade_nome && (
                                                <span className="inline-flex items-center gap-1">
                                                    <FileText className="w-3 h-3" />
                                                    {result.modalidade_nome}
                                                </span>
                                            )}
                                            {result.codigo_unidade_compradora && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Scale className="w-3 h-3" />
                                                    Unidade: {result.codigo_unidade_compradora}
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            className="flex flex-wrap items-center gap-4 mt-2 text-xs"
                                            style={{ color: "var(--color-text-muted)" }}
                                        >
                                            {result.valor_total_estimado != null && (
                                                <span
                                                    className="inline-flex items-center gap-1 font-medium"
                                                    style={{ color: "var(--color-success)" }}
                                                >
                                                    <DollarSign className="w-3 h-3" />
                                                    {formatCurrency(result.valor_total_estimado)}
                                                </span>
                                            )}
                                            {result.data_publicacao && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDate(result.data_publicacao)}
                                                </span>
                                            )}
                                            {result.data_abertura_proposta && (
                                                <span>
                                                    Abertura: {formatDateTime(result.data_abertura_proposta)}
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
                                                handleStartDispute(result.id);
                                            }}
                                            title="Enviar para Disputas"
                                            aria-label="Disputar edital"
                                            disabled={disputingId === result.id}
                                        >
                                            <Scale className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            className="btn-ghost !py-1.5 !px-3"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                router.push(`/salvos/${result.id}`);
                                            }}
                                            title="Ver detalhes"
                                            aria-label="Ver detalhes do edital"
                                        >
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            className="btn-ghost !p-2"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                requestDiscard(result.id, result.objeto_compra);
                                            }}
                                            title="Remover dos salvos"
                                            aria-label="Remover edital dos salvos"
                                        >
                                            <Trash2
                                                className="w-4 h-4"
                                                style={{ color: "var(--color-danger)" }}
                                            />
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
                            <span
                                className="text-sm"
                                style={{ color: "var(--color-text-secondary)" }}
                            >
                                Página {page} de {results.total_pages}
                            </span>
                            <button
                                className="btn-ghost"
                                onClick={() =>
                                    setPage((p) => Math.min(results.total_pages, p + 1))
                                }
                                disabled={page >= results.total_pages}
                            >
                                Próxima <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </>
            )}

            <ConfirmModal
                isOpen={Boolean(discardTarget)}
                title="Confirmar exclusão"
                message={
                    discardTarget?.objeto
                        ? `Deseja realmente descartar este edital?\n\n"${discardTarget.objeto}"`
                        : "Deseja realmente descartar este edital?"
                }
                confirmLabel="Sim, descartar"
                cancelLabel="Cancelar"
                variant="danger"
                isLoading={discardingId === discardTarget?.id}
                onCancel={() => setDiscardTarget(null)}
                onConfirm={confirmDiscard}
            />
        </div>
    );
}
