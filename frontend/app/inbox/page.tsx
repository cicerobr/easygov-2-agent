"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Automation, type PaginatedResults } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import {
    Inbox,
    Bookmark,
    X,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Building2,
    MapPin,
    Calendar,
    DollarSign,
    CheckSquare,
    Square,
    Loader2,
    FileText,
    ArrowRight,
    Bot,
} from "lucide-react";

export default function InboxPage() {
    const router = useRouter();
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [resultsByAutomation, setResultsByAutomation] = useState<Record<string, PaginatedResults>>({});
    const [pagesByAutomation, setPagesByAutomation] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [loadingAutomationIds, setLoadingAutomationIds] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [collapsedAutomationIds, setCollapsedAutomationIds] = useState<Set<string>>(new Set());
    const [actioning, setActioning] = useState<string | null>(null);

    const loadAutomationsAndResults = useCallback(async () => {
        setLoading(true);
        try {
            const autos = await api.listAutomations();
            setAutomations(autos);

            const entries = await Promise.all(
                autos.map(async (auto) => {
                    const data = await api.listResults({
                        status: "pending",
                        automation_id: auto.id,
                        page: 1,
                        page_size: 15,
                    });
                    return [auto.id, data] as const;
                })
            );
            setCollapsedAutomationIds((prev) => {
                const validIds = new Set(autos.map((a) => a.id));
                return new Set([...prev].filter((id) => validIds.has(id)));
            });
            setPagesByAutomation(
                autos.reduce<Record<string, number>>((acc, auto) => {
                    acc[auto.id] = 1;
                    return acc;
                }, {})
            );
            setResultsByAutomation(Object.fromEntries(entries));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAutomationsAndResults();
    }, [loadAutomationsAndResults]);

    async function loadAutomationResults(automationId: string, page: number) {
        setLoadingAutomationIds((prev) => new Set(prev).add(automationId));
        try {
            let data = await api.listResults({
                status: "pending",
                automation_id: automationId,
                page,
                page_size: 15,
            });

            if (data.total_pages > 0 && page > data.total_pages) {
                data = await api.listResults({
                    status: "pending",
                    automation_id: automationId,
                    page: data.total_pages,
                    page_size: 15,
                });
                setPagesByAutomation((prev) => ({ ...prev, [automationId]: data.total_pages }));
            }

            setResultsByAutomation((prev) => ({ ...prev, [automationId]: data }));
        } finally {
            setLoadingAutomationIds((prev) => {
                const next = new Set(prev);
                next.delete(automationId);
                return next;
            });
        }
    }

    async function changeAutomationPage(automationId: string, nextPage: number) {
        setPagesByAutomation((prev) => ({ ...prev, [automationId]: nextPage }));
        await loadAutomationResults(automationId, nextPage);
    }

    async function handleAction(id: string, automationId: string, action: "saved" | "discarded") {
        setActioning(id);
        try {
            await api.updateResultStatus(id, action);
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            await loadAutomationResults(automationId, pagesByAutomation[automationId] ?? 1);
        } finally {
            setActioning(null);
        }
    }

    async function handleBatchAction(action: "saved" | "discarded") {
        if (selectedIds.size === 0) return;
        setActioning("batch");
        try {
            await api.batchAction(Array.from(selectedIds), action);
            setSelectedIds(new Set());
            await loadAutomationsAndResults();
        } finally {
            setActioning(null);
        }
    }

    function toggleSelect(id: string) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    const visibleResults = automations.flatMap((auto) => {
        if (collapsedAutomationIds.has(auto.id)) return [];
        return resultsByAutomation[auto.id]?.data || [];
    });
    const totalPending = Object.values(resultsByAutomation).reduce((sum, group) => sum + group.total, 0);
    const hasVisibleResults = visibleResults.length > 0;
    const allVisibleSelected = hasVisibleResults && visibleResults.every((r) => selectedIds.has(r.id));

    function toggleSelectAllVisible() {
        if (!hasVisibleResults) return;
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (allVisibleSelected) {
                visibleResults.forEach((r) => next.delete(r.id));
            } else {
                visibleResults.forEach((r) => next.add(r.id));
            }
            return next;
        });
    }

    function toggleSelectAutomation(automationId: string) {
        const groupResults = resultsByAutomation[automationId]?.data || [];
        if (groupResults.length === 0) return;
        const allSelectedInGroup = groupResults.every((r) => selectedIds.has(r.id));

        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (allSelectedInGroup) {
                groupResults.forEach((r) => next.delete(r.id));
            } else {
                groupResults.forEach((r) => next.add(r.id));
            }
            return next;
        });
    }

    function toggleCollapseAutomation(automationId: string) {
        setCollapsedAutomationIds((prev) => {
            const next = new Set(prev);
            if (next.has(automationId)) next.delete(automationId);
            else next.add(automationId);
            return next;
        });
    }

    return (
        <div className="max-w-5xl mx-auto animate-in">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>Inbox</h1>
                    <p style={{ color: "var(--color-text-secondary)" }}>
                        {totalPending} edital(is) pendente(s), separados por automação
                    </p>
                </div>

                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm mr-2" style={{ color: "var(--color-text-secondary)" }}>
                            {selectedIds.size} selecionado(s)
                        </span>
                        <button
                            className="btn-success"
                            onClick={() => handleBatchAction("saved")}
                            disabled={actioning === "batch"}
                        >
                            <Bookmark className="w-3.5 h-3.5" /> Salvar
                        </button>
                        <button
                            className="btn-danger"
                            onClick={() => handleBatchAction("discarded")}
                            disabled={actioning === "batch"}
                        >
                            <X className="w-3.5 h-3.5" /> Descartar
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--color-primary)" }} />
                </div>
            ) : totalPending === 0 ? (
                <div className="card text-center py-16">
                    <Inbox className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--color-text-muted)" }} />
                    <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>Inbox vazio</h2>
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                        Todos os editais foram revisados. Novos resultados aparecerão aqui automaticamente.
                    </p>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-3 mb-4 px-1">
                        <button
                            onClick={toggleSelectAllVisible}
                            className="flex items-center gap-2 text-xs"
                            style={{ color: "var(--color-text-muted)" }}
                        >
                            {allVisibleSelected ? (
                                <CheckSquare className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
                            ) : (
                                <Square className="w-4 h-4" />
                            )}
                            Selecionar todos da tela
                        </button>
                    </div>

                    <div className="space-y-6">
                        {automations.map((auto) => {
                            const group = resultsByAutomation[auto.id];
                            if (!group || group.total === 0) return null;

                            const groupResults = group.data;
                            const selectedInGroup = groupResults.filter((r) => selectedIds.has(r.id)).length;
                            const allSelectedInGroup =
                                groupResults.length > 0 && selectedInGroup === groupResults.length;
                            const isGroupLoading = loadingAutomationIds.has(auto.id);
                            const isCollapsed = collapsedAutomationIds.has(auto.id);

                            return (
                                <section key={auto.id} className="card">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div
                                                className="w-9 h-9 rounded-lg flex items-center justify-center"
                                                style={{ background: "rgba(99,102,241,0.12)" }}
                                            >
                                                <Bot className="w-4.5 h-4.5" style={{ color: "var(--color-primary)" }} />
                                            </div>
                                            <div className="min-w-0">
                                                <h2
                                                    className="text-base font-semibold truncate"
                                                    style={{ color: "var(--color-text-primary)" }}
                                                >
                                                    {auto.name}
                                                </h2>
                                                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                                    {group.total} pendente(s)
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleSelectAutomation(auto.id)}
                                                className="flex items-center gap-2 text-xs"
                                                style={{ color: "var(--color-text-muted)" }}
                                            >
                                                {allSelectedInGroup ? (
                                                    <CheckSquare className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
                                                ) : (
                                                    <Square className="w-4 h-4" />
                                                )}
                                                Selecionar automação
                                            </button>
                                            <button
                                                className="btn-ghost !p-2"
                                                onClick={() => toggleCollapseAutomation(auto.id)}
                                                title={isCollapsed ? "Expandir bloco" : "Recolher bloco"}
                                            >
                                                {isCollapsed ? (
                                                    <ChevronDown className="w-4 h-4" />
                                                ) : (
                                                    <ChevronUp className="w-4 h-4" />
                                                )}
                                            </button>
                                            {isGroupLoading && (
                                                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--color-primary)" }} />
                                            )}
                                        </div>
                                    </div>

                                    {!isCollapsed && (
                                        <>
                                            <div className="space-y-3">
                                        {groupResults.map((result, i) => (
                                            <div
                                                key={result.id}
                                                className="card flex gap-4 animate-in"
                                                style={{
                                                    animationDelay: `${i * 30}ms`,
                                                    borderLeftWidth: 3,
                                                    borderLeftColor: !result.is_read ? "var(--color-primary)" : "transparent",
                                                }}
                                            >
                                                <button onClick={() => toggleSelect(result.id)} className="flex-shrink-0 mt-1">
                                                    {selectedIds.has(result.id) ? (
                                                        <CheckSquare className="w-5 h-5" style={{ color: "var(--color-primary)" }} />
                                                    ) : (
                                                        <Square className="w-5 h-5" style={{ color: "var(--color-text-muted)" }} />
                                                    )}
                                                </button>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="min-w-0 flex-1">
                                                            <h3
                                                                className="text-sm font-semibold mb-1 leading-snug cursor-pointer hover:text-purple-400 transition-colors"
                                                                style={{ color: "var(--color-text-primary)" }}
                                                                onClick={() => router.push(`/inbox/${result.id}`)}
                                                            >
                                                                {result.objeto_compra || "Sem descrição"}
                                                            </h3>
                                                            <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                                                                <span className="inline-flex items-center gap-1">
                                                                    <Building2 className="w-3 h-3" />
                                                                    {result.orgao_nome || result.cnpj_orgao}
                                                                </span>
                                                                {result.uf && (
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <MapPin className="w-3 h-3" />
                                                                        {result.municipio ? `${result.municipio}/${result.uf}` : result.uf}
                                                                    </span>
                                                                )}
                                                                {result.modalidade_nome && (
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <FileText className="w-3 h-3" />
                                                                        {result.modalidade_nome}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                                                                {result.valor_total_estimado != null && (
                                                                    <span className="inline-flex items-center gap-1 font-medium" style={{ color: "var(--color-success)" }}>
                                                                        <DollarSign className="w-3 h-3" />
                                                                        {formatCurrency(result.valor_total_estimado)}
                                                                    </span>
                                                                )}
                                                                {result.data_publicacao && (
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <Calendar className="w-3 h-3" />
                                                                        Publicado: {formatDate(result.data_publicacao)}
                                                                    </span>
                                                                )}
                                                                {result.data_abertura_proposta && (
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <Calendar className="w-3 h-3" />
                                                                        Abertura: {formatDateTime(result.data_abertura_proposta)}
                                                                    </span>
                                                                )}
                                                                <span>
                                                                    Encontrado {timeAgo(result.found_at)} atrás
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                                            {result.link_sistema_origem && (
                                                                <a
                                                                    href={result.link_sistema_origem}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="btn-ghost !p-2"
                                                                    title="Abrir no PNCP"
                                                                >
                                                                    <ExternalLink className="w-4 h-4" />
                                                                </a>
                                                            )}
                                                            <button
                                                                className="btn-ghost !py-1.5 !px-3"
                                                                onClick={() => router.push(`/inbox/${result.id}`)}
                                                                title="Ver detalhes"
                                                            >
                                                                <ArrowRight className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                className="btn-success !py-1.5 !px-3"
                                                                onClick={() => handleAction(result.id, result.automation_id, "saved")}
                                                                disabled={actioning === result.id}
                                                                title="Salvar"
                                                            >
                                                                {actioning === result.id ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <Bookmark className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>
                                                            <button
                                                                className="btn-ghost !py-1.5 !px-3"
                                                                onClick={() => handleAction(result.id, result.automation_id, "discarded")}
                                                                disabled={actioning === result.id}
                                                                title="Descartar"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                            </div>

                                            {group.total_pages > 1 && (
                                                <div className="flex items-center justify-center gap-4 mt-6">
                                                    <button
                                                        className="btn-ghost"
                                                        onClick={() => changeAutomationPage(auto.id, Math.max(1, group.page - 1))}
                                                        disabled={group.page === 1 || isGroupLoading}
                                                    >
                                                        <ChevronLeft className="w-4 h-4" /> Anterior
                                                    </button>
                                                    <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                                                        Página {group.page} de {group.total_pages}
                                                    </span>
                                                    <button
                                                        className="btn-ghost"
                                                        onClick={() => changeAutomationPage(auto.id, Math.min(group.total_pages, group.page + 1))}
                                                        disabled={group.page >= group.total_pages || isGroupLoading}
                                                    >
                                                        Próxima <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
