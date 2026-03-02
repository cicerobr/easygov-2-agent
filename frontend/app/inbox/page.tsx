"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    api,
    type Automation,
    type PaginatedResults,
    type SearchResult,
} from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
    Inbox,
    CheckCircle2,
    XCircle,
    Bot,
    ChevronLeft,
    ChevronRight,
    Building2,
    MapPin,
    Calendar,
    DollarSign,
    Loader2,
    FileText,
    Check,
    ArrowRight,
} from "lucide-react";
import { SkeletonList } from "@/components/skeleton";
import { useToast } from "@/components/toast";
import { ConfirmModal } from "@/components/confirm-modal";
import { InteractiveCard } from "@/components/interactive-card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import {
    getKeywordScopeBadgeClass,
    getKeywordScopeLabel,
    summarizeKeywordEvidence,
} from "@/lib/keyword-evidence";

function filterHiddenResults(
    payload: PaginatedResults,
    hiddenIds: Set<string>
): PaginatedResults | null {
    const filteredData = payload.data.filter((item) => !hiddenIds.has(item.id));
    const removedCount = payload.data.length - filteredData.length;
    const nextTotal = Math.max(0, payload.total - removedCount);

    if (nextTotal <= 0 || filteredData.length === 0) {
        return null;
    }

    return {
        ...payload,
        data: filteredData,
        total: nextTotal,
        total_pages: Math.max(1, Math.ceil(nextTotal / Math.max(1, payload.page_size))),
    };
}

