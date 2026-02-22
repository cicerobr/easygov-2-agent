"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    FileSearch,
    Upload,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    FileText,
    Trash2,
    Bot,
    ArrowRight,
} from "lucide-react";
import { api, EditalAnalysis, AnalysisStats } from "@/lib/api";

export default function AnalisesPage() {
    const router = useRouter();
    const [analyses, setAnalyses] = useState<EditalAnalysis[]>([]);
    const [stats, setStats] = useState<AnalysisStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const loadData = useCallback(async () => {
        try {
            const [analysesRes, statsRes] = await Promise.all([
                api.listAnalyses({ status: statusFilter, page, page_size: 20 }),
                api.getAnalysisStats(),
            ]);
            setAnalyses(analysesRes.data);
            setTotalPages(analysesRes.total_pages);
            setStats(statsRes);
        } catch (e) {
            console.error("Failed to load analyses:", e);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, page]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleFiles = async (files: FileList | File[]) => {
        const pdfFiles = Array.from(files).filter((f) =>
            f.name.toLowerCase().endsWith(".pdf")
        );
        if (pdfFiles.length === 0) return;

        setUploading(true);
        try {
            if (pdfFiles.length === 1) {
                const result = await api.uploadPdfForAnalysis(pdfFiles[0]);
                router.push(`/analises/${result.id}`);
            } else {
                await api.uploadBatchPdfs(pdfFiles);
                await loadData();
            }
        } catch (e) {
            console.error("Upload failed:", e);
            alert("Falha no upload. Tente novamente.");
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Excluir esta análise?")) return;
        try {
            await api.deleteAnalysis(id);
            await loadData();
        } catch (e) {
            console.error("Delete failed:", e);
        }
    };

    const getStatusBadge = (status: string) => {
        const configs: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
            pending: { icon: <Clock className="w-3.5 h-3.5" />, label: "Pendente", color: "var(--color-warning)", bg: "rgba(245, 158, 11, 0.1)" },
            processing: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, label: "Processando", color: "var(--color-primary)", bg: "rgba(99, 102, 241, 0.1)" },
            completed: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Concluída", color: "var(--color-success)", bg: "rgba(34, 197, 94, 0.1)" },
            error: { icon: <XCircle className="w-3.5 h-3.5" />, label: "Erro", color: "var(--color-danger)", bg: "rgba(239, 68, 68, 0.1)" },
        };
        const cfg = configs[status] || configs.pending;
        return (
            <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ color: cfg.color, background: cfg.bg }}
            >
                {cfg.icon}
                {cfg.label}
            </span>
        );
    };

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

    const formatSize = (bytes: number | null) => {
        if (!bytes) return "—";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--color-text-primary)" }}>
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{
                                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                            }}
                        >
                            <FileSearch className="w-5 h-5 text-white" />
                        </div>
                        Análise de Editais
                    </h1>
                    <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                        Envie editais em PDF para análise inteligente com IA
                    </p>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                        { label: "Total", value: stats.total, color: "var(--color-primary)" },
                        { label: "Concluídas", value: stats.completed, color: "var(--color-success)" },
                        { label: "Processando", value: stats.processing, color: "var(--color-warning)" },
                        { label: "Erros", value: stats.errors, color: "var(--color-danger)" },
                    ].map((s) => (
                        <div
                            key={s.label}
                            className="rounded-xl p-4"
                            style={{
                                background: "var(--color-bg-card)",
                                border: "1px solid var(--color-border)",
                            }}
                        >
                            <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                                {s.label}
                            </p>
                            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>
                                {s.value}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Zone */}
            <div
                className="rounded-xl p-8 mb-6 text-center transition-all cursor-pointer"
                style={{
                    background: dragOver
                        ? "rgba(99, 102, 241, 0.1)"
                        : "var(--color-bg-card)",
                    border: dragOver
                        ? "2px dashed var(--color-primary)"
                        : "2px dashed var(--color-border)",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".pdf";
                    input.multiple = true;
                    input.onchange = (e) => {
                        const files = (e.target as HTMLInputElement).files;
                        if (files) handleFiles(files);
                    };
                    input.click();
                }}
            >
                {uploading ? (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--color-primary)" }} />
                        <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
                            Processando PDF...
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <Upload className="w-10 h-10" style={{ color: "var(--color-text-muted)" }} />
                        <div>
                            <p className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
                                Arraste PDFs aqui ou <span style={{ color: "var(--color-primary)" }}>clique para selecionar</span>
                            </p>
                            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                                Aceita múltiplos arquivos PDF (máx. 50MB cada)
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-4">
                {["all", "completed", "processing", "error"].map((s) => (
                    <button
                        key={s}
                        onClick={() => { setStatusFilter(s); setPage(1); }}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                        style={{
                            background: statusFilter === s ? "rgba(99, 102, 241, 0.15)" : "transparent",
                            color: statusFilter === s ? "var(--color-primary)" : "var(--color-text-muted)",
                        }}
                    >
                        {s === "all" ? "Todas" : s === "completed" ? "Concluídas" : s === "processing" ? "Processando" : "Erros"}
                    </button>
                ))}
            </div>

            {/* Analyses List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--color-primary)" }} />
                </div>
            ) : analyses.length === 0 ? (
                <div
                    className="rounded-xl p-12 text-center"
                    style={{
                        background: "var(--color-bg-card)",
                        border: "1px solid var(--color-border)",
                    }}
                >
                    <Bot className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--color-text-muted)" }} />
                    <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>
                        Nenhuma análise encontrada
                    </h3>
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                        Envie um PDF de edital para começar a análise inteligente
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {analyses.map((a) => (
                        <div
                            key={a.id}
                            className="rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all"
                            style={{
                                background: "var(--color-bg-card)",
                                border: "1px solid var(--color-border)",
                            }}
                            onClick={() => router.push(`/analises/${a.id}`)}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
                        >
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{
                                    background: a.source_type === "upload"
                                        ? "rgba(99, 102, 241, 0.1)"
                                        : "rgba(34, 197, 94, 0.1)",
                                }}
                            >
                                <FileText
                                    className="w-5 h-5"
                                    style={{
                                        color: a.source_type === "upload"
                                            ? "var(--color-primary)"
                                            : "var(--color-success)",
                                    }}
                                />
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                                    {a.pdf_filename || "Documento sem nome"}
                                </p>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                        {formatDate(a.created_at)}
                                    </span>
                                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                        {a.page_count ? `${a.page_count} págs` : ""}
                                    </span>
                                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                        {formatSize(a.pdf_size_bytes)}
                                    </span>
                                    {a.processing_time_ms && (
                                        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                            {(a.processing_time_ms / 1000).toFixed(1)}s
                                        </span>
                                    )}
                                </div>
                            </div>

                            {getStatusBadge(a.status)}

                            <button
                                onClick={(e) => handleDelete(a.id, e)}
                                className="p-2 rounded-lg transition-all"
                                style={{ color: "var(--color-text-muted)" }}
                                title="Excluir"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>

                            <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPage(p)}
                            className="w-8 h-8 rounded-lg text-sm font-medium transition-all"
                            style={{
                                background: page === p ? "var(--color-primary)" : "transparent",
                                color: page === p ? "white" : "var(--color-text-muted)",
                            }}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
