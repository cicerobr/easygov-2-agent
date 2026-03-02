"use client";

import { useEffect, useState } from "react";
import { api, type Automation, type AutomationRun } from "@/lib/api";
import { formatDateTime, timeAgo, MODALIDADES, UFS } from "@/lib/utils";
import {
    Bot,
    Plus,
    Play,
    Pause,
    Trash2,
    Clock,
    X,
    Loader2,
    MapPin,
    Tag,
    ChevronUp,
    History,
    CheckCircle2,
    AlertCircle,
} from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { ConfirmModal } from "@/components/confirm-modal";
import { SkeletonList } from "@/components/skeleton";
import { useToast } from "@/components/toast";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export default function AutomacoesPage() {
    const toast = useToast();
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [runs, setRuns] = useState<Record<string, AutomationRun[]>>({});
    const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        loadAutomations();
    }, []);

    async function loadAutomations() {
        try {
            const data = await api.listAutomations();
            setAutomations(data);
        } catch (error) {
            console.error(error);
            setAutomations([]);
            toast.error("Não foi possível carregar as automações. Verifique a conexão com o backend.");
        } finally {
            setLoading(false);
        }
    }

    async function toggleActive(auto: Automation) {
        const newState = !auto.is_active;
        await api.updateAutomation(auto.id, { is_active: newState } as any);
        toast.success(newState ? `"${auto.name}" ativada` : `"${auto.name}" pausada`);
        loadAutomations();
    }

    async function confirmDelete() {
        if (!deleteConfirmId) return;
        setIsDeleting(true);
        const targetId = deleteConfirmId;
        const name = automations.find((a) => a.id === targetId)?.name;
        try {
            await api.deleteAutomation(targetId);
            setAutomations((prev) => prev.filter((a) => a.id !== targetId));
            setRuns((prev) => {
                const next = { ...prev };
                delete next[targetId];
                return next;
            });
            if (expandedId === targetId) {
                setExpandedId(null);
            }
            setDeleteConfirmId(null);
            toast.success(`"${name}" excluída com sucesso`);
            await loadAutomations();
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message.replace(/^API Error \d+:\s*/i, "")
                    : "Falha ao excluir automação. Tente novamente.";
            toast.error(message || "Falha ao excluir automação. Tente novamente.");
        } finally {
            setIsDeleting(false);
        }
    }

    async function triggerRun(id: string) {
        setRunningIds((prev) => new Set(prev).add(id));
        try {
            await api.triggerAutomation(id);
            toast.success("Execução iniciada com sucesso!");
            loadAutomations();
        } catch {
            toast.error("Falha ao executar automação.");
        } finally {
            setRunningIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    }

    async function toggleExpand(id: string) {
        if (expandedId === id) {
            setExpandedId(null);
            return;
        }
        setExpandedId(id);
        if (!runs[id]) {
            const data = await api.listAutomationRuns(id);
            setRuns((prev) => ({ ...prev, [id]: data }));
        }
    }

    async function handleCreate(data: any) {
        const created = await api.createAutomation(data);
        setAutomations((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
        setShowForm(false);
        toast.success("Automação criada com sucesso!");
        await loadAutomations();
    }

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <div className="skeleton" style={{ height: 28, width: 160, marginBottom: 8 }} />
                    <div className="skeleton skeleton-text medium" />
                </div>
                <SkeletonList count={3} />
            </div>
        );
    }

    return (
        <>
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <PageHeader
                    title="Automações"
                    subtitle="Configure buscas automáticas no PNCP"
                    actions={
                        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {showForm ? "Cancelar" : "Nova Automação"}
                        </button>
                    }
                />

                {/* Automations List */}
                {automations.length === 0 && !showForm ? (
                    <div>
                        <EmptyState
                            icon={Bot}
                            title="Nenhuma automação"
                            description="Crie sua primeira automação para começar a monitorar editais"
                        />
                        <div className="flex justify-center mt-6">
                            <button className="btn-primary" onClick={() => setShowForm(true)}>
                                <Plus className="w-4 h-4" /> Criar Automação
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {automations.map((auto, i) => (
                            <div
                                key={auto.id}
                                className={`card animate-in-up stagger-${Math.min(i + 1, 10)}`}
                                style={{
                                    opacity: auto.is_active ? 1 : 0.6,
                                    animationFillMode: "both",
                                }}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4 flex-1 min-w-0">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 hover:scale-110"
                                            style={{
                                                background: auto.is_active
                                                    ? "var(--color-primary-subtle)"
                                                    : "rgba(100, 116, 139, 0.1)",
                                            }}
                                        >
                                            <Bot
                                                className="w-5 h-5"
                                                style={{
                                                    color: auto.is_active
                                                        ? "var(--color-primary)"
                                                        : "var(--color-text-muted)",
                                                }}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <h3
                                                    className="text-base font-semibold truncate"
                                                    style={{ color: "var(--color-text-primary)" }}
                                                >
                                                    {auto.name}
                                                </h3>
                                                <span
                                                    className={`badge ${auto.is_active ? "badge-active" : "badge-discarded"}`}
                                                >
                                                    {auto.is_active ? "Ativa" : "Pausada"}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {auto.uf && (
                                                    <span
                                                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                                                        style={{
                                                            background: "var(--color-bg-secondary)",
                                                            color: "var(--color-text-secondary)",
                                                        }}
                                                    >
                                                        <MapPin className="w-3 h-3" /> {auto.uf}
                                                    </span>
                                                )}
                                                {auto.modalidade_ids?.map((m) => (
                                                    <span
                                                        key={m}
                                                        className="text-xs px-2 py-1 rounded-lg"
                                                        style={{
                                                            background: "var(--color-bg-secondary)",
                                                            color: "var(--color-text-secondary)",
                                                        }}
                                                    >
                                                        {MODALIDADES[m] || `Mod. ${m}`}
                                                    </span>
                                                ))}
                                                {auto.keywords?.map((kw) => (
                                                    <span
                                                        key={kw}
                                                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                                                        style={{
                                                            background: "var(--color-primary-subtle)",
                                                            color: "var(--color-primary)",
                                                        }}
                                                    >
                                                        <Tag className="w-3 h-3" /> {kw}
                                                    </span>
                                                ))}
                                            </div>

                                            <div
                                                className="flex items-center gap-4 mt-3 text-xs flex-wrap"
                                                style={{ color: "var(--color-text-muted)" }}
                                            >
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />A cada {auto.interval_hours}h
                                                </span>
                                                {auto.last_run_at && <span>Última: {timeAgo(auto.last_run_at)} atrás</span>}
                                                {auto.next_run_at && <span>Próxima: {formatDateTime(auto.next_run_at)}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
                                        <button
                                            className="btn-ghost !p-2"
                                            onClick={() => toggleExpand(auto.id)}
                                            title="Histórico"
                                            aria-label="Ver histórico de execuções"
                                        >
                                            {expandedId === auto.id ? (
                                                <ChevronUp className="w-4 h-4" />
                                            ) : (
                                                <History className="w-4 h-4" />
                                            )}
                                        </button>
                                        <button
                                            className="btn-ghost !p-2"
                                            onClick={() => triggerRun(auto.id)}
                                            title="Executar agora"
                                            aria-label="Executar automação agora"
                                            disabled={runningIds.has(auto.id)}
                                        >
                                            {runningIds.has(auto.id) ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Play className="w-4 h-4" style={{ color: "var(--color-success)" }} />
                                            )}
                                        </button>
                                        <button
                                            className="btn-ghost !p-2"
                                            onClick={() => toggleActive(auto)}
                                            title={auto.is_active ? "Pausar" : "Ativar"}
                                            aria-label={auto.is_active ? "Pausar automação" : "Ativar automação"}
                                        >
                                            <Pause className="w-4 h-4" style={{ color: "var(--color-warning)" }} />
                                        </button>
                                        <button
                                            className="btn-ghost !p-2"
                                            onClick={() => setDeleteConfirmId(auto.id)}
                                            disabled={isDeleting}
                                            title="Excluir"
                                            aria-label="Excluir automação"
                                        >
                                            <Trash2 className="w-4 h-4" style={{ color: "var(--color-danger)" }} />
                                        </button>
                                    </div>
                                </div>

                                {/* Runs history */}
                                {expandedId === auto.id && (
                                    <div
                                        className="mt-4 pt-4 animate-in"
                                        style={{ borderTop: "1px solid var(--color-border)" }}
                                    >
                                        <h4
                                            className="text-xs font-semibold uppercase tracking-wider mb-3"
                                            style={{ color: "var(--color-text-muted)" }}
                                        >
                                            Histórico de Execuções
                                        </h4>
                                        {runs[auto.id]?.length ? (
                                            <div className="space-y-2">
                                                {runs[auto.id].slice(0, 5).map((run, ri) => (
                                                    <div
                                                        key={run.id}
                                                        className={`flex items-center justify-between p-3 rounded-xl text-xs transition-all duration-200 hover:scale-[1.01] stagger-${ri + 1} animate-in`}
                                                        style={{
                                                            background: "var(--color-bg-secondary)",
                                                            opacity: 0,
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {run.status === "success" ? (
                                                                <CheckCircle2
                                                                    className="w-3.5 h-3.5"
                                                                    style={{ color: "var(--color-success)" }}
                                                                />
                                                            ) : run.status === "error" ? (
                                                                <AlertCircle
                                                                    className="w-3.5 h-3.5"
                                                                    style={{ color: "var(--color-danger)" }}
                                                                />
                                                            ) : (
                                                                <Loader2
                                                                    className="w-3.5 h-3.5 animate-spin"
                                                                    style={{ color: "var(--color-warning)" }}
                                                                />
                                                            )}
                                                            <span style={{ color: "var(--color-text-secondary)" }}>
                                                                {formatDateTime(run.started_at)}
                                                            </span>
                                                        </div>
                                                        <div
                                                            className="flex items-center gap-4"
                                                            style={{ color: "var(--color-text-muted)" }}
                                                        >
                                                            <span>{run.results_found} encontrado(s)</span>
                                                            <span
                                                                style={{
                                                                    color: run.results_new > 0 ? "var(--color-success)" : undefined,
                                                                    fontWeight: run.results_new > 0 ? 600 : undefined,
                                                                }}
                                                            >
                                                                {run.results_new} novo(s)
                                                            </span>
                                                            <span>{run.pages_searched} pág(s)</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                                Nenhuma execução registrada
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Create Form Modal */}
                {showForm && (
                    <ModalPortal>
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div
                                className="absolute inset-0 modal-overlay-enter"
                                style={{ background: "var(--color-overlay)", backdropFilter: "blur(4px)" }}
                                onClick={() => setShowForm(false)}
                            />
                            <div
                                className="relative rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-content-enter"
                                style={{
                                    background: "var(--color-bg-card)",
                                    border: "1px solid var(--color-border)",
                                }}
                            >
                                <div className="p-6">
                                    <CreateForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
                                </div>
                            </div>
                        </div>
                    </ModalPortal>
                )}
            </div>

            {/* Delete confirmation modal */}
            <ConfirmModal
                isOpen={!!deleteConfirmId}
                title="Excluir automação"
                message="Deseja realmente excluir esta automação e todos os resultados vinculados? Esta ação não pode ser desfeita."
                confirmLabel="Excluir"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirmId(null)}
                variant="danger"
                isLoading={isDeleting}
            />
        </>
    );
}

function CreateForm({
    onSubmit,
    onCancel,
}: {
    onSubmit: (data: any) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState("");
    const [searchType, setSearchType] = useState("publicacao");
    const [uf, setUf] = useState("");
    const [modalidades, setModalidades] = useState<number[]>([8]);
    const [keywords, setKeywords] = useState("");
    const [keywordsExclude, setKeywordsExclude] = useState("");
    const [intervalHours, setIntervalHours] = useState(6);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        try {
            await onSubmit({
                name,
                search_type: searchType,
                uf: uf || undefined,
                modalidade_ids: modalidades.length ? modalidades : undefined,
                keywords: keywords
                    ? keywords
                        .split(",")
                        .map((k) => k.trim())
                        .filter(Boolean)
                    : undefined,
                keywords_exclude: keywordsExclude
                    ? keywordsExclude
                        .split(",")
                        .map((k) => k.trim())
                        .filter(Boolean)
                    : undefined,
                interval_hours: intervalHours,
            });
        } finally {
            setSubmitting(false);
        }
    }

    function toggleModalidade(id: number) {
        setModalidades((prev) =>
            prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            <h2
                className="text-lg font-bold mb-5"
                style={{ color: "var(--color-text-primary)" }}
            >
                Nova Automação
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label
                        htmlFor="automation-name"
                        className="block text-xs font-medium mb-2"
                        style={{ color: "var(--color-text-secondary)" }}
                    >
                        Nome da automação *
                    </label>
                    <input
                        id="automation-name"
                        className="input"
                        aria-label="Nome da automação"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Pregões de TI em São Paulo"
                        required
                    />
                </div>
                <div>
                    <label
                        htmlFor="automation-search-type"
                        className="block text-xs font-medium mb-2"
                        style={{ color: "var(--color-text-secondary)" }}
                    >
                        Tipo de busca
                    </label>
                    <select
                        id="automation-search-type"
                        className="input"
                        aria-label="Tipo de busca"
                        value={searchType}
                        onChange={(e) => setSearchType(e.target.value)}
                    >
                        <option value="publicacao">Por Data de Publicação</option>
                        <option value="proposta">Com Propostas Abertas</option>
                        <option value="atualizacao">Por Data de Atualização</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label
                        htmlFor="automation-uf"
                        className="block text-xs font-medium mb-2"
                        style={{ color: "var(--color-text-secondary)" }}
                    >
                        Estado (UF)
                    </label>
                    <select
                        id="automation-uf"
                        className="input"
                        aria-label="Estado UF"
                        value={uf}
                        onChange={(e) => setUf(e.target.value)}
                    >
                        <option value="">Todo Brasil</option>
                        {UFS.map((u) => (
                            <option key={u} value={u}>
                                {u}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label
                        htmlFor="automation-interval-hours"
                        className="block text-xs font-medium mb-2"
                        style={{ color: "var(--color-text-secondary)" }}
                    >
                        Intervalo entre execuções
                    </label>
                    <select
                        id="automation-interval-hours"
                        className="input"
                        aria-label="Intervalo entre execuções em horas"
                        value={intervalHours}
                        onChange={(e) => setIntervalHours(Number(e.target.value))}
                    >
                        <option value={1}>A cada 1 hora</option>
                        <option value={2}>A cada 2 horas</option>
                        <option value={4}>A cada 4 horas</option>
                        <option value={6}>A cada 6 horas</option>
                        <option value={12}>A cada 12 horas</option>
                        <option value={24}>A cada 24 horas</option>
                    </select>
                </div>
            </div>

            <div className="mb-4">
                <label
                    className="block text-xs font-medium mb-2"
                    style={{ color: "var(--color-text-secondary)" }}
                >
                    Modalidades
                </label>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(MODALIDADES).map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            className="text-xs px-3 py-1.5 rounded-full transition-all duration-200"
                            style={{
                                background: modalidades.includes(Number(id))
                                    ? "var(--color-primary)"
                                    : "var(--color-bg-secondary)",
                                color: modalidades.includes(Number(id))
                                    ? "white"
                                    : "var(--color-text-secondary)",
                                border: `1px solid ${modalidades.includes(Number(id))
                                        ? "var(--color-primary)"
                                        : "var(--color-border)"
                                    }`,
                            }}
                            onClick={() => toggleModalidade(Number(id))}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <label
                        htmlFor="automation-keywords"
                        className="block text-xs font-medium mb-2"
                        style={{ color: "var(--color-text-secondary)" }}
                    >
                        Palavras-chave (separadas por vírgula)
                    </label>
                    <input
                        id="automation-keywords"
                        className="input"
                        aria-label="Palavras-chave da automação"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder="software, tecnologia, computador"
                    />
                </div>
                <div>
                    <label
                        htmlFor="automation-keywords-exclude"
                        className="block text-xs font-medium mb-2"
                        style={{ color: "var(--color-text-secondary)" }}
                    >
                        Excluir palavras (separadas por vírgula)
                    </label>
                    <input
                        id="automation-keywords-exclude"
                        className="input"
                        aria-label="Palavras-chave excluídas da automação"
                        value={keywordsExclude}
                        onChange={(e) => setKeywordsExclude(e.target.value)}
                        placeholder="obras, construção"
                    />
                </div>
            </div>

            <div className="flex items-center gap-3 justify-end">
                <button type="button" className="btn-ghost" onClick={onCancel}>
                    Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={!name || submitting}>
                    {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Plus className="w-4 h-4" />
                    )}
                    Criar Automação
                </button>
            </div>
        </form>
    );
}
