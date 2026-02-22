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
    Search,
    X,
    Loader2,
    MapPin,
    Tag,
    ChevronDown,
    ChevronUp,
    History,
    CheckCircle2,
    AlertCircle,
} from "lucide-react";

export default function AutomacoesPage() {
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [runs, setRuns] = useState<Record<string, AutomationRun[]>>({});
    const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadAutomations();
    }, []);

    async function loadAutomations() {
        try {
            const data = await api.listAutomations();
            setAutomations(data);
        } finally {
            setLoading(false);
        }
    }

    async function toggleActive(auto: Automation) {
        await api.updateAutomation(auto.id, { is_active: !auto.is_active } as any);
        loadAutomations();
    }

    async function deleteAutomation(id: string) {
        if (!confirm("Deseja realmente excluir esta automação e todos os seus resultados?")) return;
        await api.deleteAutomation(id);
        loadAutomations();
    }

    async function triggerRun(id: string) {
        setRunningIds((prev) => new Set(prev).add(id));
        try {
            await api.triggerAutomation(id);
            loadAutomations();
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
        await api.createAutomation(data);
        setShowForm(false);
        loadAutomations();
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }} />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto animate-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>Automações</h1>
                    <p style={{ color: "var(--color-text-secondary)" }}>
                        Configure buscas automáticas no PNCP
                    </p>
                </div>
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                    {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showForm ? "Cancelar" : "Nova Automação"}
                </button>
            </div>

            {/* Create Form */}
            {showForm && <CreateForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />}

            {/* Automations List */}
            {automations.length === 0 && !showForm ? (
                <div className="card text-center py-16">
                    <Bot className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--color-text-muted)" }} />
                    <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>Nenhuma automação</h2>
                    <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
                        Crie sua primeira automação para começar a monitorar editais
                    </p>
                    <button className="btn-primary" onClick={() => setShowForm(true)}>
                        <Plus className="w-4 h-4" /> Criar Automação
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {automations.map((auto) => (
                        <div key={auto.id} className="card" style={auto.is_active ? {} : { opacity: 0.6 }}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{
                                            background: auto.is_active
                                                ? "rgba(99, 102, 241, 0.15)"
                                                : "rgba(100, 116, 139, 0.15)",
                                        }}
                                    >
                                        <Bot
                                            className="w-5 h-5"
                                            style={{
                                                color: auto.is_active ? "var(--color-primary)" : "var(--color-text-muted)",
                                            }}
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-base font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                                                {auto.name}
                                            </h3>
                                            <span className={`badge ${auto.is_active ? "badge-active" : "badge-discarded"}`}>
                                                {auto.is_active ? "Ativa" : "Pausada"}
                                            </span>
                                        </div>

                                        {/* Filters summary */}
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {auto.uf && (
                                                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md" style={{ background: "var(--color-bg-secondary)", color: "var(--color-text-secondary)" }}>
                                                    <MapPin className="w-3 h-3" /> {auto.uf}
                                                </span>
                                            )}
                                            {auto.modalidade_ids?.map((m) => (
                                                <span key={m} className="text-xs px-2 py-1 rounded-md" style={{ background: "var(--color-bg-secondary)", color: "var(--color-text-secondary)" }}>
                                                    {MODALIDADES[m] || `Mod. ${m}`}
                                                </span>
                                            ))}
                                            {auto.keywords?.map((kw) => (
                                                <span key={kw} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md" style={{ background: "rgba(99,102,241,0.1)", color: "var(--color-primary)" }}>
                                                    <Tag className="w-3 h-3" /> {kw}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Schedule info */}
                                        <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                                            <span className="inline-flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                A cada {auto.interval_hours}h
                                            </span>
                                            {auto.last_run_at && (
                                                <span>Última: {timeAgo(auto.last_run_at)} atrás</span>
                                            )}
                                            {auto.next_run_at && (
                                                <span>Próxima: {formatDateTime(auto.next_run_at)}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                    <button
                                        className="btn-ghost !p-2"
                                        onClick={() => toggleExpand(auto.id)}
                                        title="Histórico"
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
                                    >
                                        <Pause className="w-4 h-4" style={{ color: "var(--color-warning)" }} />
                                    </button>
                                    <button
                                        className="btn-ghost !p-2"
                                        onClick={() => deleteAutomation(auto.id)}
                                        title="Excluir"
                                    >
                                        <Trash2 className="w-4 h-4" style={{ color: "var(--color-danger)" }} />
                                    </button>
                                </div>
                            </div>

                            {/* Runs history */}
                            {expandedId === auto.id && (
                                <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-muted)" }}>
                                        Histórico de Execuções
                                    </h4>
                                    {runs[auto.id]?.length ? (
                                        <div className="space-y-2">
                                            {runs[auto.id].slice(0, 5).map((run) => (
                                                <div
                                                    key={run.id}
                                                    className="flex items-center justify-between p-2 rounded-lg text-xs"
                                                    style={{ background: "var(--color-bg-secondary)" }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {run.status === "success" ? (
                                                            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--color-success)" }} />
                                                        ) : run.status === "error" ? (
                                                            <AlertCircle className="w-3.5 h-3.5" style={{ color: "var(--color-danger)" }} />
                                                        ) : (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--color-warning)" }} />
                                                        )}
                                                        <span style={{ color: "var(--color-text-secondary)" }}>
                                                            {formatDateTime(run.started_at)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4" style={{ color: "var(--color-text-muted)" }}>
                                                        <span>{run.results_found} encontrado(s)</span>
                                                        <span style={{ color: run.results_new > 0 ? "var(--color-success)" : undefined }}>
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
        </div>
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
                keywords: keywords ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
                keywords_exclude: keywordsExclude ? keywordsExclude.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
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
        <form onSubmit={handleSubmit} className="card mb-6">
            <h2 className="text-lg font-semibold mb-5" style={{ color: "var(--color-text-primary)" }}>Nova Automação</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                        Nome da automação *
                    </label>
                    <input
                        className="input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Pregões de TI em São Paulo"
                        required
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                        Tipo de busca
                    </label>
                    <select
                        className="input"
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
                    <label className="block text-xs font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                        Estado (UF)
                    </label>
                    <select className="input" value={uf} onChange={(e) => setUf(e.target.value)}>
                        <option value="">Todo Brasil</option>
                        {UFS.map((u) => (
                            <option key={u} value={u}>{u}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                        Intervalo entre execuções
                    </label>
                    <select
                        className="input"
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

            {/* Modalidades */}
            <div className="mb-4">
                <label className="block text-xs font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                    Modalidades
                </label>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(MODALIDADES).map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            className="text-xs px-3 py-1.5 rounded-full transition-all"
                            style={{
                                background: modalidades.includes(Number(id))
                                    ? "var(--color-primary)"
                                    : "var(--color-bg-secondary)",
                                color: modalidades.includes(Number(id))
                                    ? "white"
                                    : "var(--color-text-secondary)",
                                border: `1px solid ${modalidades.includes(Number(id)) ? "var(--color-primary)" : "var(--color-border)"
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
                    <label className="block text-xs font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                        Palavras-chave (separadas por vírgula)
                    </label>
                    <input
                        className="input"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder="software, tecnologia, computador"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                        Excluir palavras (separadas por vírgula)
                    </label>
                    <input
                        className="input"
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
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Criar Automação
                </button>
            </div>
        </form>
    );
}
