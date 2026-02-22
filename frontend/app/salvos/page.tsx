"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, type PaginatedResults } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, timeAgo } from "@/lib/utils";
import {
    Bookmark,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Building2,
    MapPin,
    Calendar,
    DollarSign,
    Loader2,
    FileText,
    Trash2,
    ArrowRight,
} from "lucide-react";

export default function SalvosPage() {
    const router = useRouter();
    const [results, setResults] = useState<PaginatedResults | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.listResults({ status: "saved", page, page_size: 15 });
            setResults(data);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => { load(); }, [load]);

    async function handleDiscard(id: string) {
        await api.updateResultStatus(id, "discarded");
        load();
    }

    return (
        <div className="max-w-5xl mx-auto animate-in">
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>Editais Salvos</h1>
                <p style={{ color: "var(--color-text-secondary)" }}>
                    {results?.total ?? 0} edital(is) salvo(s)
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--color-primary)" }} />
                </div>
            ) : results?.data.length === 0 ? (
                <div className="card text-center py-16">
                    <Bookmark className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--color-text-muted)" }} />
                    <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>Nenhum edital salvo</h2>
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                        Salve editais do seu inbox para acompanhá-los aqui.
                    </p>
                </div>
            ) : (
                <>
                    <div className="space-y-3">
                        {results?.data.map((result, i) => (
                            <div key={result.id} className="card animate-in" style={{ animationDelay: `${i * 30}ms` }}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="badge badge-saved">Salvo</span>
                                            {result.situacao_compra_nome && (
                                                <span className="badge badge-pending">{result.situacao_compra_nome}</span>
                                            )}
                                        </div>
                                        <h3
                                            className="text-sm font-semibold mb-1 leading-snug cursor-pointer hover:text-purple-500 transition-colors"
                                            style={{ color: "var(--color-text-primary)" }}
                                            onClick={() => router.push(`/salvos/${result.id}`)}
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
                                                    {formatDate(result.data_publicacao)}
                                                </span>
                                            )}
                                            {result.data_abertura_proposta && (
                                                <span>Abertura: {formatDateTime(result.data_abertura_proposta)}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {result.link_sistema_origem && (
                                            <a href={result.link_sistema_origem} target="_blank" rel="noopener noreferrer" className="btn-ghost !p-2" title="Abrir no PNCP">
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        )}
                                        <button
                                            className="btn-ghost !py-1.5 !px-3"
                                            onClick={() => router.push(`/salvos/${result.id}`)}
                                            title="Ver detalhes"
                                        >
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                        <button className="btn-ghost !p-2" onClick={() => handleDiscard(result.id)} title="Remover dos salvos">
                                            <Trash2 className="w-4 h-4" style={{ color: "var(--color-danger)" }} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {results && results.total_pages > 1 && (
                        <div className="flex items-center justify-center gap-4 mt-8">
                            <button className="btn-ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                                <ChevronLeft className="w-4 h-4" /> Anterior
                            </button>
                            <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Página {page} de {results.total_pages}</span>
                            <button className="btn-ghost" onClick={() => setPage((p) => Math.min(results.total_pages, p + 1))} disabled={page >= results.total_pages}>
                                Próxima <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
