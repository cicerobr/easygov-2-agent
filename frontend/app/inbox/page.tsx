"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, type SearchResult, type PaginatedResults } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import {
    Inbox,
    Bookmark,
    X,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Building2,
    MapPin,
    Calendar,
    DollarSign,
    Eye,
    CheckSquare,
    Square,
    Loader2,
    FileText,
    ArrowRight,
} from "lucide-react";

export default function InboxPage() {
    const router = useRouter();
    const [results, setResults] = useState<PaginatedResults | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [actioning, setActioning] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.listResults({ status: "pending", page, page_size: 15 });
            setResults(data);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        load();
    }, [load]);

    async function handleAction(id: string, action: "saved" | "discarded") {
        setActioning(id);
        try {
            await api.updateResultStatus(id, action);
            await load();
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
            await load();
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

    function toggleSelectAll() {
        if (!results) return;
        if (selectedIds.size === results.data.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(results.data.map((r) => r.id)));
        }
    }

    return (
        <div className="max-w-5xl mx-auto animate-in">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>Inbox</h1>
                    <p style={{ color: "var(--color-text-secondary)" }}>
                        {results?.total ?? 0} edital(is) pendente(s) de revisão
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
            ) : results?.data.length === 0 ? (
                <div className="card text-center py-16">
                    <Inbox className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--color-text-muted)" }} />
                    <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>Inbox vazio</h2>
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                        Todos os editais foram revisados. Novos resultados aparecerão aqui automaticamente.
                    </p>
                </div>
            ) : (
                <>
                    {/* Select All */}
                    <div className="flex items-center gap-3 mb-4 px-1">
                        <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                            {selectedIds.size === results?.data.length ? (
                                <CheckSquare className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
                            ) : (
                                <Square className="w-4 h-4" />
                            )}
                            Selecionar todos
                        </button>
                    </div>

                    {/* Results */}
                    <div className="space-y-3">
                        {results?.data.map((result, i) => (
                            <div
                                key={result.id}
                                className="card flex gap-4 animate-in"
                                style={{
                                    animationDelay: `${i * 30}ms`,
                                    borderLeftWidth: 3,
                                    borderLeftColor: !result.is_read ? "var(--color-primary)" : "transparent",
                                }}
                            >
                                {/* Checkbox */}
                                <button onClick={() => toggleSelect(result.id)} className="flex-shrink-0 mt-1">
                                    {selectedIds.has(result.id) ? (
                                        <CheckSquare className="w-5 h-5" style={{ color: "var(--color-primary)" }} />
                                    ) : (
                                        <Square className="w-5 h-5" style={{ color: "var(--color-text-muted)" }} />
                                    )}
                                </button>

                                {/* Content */}
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

                                            {/* Extra info row */}
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

                                        {/* Actions */}
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
                                                onClick={() => handleAction(result.id, "saved")}
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
                                                onClick={() => handleAction(result.id, "discarded")}
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

                    {/* Pagination */}
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
