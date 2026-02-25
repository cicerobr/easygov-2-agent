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
import { ConfirmModal } from "@/components/confirm-modal";
import { useToast } from "@/components/toast";

export default function AnalisesPage() {
    const router = useRouter();
    const toast = useToast();
    const [analyses, setAnalyses] = useState<EditalAnalysis[]>([]);
    const [stats, setStats] = useState<AnalysisStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

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
        if (pdfFiles.length === 0) {
            toast.warning("Selecione arquivos PDF válidos.");
            return;
        }

        setUploading(true);
        try {
            if (pdfFiles.length === 1) {
                const result = await api.uploadPdfForAnalysis(pdfFiles[0]);
                toast.success("PDF enviado para análise!");
                router.push(`/analises/${result.id}`);
            } else {
                await api.uploadBatchPdfs(pdfFiles);
                toast.success(`${pdfFiles.length} PDFs enviados para análise!`);
                await loadData();
            }
        } catch {
            toast.error("Falha no upload. Tente novamente.");
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmId) return;
        setIsDeleting(true);
        try {
            await api.deleteAnalysis(deleteConfirmId);
            setDeleteConfirmId(null);
            toast.success("Análise excluída com sucesso");
            await loadData();
        } catch {
            toast.error("Falha ao excluir análise.");
        } finally {
            setIsDeleting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const configs: Record<
            string,
            { icon: React.ReactNode; label: string; color: string; bg: string }
        > = {
            pending: {
                icon: <Clock className="w-3.5 h-3.5" />,
                label: "Pendente",
                color: "var(--color-warning)",
                bg: "rgba(245, 158, 11, 0.1)",
            },
            processing: {
                icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
                label: "Processando",
                color: "var(--color-primary)",
                bg: "var(--color-primary-subtle)",
            },
            completed: {
                icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                label: "Concluída",
                color: "var(--color-success)",
                bg: "rgba(34, 197, 94, 0.1)",
            },
            error: {
                icon: <XCircle className="w-3.5 h-3.5" />,
                label: "Erro",
                color: "var(--color-danger)",
                bg: "rgba(239, 68, 68, 0.1)",
            },
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

    const formatDateLocal = (d: string) =>
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
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 animate-in">
                <div>
                    <h1
                        className="text-2xl font-extrabold flex items-center gap-3"
                        style={{ color: "var(--color-text-primary)" }}
                    >
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{
                                background:
                                    "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))",
                                boxShadow: "0 4px 12px var(--color-primary-glow)",
                            }}
                        >
                            <FileSearch className="w-5 h-5 text-white" />
                        </div>
                        Análise de Editais
                    </h1>
                    <p
                        className="text-sm mt-1"
                        style={{ color: "var(--color-text-muted)" }}
                    >
                        Envie editais em PDF para análise inteligente com IA
                    </p>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: "Total", value: stats.total, color: "var(--color-primary)" },
                        { label: "Concluídas", value: stats.completed, color: "var(--color-success)" },
                        { label: "Processando", value: stats.processing, color: "var(--color-warning)" },
                        { label: "Erros", value: stats.errors, color: "var(--color-danger)" },
                    ].map((s, i) => (
                        <div
                            key={s.label}
                            className={`stat-card animate-in-scale stagger-${i + 1}`}
                            style={{ animationFillMode: "both", opacity: 0 }}
                        >
                            <p
                                className="text-xs font-medium"
                                style={{ color: "var(--color-text-muted)" }}
                            >
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
                    background: dragOver ? "var(--color-primary-subtle)" : "var(--color-bg-card)",
                    border: dragOver
                        ? "2px dashed var(--color-primary)"
                        : "2px dashed var(--color-border)",
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                }}
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
                role="button"
                aria-label="Clique ou arraste PDFs para enviar"
                tabIndex={0}
            >
                {uploading ? (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2
                            className="w-10 h-10 animate-spin"
                            style={{ color: "var(--color-primary)" }}
                        />
                        <p
                            className="text-sm font-medium"
                            style={{ color: "var(--color-text-secondary)" }}
                        >
                            Processando PDF...
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-200 hover:scale-110"
                            style={{ background: "var(--color-primary-subtle)" }}
                        >
                            <Upload className="w-7 h-7" style={{ color: "var(--color-primary)" }} />
                        </div>
                        <div>
                            <p
                                className="text-sm font-medium"
                                style={{ color: "var(--color-text-secondary)" }}
                            >
                                Arraste PDFs aqui ou{" "}
                                <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                                    clique para selecionar
                                </span>
                            </p>
                            <p
                                className="text-xs mt-1"
                                style={{ color: "var(--color-text-muted)" }}
                            >
                                Aceita múltiplos arquivos PDF (máx. 50MB cada)
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
                {[
                    { key: "all", label: "Todas" },
                    { key: "completed", label: "Concluídas" },
                    { key: "processing", label: "Processando" },
                    { key: "error", label: "Erros" },
                ].map((s) => (
                    <button
                        key={s.key}
                        onClick={() => {
                            setStatusFilter(s.key);
                            setPage(1);
                        }}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
                        style={{
                            background:
                                statusFilter === s.key
                                    ? "var(--color-primary-subtle)"
                                    : "transparent",
                            color:
                                statusFilter === s.key
                                    ? "var(--color-primary)"
                                    : "var(--color-text-muted)",
                            border: `1px solid ${statusFilter === s.key
                                    ? "var(--color-primary)"
                                    : "transparent"
                                }`,
                        }}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Analyses List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2
                        className="w-8 h-8 animate-spin"
                        style={{ color: "var(--color-primary)" }}
                    />
                </div>
            ) : analyses.length === 0 ? (
                <div className="card text-center py-16 animate-in-scale">
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: "var(--color-primary-subtle)" }}
                    >
                        <Bot className="w-8 h-8" style={{ color: "var(--color-text-muted)" }} />
                    </div>
                    <h3
                        className="text-lg font-semibold mb-2"
                        style={{ color: "var(--color-text-primary)" }}
                    >
                        Nenhuma análise encontrada
                    </h3>
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                        Envie um PDF de edital para começar a análise inteligente
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {analyses.map((a, i) => (
                        <div
                            key={a.id}
                            className={`card card-interactive !p-4 flex items-center gap-4 stagger-${Math.min(i + 1, 10)} animate-in`}
                            style={{ animationFillMode: "both", opacity: 0 }}
                            onClick={() => router.push(`/analises/${a.id}`)}
                        >
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 hover:scale-110"
                                style={{
                                    background:
                                        a.source_type === "upload"
                                            ? "var(--color-primary-subtle)"
                                            : "rgba(34, 197, 94, 0.1)",
                                }}
                            >
                                <FileText
                                    className="w-5 h-5"
                                    style={{
                                        color:
                                            a.source_type === "upload"
                                                ? "var(--color-primary)"
                                                : "var(--color-success)",
                                    }}
                                />
                            </div>

                            <div className="flex-1 min-w-0">
                                <p
                                    className="text-sm font-medium truncate"
                                    style={{ color: "var(--color-text-primary)" }}
                                >
                                    {a.pdf_filename || "Documento sem nome"}
                                </p>
                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                    <span
                                        className="text-xs"
                                        style={{ color: "var(--color-text-muted)" }}
                                    >
                                        {formatDateLocal(a.created_at)}
                                    </span>
                                    {a.page_count && (
                                        <span
                                            className="text-xs"
                                            style={{ color: "var(--color-text-muted)" }}
                                        >
                                            {a.page_count} págs
                                        </span>
                                    )}
                                    <span
                                        className="text-xs"
                                        style={{ color: "var(--color-text-muted)" }}
                                    >
                                        {formatSize(a.pdf_size_bytes)}
                                    </span>
                                    {a.processing_time_ms && (
                                        <span
                                            className="text-xs"
                                            style={{ color: "var(--color-text-muted)" }}
                                        >
                                            {(a.processing_time_ms / 1000).toFixed(1)}s
                                        </span>
                                    )}
                                </div>
                            </div>

                            {getStatusBadge(a.status)}

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmId(a.id);
                                }}
                                className="btn-ghost !p-2"
                                title="Excluir"
                                aria-label="Excluir análise"
                            >
                                <Trash2 className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
                            </button>

                            <ArrowRight
                                className="w-4 h-4 flex-shrink-0"
                                style={{ color: "var(--color-text-muted)" }}
                            />
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
                            className="w-8 h-8 rounded-lg text-sm font-medium transition-all duration-200"
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

            {/* Delete confirmation */}
            <ConfirmModal
                isOpen={!!deleteConfirmId}
                title="Excluir análise"
                message="Deseja realmente excluir esta análise? Esta ação não pode ser desfeita."
                confirmLabel="Excluir"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirmId(null)}
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    );
}