export default function InboxPage() {
    const router = useRouter();
    const toast = useToast();
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [resultsByAutomation, setResultsByAutomation] = useState<
        Record<string, PaginatedResults>
    >({});
    const [loading, setLoading] = useState(true);
    const [actioning, setActioning] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [pagesByAutomation, setPagesByAutomation] = useState<
        Record<string, number>
    >({});
    const [hiddenResultIds, setHiddenResultIds] = useState<Set<string>>(new Set());
    const [discardTarget, setDiscardTarget] = useState<{
        id: string;
        automationId: string;
        objeto: string | null;
    } | null>(null);
    const [batchDiscardConfirmOpen, setBatchDiscardConfirmOpen] = useState(false);

    function removeResultsFromState(ids: string[]) {
        if (ids.length === 0) return;
        const idSet = new Set(ids);
        setHiddenResultIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.add(id));
            return next;
        });

        setResultsByAutomation((prev) => {
            const next: Record<string, PaginatedResults> = {};
            for (const [automationId, payload] of Object.entries(prev)) {
                const filteredData = payload.data.filter((item) => !idSet.has(item.id));
                const removedCount = payload.data.length - filteredData.length;
                const nextTotal = Math.max(0, payload.total - removedCount);

                if (nextTotal <= 0 || filteredData.length === 0) {
                    continue;
                }
                next[automationId] = {
                    ...payload,
                    data: filteredData,
                    total: nextTotal,
                    total_pages: Math.max(
                        1,
                        Math.ceil(nextTotal / Math.max(1, payload.page_size))
                    ),
                };
            }
            return next;
        });
    }

    const loadAutomationsAndResults = useCallback(async (hiddenIdsOverride?: Set<string>) => {
        const hiddenIds = hiddenIdsOverride ?? hiddenResultIds;
        try {
            const autos = await api.listAutomations();
            setAutomations(autos);
            const entries: Record<string, PaginatedResults> = {};
            for (const a of autos) {
                const res = await api.listResults({
                    automation_id: a.id,
                    status: "pending",
                    page: pagesByAutomation[a.id] ?? 1,
                    page_size: 10,
                });
                const filtered = filterHiddenResults(res, hiddenIds);
                if (filtered) entries[a.id] = filtered;
            }
            setResultsByAutomation(entries);
        } finally {
            setLoading(false);
        }
    }, [hiddenResultIds, pagesByAutomation]);

    useEffect(() => {
        loadAutomationsAndResults();
    }, [loadAutomationsAndResults]);

    async function loadAutomationResults(
        automationId: string,
        page: number,
        hiddenIdsOverride?: Set<string>
    ) {
        const hiddenIds = hiddenIdsOverride ?? hiddenResultIds;
        const res = await api.listResults({
            automation_id: automationId,
            status: "pending",
            page,
            page_size: 10,
        });
        setResultsByAutomation((prev) => {
            const filtered = filterHiddenResults(res, hiddenIds);
            if (!filtered) {
                const next = { ...prev };
                delete next[automationId];
                return next;
            }
            return { ...prev, [automationId]: filtered };
        });
    }

    async function handleAction(
        id: string,
        automationId: string,
        action: "saved" | "discarded"
    ) {
        setActioning(id);
        try {
            await api.updateResultStatus(id, action);
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            removeResultsFromState([id]);
            const hiddenIdsForRefresh = new Set(hiddenResultIds);
            hiddenIdsForRefresh.add(id);
            toast.success(action === "saved" ? "Edital salvo!" : "Edital descartado");
            await loadAutomationResults(
                automationId,
                pagesByAutomation[automationId] ?? 1,
                hiddenIdsForRefresh
            );
            router.refresh();
        } catch {
            toast.error("Falha ao processar ação. Tente novamente.");
        } finally {
            setActioning(null);
        }
    }

    function requestDiscard(
        id: string,
        automationId: string,
        objeto: string | null
    ) {
        setDiscardTarget({ id, automationId, objeto });
    }

    async function confirmDiscard() {
        if (!discardTarget) return;

        const { id } = discardTarget;
        setActioning(id);
        try {
            await api.updateResultStatus(id, "discarded");
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            removeResultsFromState([id]);
            const hiddenIdsForRefresh = new Set(hiddenResultIds);
            hiddenIdsForRefresh.add(id);
            toast.success("Edital descartado");
            await loadAutomationsAndResults(hiddenIdsForRefresh);
            router.refresh();
        } catch {
            toast.error("Falha ao descartar edital. Tente novamente.");
        } finally {
            setActioning(null);
            setDiscardTarget(null);
        }
    }

    async function handleBatchAction(action: "saved" | "discarded") {
        if (selectedIds.size === 0) return;
        setActioning("batch");
        try {
            await api.batchAction(Array.from(selectedIds), action);
            const count = selectedIds.size;
            const idsToUpdate = Array.from(selectedIds);
            setSelectedIds(new Set());
            removeResultsFromState(idsToUpdate);
            const hiddenIdsForRefresh = new Set(hiddenResultIds);
            idsToUpdate.forEach((id) => hiddenIdsForRefresh.add(id));
            toast.success(
                action === "saved"
                    ? `${count} edital(is) salvo(s)!`
                    : `${count} edital(is) descartado(s)`
            );
            await loadAutomationsAndResults(hiddenIdsForRefresh);
            router.refresh();
        } catch {
            toast.error("Falha ao processar ação em lote.");
        } finally {
            setActioning(null);
        }
    }

    function requestBatchDiscard() {
        if (selectedIds.size === 0) return;
        setBatchDiscardConfirmOpen(true);
    }

    async function confirmBatchDiscard() {
        setBatchDiscardConfirmOpen(false);
        await handleBatchAction("discarded");
    }

    function toggleSelect(id: string) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    const automationsWithResults = automations.filter(
        (a) => resultsByAutomation[a.id]
    );
    const totalPending = Object.values(resultsByAutomation).reduce(
        (sum, r) => sum + r.total,
        0
    );

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <div className="skeleton" style={{ height: 28, width: 120, marginBottom: 8 }} />
                    <div className="skeleton skeleton-text short" />
                </div>
                <SkeletonList count={5} />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto">
            <PageHeader
                title="Inbox"
                subtitle={`${totalPending} edital(is) pendente(s) de revisão`}
                actions={
                    selectedIds.size > 0 ? (
                    <div className="flex items-center gap-3 animate-in-scale">
                        <span
                            className="text-sm font-medium px-3 py-1 rounded-full"
                            style={{
                                background: "var(--color-primary-subtle)",
                                color: "var(--color-primary)",
                            }}
                        >
                            {selectedIds.size} selecionado(s)
                        </span>
                        <button
                            className="btn-success"
                            onClick={() => handleBatchAction("saved")}
                            disabled={actioning === "batch"}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Salvar
                        </button>
                        <button
                            className="btn-danger"
                            onClick={requestBatchDiscard}
                            disabled={actioning === "batch"}
                        >
                            <XCircle className="w-3.5 h-3.5" /> Descartar
                        </button>
                        {actioning === "batch" && (
                            <Loader2
                                className="w-4 h-4 animate-spin"
                                style={{ color: "var(--color-primary)" }}
                            />
                        )}
                    </div>
                    ) : null
                }
            />

            {/* Empty state */}
            {automationsWithResults.length === 0 ? (
                <EmptyState
                    icon={Inbox}
                    title="Inbox vazio"
                    description="Nenhum edital pendente. Seus resultados aparecerão aqui."
                />
            ) : (
                <div className="space-y-8">
                    {automationsWithResults.map((auto) => {
                        const results = resultsByAutomation[auto.id];
                        if (!results) return null;
                        const currentPage = pagesByAutomation[auto.id] ?? 1;

                        return (
                            <div key={auto.id} className="animate-in-up">
                                {/* Section header */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                                        style={{ background: "var(--color-primary-subtle)" }}
                                    >
                                        <Bot className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
                                    </div>
                                    <h2
                                        className="text-sm font-semibold flex-1"
                                        style={{ color: "var(--color-text-primary)" }}
                                    >
                                        {auto.name}
                                    </h2>
                                    <span
                                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                                        style={{
                                            background: "var(--color-warning)",
                                            color: "white",
                                        }}
                                    >
                                        {results.total}
                                    </span>
                                </div>

                                {/* Results */}
                                <div className="space-y-3">
                                    {results.data.map((result, ri) => (
                                        <ResultCard
                                            key={result.id}
                                            result={result}
                                            index={ri}
                                            automationId={auto.id}
                                            selected={selectedIds.has(result.id)}
                                            onToggle={toggleSelect}
                                            onAction={handleAction}
                                            onRequestDiscard={requestDiscard}
                                            actioning={actioning}
                                            onNavigate={() => router.push(`/inbox/${result.id}`)}
                                        />
                                    ))}
                                </div>

                                {/* Pagination */}
                                {results.total_pages > 1 && (
                                    <div className="flex items-center justify-center gap-4 mt-4">
                                        <button
                                            className="btn-ghost"
                                            onClick={() => {
                                                const newPage = Math.max(1, currentPage - 1);
                                                setPagesByAutomation((p) => ({
                                                    ...p,
                                                    [auto.id]: newPage,
                                                }));
                                                loadAutomationResults(auto.id, newPage);
                                            }}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="w-4 h-4" /> Anterior
                                        </button>
                                        <span
                                            className="text-sm"
                                            style={{ color: "var(--color-text-secondary)" }}
                                        >
                                            {currentPage} de {results.total_pages}
                                        </span>
                                        <button
                                            className="btn-ghost"
                                            onClick={() => {
                                                const newPage = Math.min(
                                                    results.total_pages,
                                                    currentPage + 1
                                                );
                                                setPagesByAutomation((p) => ({
                                                    ...p,
                                                    [auto.id]: newPage,
                                                }));
                                                loadAutomationResults(auto.id, newPage);
                                            }}
                                            disabled={currentPage >= results.total_pages}
                                        >
                                            Próxima <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
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
                isLoading={actioning === discardTarget?.id}
                onCancel={() => setDiscardTarget(null)}
                onConfirm={confirmDiscard}
            />

            <ConfirmModal
                isOpen={batchDiscardConfirmOpen}
                title="Confirmar exclusão em lote"
                message={`Deseja realmente descartar ${selectedIds.size} edital(is) selecionado(s)?`}
                confirmLabel="Sim, descartar todos"
                cancelLabel="Cancelar"
                variant="danger"
                isLoading={actioning === "batch"}
                onCancel={() => setBatchDiscardConfirmOpen(false)}
                onConfirm={confirmBatchDiscard}
            />
        </div>
    );
}

function ResultCard({
    result,
    index,
    automationId,
    selected,
    onToggle,
    onAction,
    onRequestDiscard,
    actioning,
    onNavigate,
}: {
    result: SearchResult;
    index: number;
    automationId: string;
    selected: boolean;
    onToggle: (id: string) => void;
    onAction: (id: string, automationId: string, action: "saved" | "discarded") => void;
    onRequestDiscard: (id: string, automationId: string, objeto: string | null) => void;
    actioning: string | null;
    onNavigate: () => void;
}) {
    const isActioning = actioning === result.id;
    const matchScopeLabel = getKeywordScopeLabel(result.keyword_match_scope);
    const matchEvidenceSummary = summarizeKeywordEvidence(result.keyword_match_evidence);

    return (
        <InteractiveCard
            className={`card card-interactive !p-4 transition-all duration-200 stagger-${Math.min(index + 1, 10)} animate-in`}
            style={{
                opacity: 0,
                borderColor: selected ? "var(--color-primary)" : undefined,
                boxShadow: selected
                    ? "0 0 0 2px var(--color-primary-glow)"
                    : undefined,
            }}
            onActivate={onNavigate}
            ariaLabel={`Abrir detalhes do edital ${result.objeto_compra || result.numero_controle_pncp}`}
        >
            <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                    className="w-5 h-5 mt-0.5 rounded-md flex-shrink-0 flex items-center justify-center transition-all duration-200"
                    style={{
                        border: `2px solid ${selected ? "var(--color-primary)" : "var(--color-border)"
                            }`,
                        background: selected ? "var(--color-primary)" : "transparent",
                    }}
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggle(result.id);
                    }}
                    aria-label={selected ? "Desmarcar edital" : "Selecionar edital"}
                >
                    {selected && <Check className="w-3 h-3 text-white" />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="badge badge-pending">Pendente</span>
                        {result.situacao_compra_nome && (
                            <span className="badge badge-saved">{result.situacao_compra_nome}</span>
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
                            <span>Abertura: {formatDateTime(result.data_abertura_proposta)}</span>
                        )}
                    </div>
                    {matchEvidenceSummary && (
                        <p className="mt-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                            {matchEvidenceSummary}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                        className="btn-ghost !py-1.5 !px-3"
                        onClick={(event) => {
                            event.stopPropagation();
                            onNavigate();
                        }}
                        title="Ver detalhes"
                        aria-label="Ver detalhes do edital"
                    >
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                        className="btn-success !py-1.5"
                        onClick={(event) => {
                            event.stopPropagation();
                            onAction(result.id, automationId, "saved");
                        }}
                        disabled={isActioning}
                        aria-label="Salvar edital"
                    >
                        {isActioning ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                    </button>
                    <button
                        className="btn-danger !py-1.5"
                        onClick={(event) => {
                            event.stopPropagation();
                            onRequestDiscard(result.id, automationId, result.objeto_compra);
                        }}
                        disabled={isActioning}
                        aria-label="Descartar edital"
                    >
                        <XCircle className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </InteractiveCard>
    );
}
