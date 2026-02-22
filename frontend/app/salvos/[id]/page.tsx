"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Building2,
    Calendar,
    MapPin,
    Tag,
    FileText,
    Package,
    Download,
    ExternalLink,
    Bookmark,
    Trash2,
    Clock,
    DollarSign,
    Hash,
    Info,
    ShieldCheck,
    Scale,
    Loader2,
    AlertCircle,
    Box,
    ChevronRight,
    Bot,
    CheckCircle2,
    Users,
    Gavel,
    Truck,
    CreditCard,
    AlertTriangle,
    X,
    Save,
} from "lucide-react";
import { api, SearchResultDetail, ResultItem, ResultDocument, EditalAnalysis } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

type TabId = "geral" | "itens" | "documentos" | "detalhes_edital";

export default function SalvoDetailPage() {
    const params = useParams();
    const router = useRouter();
    const resultId = params.id as string;

    const [result, setResult] = useState<SearchResultDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>("geral");
    const [saving, setSaving] = useState(false);
    const [linkedAnalysis, setLinkedAnalysis] = useState<EditalAnalysis | null>(null);
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);
    const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);

    useEffect(() => {
        loadResult();
    }, [resultId]);

    async function loadResult() {
        try {
            setLoading(true);
            setError(null);
            const data = await api.getResultDetail(resultId);
            setResult(data);
            // Try to load existing analysis for this result
            try {
                const analysis = await api.getAnalysisByResultId(resultId);
                setLinkedAnalysis(analysis);
            } catch {
                // No analysis exists yet - that's fine
            }
        } catch (err) {
            setError("Erro ao carregar detalhes do edital.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    function handleAnalyzeDoc(docId: string) {
        setAnalyzingDocId(docId);
        setShowAnalysisModal(true);
    }

    function handleAnalysisComplete(analysis: EditalAnalysis) {
        setLinkedAnalysis(analysis);
        setShowAnalysisModal(false);
        setAnalyzingDocId(null);
        setActiveTab("detalhes_edital");
    }

    async function handleAction(action: "saved" | "discarded") {
        if (!result) return;
        setSaving(true);
        try {
            await api.updateResultStatus(result.id, action);
            if (action === "discarded") {
                router.push("/salvos");
            } else {
                setResult({ ...result, status: action });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "var(--color-primary)" }} />
                    <p style={{ color: "var(--color-text-secondary)" }}>
                        Carregando detalhes e buscando itens e documentos no PNCP...
                    </p>
                </div>
            </div>
        );
    }

    if (error || !result) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <div className="text-center">
                    <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--color-danger)" }} />
                    <p className="mb-4" style={{ color: "var(--color-danger)" }}>{error || "Edital não encontrado"}</p>
                    <button onClick={() => router.back()} className="btn-primary">
                        Voltar
                    </button>
                </div>
            </div>
        );
    }

    const tabs: { id: TabId; label: string; icon: typeof FileText; count?: number; highlight?: boolean }[] = [
        { id: "geral", label: "Informações Gerais", icon: Info },
        { id: "itens", label: "Itens", icon: Package, count: result.items.length },
        { id: "documentos", label: "Documentos", icon: FileText, count: result.documents.length },
        ...(linkedAnalysis ? [{ id: "detalhes_edital" as TabId, label: "Detalhes do Edital", icon: Bot, highlight: true }] : []),
    ];

    const statusColors: Record<string, string> = {
        pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        saved: "bg-green-500/20 text-green-400 border-green-500/30",
        discarded: "bg-red-500/20 text-red-400 border-red-500/30",
    };

    const statusLabels: Record<string, string> = {
        pending: "Pendente",
        saved: "Salvo",
        discarded: "Descartado",
    };

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={() => router.push("/salvos")}
                    className="flex items-center gap-2 transition-colors mb-4"
                    style={{ color: "var(--color-text-secondary)" }}
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para Editais Salvos
                </button>

                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className={`badge border ${statusColors[result.status]}`}>
                                {statusLabels[result.status]}
                            </span>
                            {result.modalidade_nome && (
                                <span
                                    className="badge"
                                    style={{
                                        background: "var(--color-bg-tertiary)",
                                        color: "var(--color-text-secondary)",
                                    }}
                                >
                                    {result.modalidade_nome}
                                </span>
                            )}
                            {result.srp && (
                                <span className="badge bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                    SRP
                                </span>
                            )}
                        </div>
                        <h1
                            className="text-xl font-semibold leading-tight mb-2"
                            style={{ color: "var(--color-text-primary)" }}
                        >
                            {result.objeto_compra || "Sem descrição"}
                        </h1>
                        <p className="text-sm font-mono" style={{ color: "var(--color-text-muted)" }}>
                            {result.numero_controle_pncp}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={() => handleAction("discarded")}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Remover
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div
                className="flex gap-1 mb-6 rounded-xl p-1"
                style={{ background: "var(--color-bg-secondary)" }}
            >
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${activeTab === tab.id
                            ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                            : ""
                            }`}
                        style={
                            activeTab !== tab.id
                                ? { color: "var(--color-text-secondary)" }
                                : undefined
                        }
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span
                                className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === tab.id
                                    ? "bg-white/20 text-white"
                                    : "bg-purple-500/20 text-purple-400"
                                    }`}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="animate-in">
                {activeTab === "geral" && <GeneralTab result={result} />}
                {activeTab === "itens" && <ItemsTab items={result.items} />}
                {activeTab === "documentos" && (
                    <DocumentsTab
                        documents={result.documents}
                        cnpjOrgao={result.cnpj_orgao}
                        anoCompra={result.ano_compra}
                        sequencialCompra={result.sequencial_compra}
                        onAnalyze={handleAnalyzeDoc}
                        analyzingDocId={analyzingDocId}
                    />
                )}
                {activeTab === "detalhes_edital" && linkedAnalysis && (
                    <EditalDetailsTab analysis={linkedAnalysis} />
                )}
            </div>

            {/* Analysis Modal */}
            {showAnalysisModal && analyzingDocId && (
                <AnalysisModal
                    documentId={analyzingDocId}
                    onComplete={handleAnalysisComplete}
                    onClose={() => { setShowAnalysisModal(false); setAnalyzingDocId(null); }}
                />
            )}
        </div>
    );
}

// ─── General Info Tab ────────────────────────────────────────────────────────

function GeneralTab({ result }: { result: SearchResultDetail }) {
    const infoSections = [
        {
            title: "Órgão / Entidade",
            icon: Building2,
            items: [
                { label: "Nome", value: result.orgao_nome },
                { label: "CNPJ", value: formatCNPJ(result.cnpj_orgao) },
                { label: "UF", value: result.uf },
                { label: "Município", value: result.municipio },
            ],
        },
        {
            title: "Contratação",
            icon: Scale,
            items: [
                { label: "Modalidade", value: result.modalidade_nome },
                { label: "Modo de Disputa", value: result.modo_disputa_nome },
                { label: "Situação", value: result.situacao_compra_nome },
                {
                    label: "Valor Total Estimado",
                    value: result.valor_total_estimado
                        ? formatCurrency(result.valor_total_estimado)
                        : null,
                    highlight: true,
                },
                {
                    label: "SRP (Registro de Preços)",
                    value: result.srp ? "Sim" : "Não",
                },
            ],
        },
        {
            title: "Datas",
            icon: Calendar,
            items: [
                {
                    label: "Publicação",
                    value: result.data_publicacao
                        ? formatDateTime(result.data_publicacao)
                        : null,
                },
                {
                    label: "Abertura de Propostas",
                    value: result.data_abertura_proposta
                        ? formatDateTime(result.data_abertura_proposta)
                        : null,
                },
                {
                    label: "Encerramento de Propostas",
                    value: result.data_encerramento_proposta
                        ? formatDateTime(result.data_encerramento_proposta)
                        : null,
                    highlight: true,
                },
                {
                    label: "Encontrado em",
                    value: formatDateTime(result.found_at),
                },
            ],
        },
    ];

    return (
        <div className="space-y-4">
            {/* Summary Card */}
            <div className="card p-6">
                <h3
                    className="text-sm font-semibold uppercase tracking-wider mb-3"
                    style={{ color: "var(--color-text-secondary)" }}
                >
                    Resumo da Contratação
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <StatMini
                        label="Valor Estimado"
                        value={
                            result.valor_total_estimado
                                ? formatCurrency(result.valor_total_estimado)
                                : "Sigiloso"
                        }
                        icon={DollarSign}
                        color="green"
                    />
                    <StatMini
                        label="Itens"
                        value={String(result.items.length)}
                        icon={Package}
                        color="blue"
                    />
                    <StatMini
                        label="Documentos"
                        value={String(result.documents.length)}
                        icon={FileText}
                        color="purple"
                    />
                    <StatMini
                        label="Situação"
                        value={result.situacao_compra_nome || "—"}
                        icon={ShieldCheck}
                        color="yellow"
                    />
                </div>
            </div>

            {/* Info Sections */}
            {infoSections.map((section) => (
                <div key={section.title} className="card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <section.icon className="w-5 h-5 text-purple-400" />
                        <h3
                            className="text-sm font-semibold uppercase tracking-wider"
                            style={{ color: "var(--color-text-secondary)" }}
                        >
                            {section.title}
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {section.items.map((item) => (
                            <div key={item.label}>
                                <span
                                    className="text-xs uppercase tracking-wide"
                                    style={{ color: "var(--color-text-muted)" }}
                                >
                                    {item.label}
                                </span>
                                <p
                                    className="text-sm mt-0.5"
                                    style={{
                                        color: item.highlight
                                            ? "var(--color-success)"
                                            : "var(--color-text-primary)",
                                        fontWeight: item.highlight ? 600 : 400,
                                    }}
                                >
                                    {item.value || "—"}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Links */}
            {(result.link_sistema_origem || result.link_processo_eletronico) && (
                <div className="card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <ExternalLink className="w-5 h-5 text-purple-400" />
                        <h3
                            className="text-sm font-semibold uppercase tracking-wider"
                            style={{ color: "var(--color-text-secondary)" }}
                        >
                            Links Externos
                        </h3>
                    </div>
                    <div className="space-y-2">
                        {result.link_sistema_origem && (
                            <a
                                href={result.link_sistema_origem}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors text-sm"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Sistema de Origem
                                <ChevronRight className="w-3 h-3" />
                            </a>
                        )}
                        {result.link_processo_eletronico && (
                            <a
                                href={result.link_processo_eletronico}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors text-sm"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Processo Eletrônico
                                <ChevronRight className="w-3 h-3" />
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Items Tab ───────────────────────────────────────────────────────────────

function ItemsTab({ items }: { items: ResultItem[] }) {
    if (items.length === 0) {
        return (
            <div className="card p-12 text-center">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" style={{ color: "var(--color-text-muted)" }} />
                <p style={{ color: "var(--color-text-secondary)" }}>Nenhum item encontrado para este edital.</p>
            </div>
        );
    }

    const totalValue = items.reduce((sum, item) => sum + (item.valor_total || 0), 0);

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="card p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Package className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Total de itens</p>
                            <p className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>{items.length}</p>
                        </div>
                    </div>
                    {totalValue > 0 && (
                        <div className="text-right">
                            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Valor total estimado</p>
                            <p className="text-lg font-bold" style={{ color: "var(--color-success)" }}>{formatCurrency(totalValue)}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Items List */}
            <div className="space-y-3">
                {items.map((item, index) => (
                    <div
                        key={item.id}
                        className="card p-5 hover:border-purple-500/30 transition-all"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        <div className="flex items-start gap-4">
                            <div className="shrink-0 w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
                                <span className="text-sm font-bold text-purple-400">
                                    {item.numero_item}
                                </span>
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4
                                    className="text-sm font-medium mb-2 leading-relaxed"
                                    style={{ color: "var(--color-text-primary)" }}
                                >
                                    {item.descricao || "Sem descrição"}
                                </h4>

                                {/* Tags */}
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {item.material_ou_servico_nome && (
                                        <span
                                            className="badge"
                                            style={{
                                                background: "var(--color-bg-tertiary)",
                                                color: "var(--color-text-secondary)",
                                            }}
                                        >
                                            {item.material_ou_servico === "M" ? "📦" : "🔧"}{" "}
                                            {item.material_ou_servico_nome}
                                        </span>
                                    )}
                                    {item.situacao_compra_item_nome && (
                                        <span className="badge bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                            {item.situacao_compra_item_nome}
                                        </span>
                                    )}
                                    {item.criterio_julgamento_nome && (
                                        <span
                                            className="badge"
                                            style={{
                                                background: "var(--color-bg-tertiary)",
                                                color: "var(--color-text-secondary)",
                                            }}
                                        >
                                            ⚖️ {item.criterio_julgamento_nome}
                                        </span>
                                    )}
                                    {item.tipo_beneficio_nome && (
                                        <span className="badge bg-green-500/10 text-green-400 border border-green-500/20">
                                            {item.tipo_beneficio_nome}
                                        </span>
                                    )}
                                    {item.orcamento_sigiloso && (
                                        <span className="badge bg-red-500/10 text-red-400 border border-red-500/20">
                                            🔒 Sigiloso
                                        </span>
                                    )}
                                </div>

                                {/* Values grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div>
                                        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Quantidade</span>
                                        <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                                            {item.quantidade != null
                                                ? `${item.quantidade} ${item.unidade_medida || ""}`
                                                : "—"}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Valor Unitário</span>
                                        <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                                            {item.valor_unitario_estimado != null && !item.orcamento_sigiloso
                                                ? formatCurrency(item.valor_unitario_estimado)
                                                : "—"}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Valor Total</span>
                                        <p className="text-sm font-semibold" style={{ color: "var(--color-success)" }}>
                                            {item.valor_total != null && !item.orcamento_sigiloso
                                                ? formatCurrency(item.valor_total)
                                                : "—"}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Categoria</span>
                                        <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                                            {item.item_categoria_nome || "—"}
                                        </p>
                                    </div>
                                </div>

                                {/* Additional info */}
                                {item.informacao_complementar && (
                                    <div
                                        className="mt-3 p-3 rounded-lg"
                                        style={{
                                            background: "var(--color-bg-secondary)",
                                            border: "1px solid var(--color-border)",
                                        }}
                                    >
                                        <p className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>
                                            Informação Complementar
                                        </p>
                                        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                                            {item.informacao_complementar}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Documents Tab ───────────────────────────────────────────────────────────

function DocumentsTab({
    documents,
    cnpjOrgao,
    anoCompra,
    sequencialCompra,
    onAnalyze,
    analyzingDocId,
}: {
    documents: ResultDocument[];
    cnpjOrgao: string;
    anoCompra: number;
    sequencialCompra: number;
    onAnalyze: (docId: string) => void;
    analyzingDocId: string | null;
}) {
    if (documents.length === 0) {
        return (
            <div className="card p-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" style={{ color: "var(--color-text-muted)" }} />
                <p style={{ color: "var(--color-text-secondary)" }}>
                    Nenhum documento encontrado para este edital.
                </p>
            </div>
        );
    }

    const docTypeIcons: Record<string, string> = {
        Edital: "📄",
        "Termo de Referência": "📋",
        "Estudo Técnico Preliminar": "📊",
        DFD: "📝",
        Aviso: "📢",
        default: "📎",
    };

    const docTypeColors: Record<string, string> = {
        Edital: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        "Termo de Referência": "bg-purple-500/10 text-purple-400 border-purple-500/20",
        "Estudo Técnico Preliminar": "bg-green-500/10 text-green-400 border-green-500/20",
        DFD: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
        default: "",
    };

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="card p-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                        <FileText className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                            Documentos disponíveis
                        </p>
                        <p className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
                            {documents.length}
                        </p>
                    </div>
                </div>
            </div>

            {/* Document Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {documents.map((doc, index) => {
                    const icon =
                        docTypeIcons[doc.tipo_documento_nome || ""] || docTypeIcons.default;
                    const colorClass =
                        docTypeColors[doc.tipo_documento_nome || ""] || docTypeColors.default;

                    const downloadUrl = doc.url || doc.uri;

                    return (
                        <div
                            key={doc.id}
                            className="card p-4 hover:border-purple-500/30 transition-all group"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <div className="flex items-start gap-3">
                                <div
                                    className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg ${colorClass} border`}
                                >
                                    {icon}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h4
                                        className="text-sm font-medium truncate mb-1"
                                        style={{ color: "var(--color-text-primary)" }}
                                    >
                                        {doc.titulo || "Documento sem título"}
                                    </h4>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {doc.tipo_documento_nome && (
                                            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                                {doc.tipo_documento_nome}
                                            </span>
                                        )}
                                        {doc.data_publicacao_pncp && (
                                            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                                • {formatDate(doc.data_publicacao_pncp)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {downloadUrl && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => onAnalyze(doc.id)}
                                            disabled={analyzingDocId === doc.id}
                                            className="p-2 rounded-lg hover:bg-purple-500/10 transition-all opacity-0 group-hover:opacity-100"
                                            style={{ color: "var(--color-primary)" }}
                                            title="Analisar com IA"
                                        >
                                            {analyzingDocId === doc.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Bot className="w-4 h-4" />
                                            )}
                                        </button>
                                        <a
                                            href={downloadUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-lg hover:text-purple-400 hover:bg-purple-500/10 transition-all opacity-0 group-hover:opacity-100"
                                            style={{ color: "var(--color-text-muted)" }}
                                            title="Baixar documento"
                                        >
                                            <Download className="w-4 h-4" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* PNCP Link */}
            <div className="card p-4">
                <a
                    href={`https://pncp.gov.br/app/editais/${cnpjOrgao}/${anoCompra}/${sequencialCompra}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                >
                    <ExternalLink className="w-4 h-4" />
                    Ver todos os documentos no Portal PNCP
                    <ChevronRight className="w-3 h-3" />
                </a>
            </div>
        </div>
    );
}

// ─── Helper Components ───────────────────────────────────────────────────────

function StatMini({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string;
    value: string;
    icon: typeof DollarSign;
    color: string;
}) {
    const colorMap: Record<string, string> = {
        green: "bg-green-500/10 text-green-400",
        blue: "bg-blue-500/10 text-blue-400",
        purple: "bg-purple-500/10 text-purple-400",
        yellow: "bg-yellow-500/10 text-yellow-400",
    };

    return (
        <div
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{
                background: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border)",
            }}
        >
            <div className={`p-2 rounded-lg ${colorMap[color]}`}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
                <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{label}</p>
                <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                    {value}
                </p>
            </div>
        </div>
    );
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatCNPJ(cnpj: string): string {
    if (!cnpj || cnpj.length !== 14) return cnpj;
    return cnpj.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        "$1.$2.$3/$4-$5"
    );
}


// ─── Analysis Modal ──────────────────────────────────────────────────────────

const PROGRESS_STEPS = [
    { label: "Baixando PDF do PNCP...", pct: 15 },
    { label: "Extraindo texto do documento...", pct: 35 },
    { label: "Analisando com IA...", pct: 60 },
    { label: "Extraindo itens e requisitos...", pct: 80 },
    { label: "Finalizando análise...", pct: 95 },
];

function AnalysisModal({
    documentId,
    onComplete,
    onClose,
}: {
    documentId: string;
    onComplete: (analysis: EditalAnalysis) => void;
    onClose: () => void;
}) {
    const [stage, setStage] = useState(0);
    const [result, setResult] = useState<EditalAnalysis | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        // Animate progress steps
        const timers: NodeJS.Timeout[] = [];
        PROGRESS_STEPS.forEach((_, i) => {
            if (i === 0) return;
            timers.push(setTimeout(() => {
                if (!cancelled) setStage(i);
            }, i * 3000));
        });

        // Call API
        api.analyzeFromPncp(documentId)
            .then((analysis) => {
                if (!cancelled) {
                    setStage(PROGRESS_STEPS.length);
                    setResult(analysis);
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    setError("Falha ao analisar o documento. " + (e?.message || ""));
                }
            });

        return () => {
            cancelled = true;
            timers.forEach(clearTimeout);
        };
    }, [documentId]);

    const currentStep = stage < PROGRESS_STEPS.length ? PROGRESS_STEPS[stage] : null;
    const progress = result ? 100 : currentStep?.pct || 0;
    const data = result?.analysis_data as Record<string, any> | null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={(e) => { if (e.target === e.currentTarget && (result || error)) onClose(); }}
        >
            <div
                className="rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
                style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Análise com IA</h3>
                            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Extraindo dados do edital</p>
                        </div>
                    </div>
                    {(result || error) && (
                        <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "var(--color-text-muted)" }}>
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-5">
                    {error ? (
                        <div className="text-center py-4">
                            <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-danger)" }} />
                            <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{error}</p>
                            <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)" }}>
                                Fechar
                            </button>
                        </div>
                    ) : !result ? (
                        <div className="space-y-4">
                            {/* Progress bar */}
                            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--color-bg-tertiary)" }}>
                                <div
                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${progress}%`, background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }}
                                />
                            </div>

                            {/* Steps */}
                            <div className="space-y-2">
                                {PROGRESS_STEPS.map((step, i) => (
                                    <div key={i} className="flex items-center gap-2.5">
                                        {i < stage ? (
                                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-success)" }} />
                                        ) : i === stage ? (
                                            <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: "var(--color-primary)" }} />
                                        ) : (
                                            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ border: "2px solid var(--color-border)" }} />
                                        )}
                                        <span className="text-sm" style={{ color: i <= stage ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>
                                            {step.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Success */}
                            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
                                <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "var(--color-success)" }} />
                                <div>
                                    <p className="text-sm font-medium" style={{ color: "var(--color-success)" }}>Análise concluída!</p>
                                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                        {result.page_count} páginas · {((result.processing_time_ms || 0) / 1000).toFixed(1)}s · {result.tokens_used?.toLocaleString()} tokens
                                    </p>
                                </div>
                            </div>

                            {/* Summary */}
                            {data?.objeto_resumo && (
                                <div className="p-3 rounded-lg" style={{ background: "var(--color-bg-secondary)" }}>
                                    <p className="text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>Objeto</p>
                                    <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{data.objeto_resumo}</p>
                                </div>
                            )}

                            {/* Quick stats */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-2 rounded-lg text-center" style={{ background: "var(--color-bg-secondary)" }}>
                                    <p className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>{data?.itens?.length || 0}</p>
                                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Itens</p>
                                </div>
                                <div className="p-2 rounded-lg text-center" style={{ background: "var(--color-bg-secondary)" }}>
                                    <p className="text-lg font-bold" style={{ color: "var(--color-success)" }}>
                                        {data?.valores?.valor_total_estimado ? new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL" }).format(data.valores.valor_total_estimado) : "—"}
                                    </p>
                                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Valor Est.</p>
                                </div>
                                <div className="p-2 rounded-lg text-center" style={{ background: "var(--color-bg-secondary)" }}>
                                    <p className="text-lg font-bold" style={{ color: "var(--color-warning)" }}>{data?.observacoes?.length || 0}</p>
                                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Alertas</p>
                                </div>
                            </div>

                            {/* Save button */}
                            <button
                                onClick={() => onComplete(result)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all"
                                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)" }}
                            >
                                <Save className="w-4 h-4" />
                                Salvar dados do Edital
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


// ─── Edital Details Tab ──────────────────────────────────────────────────────

function EditalDetailsTab({ analysis }: { analysis: EditalAnalysis }) {
    const data = analysis.analysis_data as Record<string, any> | null;
    if (!data) return <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Dados não disponíveis.</p>;

    const orgao = data.orgao || {};
    const licitacao = data.licitacao || {};
    const valores = data.valores || {};
    const datas = data.datas || {};
    const entrega = data.entrega || {};
    const pagamento = data.pagamento || {};
    const garantia = data.garantia || {};
    const contatos = data.contatos || {};
    const hab = data.habilitacao || {};
    const itens = data.itens || [];
    const obs = data.observacoes || [];

    const fmtCur = (v: number | null | undefined) => {
        if (v === null || v === undefined) return "—";
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
    };

    return (
        <div className="space-y-6">
            {/* Meta */}
            <div className="card p-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ background: "rgba(99,102,241,0.1)" }}>
                        <Bot className="w-5 h-5" style={{ color: "var(--color-primary)" }} />
                    </div>
                    <div>
                        <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>Análise gerada por IA</p>
                        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                            {analysis.llm_model} · {analysis.tokens_used?.toLocaleString()} tokens · {((analysis.processing_time_ms || 0) / 1000).toFixed(1)}s · {analysis.page_count} páginas
                        </p>
                    </div>
                </div>
            </div>

            {/* Objeto */}
            {data.objeto_resumo && (
                <div className="card p-5" style={{ borderLeft: "3px solid var(--color-primary)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-primary)" }}>Objeto da Contratação</p>
                    <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{data.objeto_detalhado || data.objeto_resumo}</p>
                </div>
            )}

            {/* Grid: Órgão + Licitação */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Building2 className="w-4 h-4 text-purple-400" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>Órgão</h4>
                    </div>
                    <InfoRow label="Nome" value={orgao.nome} />
                    <InfoRow label="CNPJ" value={orgao.cnpj} />
                    <InfoRow label="UF" value={orgao.uf} />
                    <InfoRow label="Município" value={orgao.municipio} />
                </div>
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Gavel className="w-4 h-4 text-purple-400" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>Licitação</h4>
                    </div>
                    <InfoRow label="Modalidade" value={licitacao.modalidade} />
                    <InfoRow label="Modo de Disputa" value={licitacao.modo_disputa} />
                    <InfoRow label="Nº Processo" value={licitacao.numero_processo} />
                    <InfoRow label="Critério" value={licitacao.criterio_julgamento} />
                    <InfoRow label="SRP" value={licitacao.srp} />
                </div>
            </div>

            {/* Valores + Datas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>Valores</h4>
                    </div>
                    <InfoRow label="Valor Total Estimado" value={fmtCur(valores.valor_total_estimado)} />
                    <InfoRow label="Valor Máximo Aceitável" value={valores.valor_maximo_aceitavel ? fmtCur(valores.valor_maximo_aceitavel) : null} />
                </div>
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>Datas</h4>
                    </div>
                    <InfoRow label="Publicação" value={datas.publicacao} />
                    <InfoRow label="Abertura Propostas" value={datas.abertura_propostas} />
                    <InfoRow label="Início Disputa" value={datas.inicio_disputa} />
                </div>
            </div>

            {/* Itens */}
            {itens.length > 0 && (
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Package className="w-4 h-4 text-blue-400" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>Itens ({itens.length})</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ borderBottom: "2px solid var(--color-border)" }}>
                                    <th className="text-left py-2 px-2 font-medium" style={{ color: "var(--color-text-muted)" }}>#</th>
                                    <th className="text-left py-2 px-2 font-medium" style={{ color: "var(--color-text-muted)" }}>Descrição / Especificação</th>
                                    <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--color-text-muted)" }}>Qtd</th>
                                    <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--color-text-muted)" }}>Vlr. Unit.</th>
                                    <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--color-text-muted)" }}>Vlr. Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {itens.map((item: any, idx: number) => (
                                    <tr key={idx} style={{ borderBottom: "1px solid var(--color-border)" }}>
                                        <td className="py-3 px-2 align-top" style={{ color: "var(--color-text-muted)" }}>{item.numero || idx + 1}</td>
                                        <td className="py-3 px-2 align-top">
                                            <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>{item.descricao}</p>
                                            {item.especificacao_tecnica && (
                                                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{item.especificacao_tecnica}</p>
                                            )}
                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                {item.grupo_lote && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "var(--color-primary)" }}>Lote: {item.grupo_lote}</span>
                                                )}
                                                {item.marca_referencia && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.1)", color: "var(--color-warning)" }}>Ref: {item.marca_referencia}</span>
                                                )}
                                                {item.ncm && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)" }}>NCM: {item.ncm}</span>
                                                )}
                                                {item.catmat_catser && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--color-bg-tertiary)", color: "var(--color-text-secondary)" }}>{item.catmat_catser}</span>
                                                )}
                                                {item.exclusivo_me_epp && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "var(--color-success)" }}>ME/EPP</span>
                                                )}
                                                {item.amostra_exigida && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "var(--color-danger)" }}>Amostra</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-2 text-right align-top" style={{ color: "var(--color-text-primary)" }}>
                                            {item.quantidade ?? "—"} {item.unidade || ""}
                                        </td>
                                        <td className="py-3 px-2 text-right align-top" style={{ color: "var(--color-text-primary)" }}>{fmtCur(item.valor_unitario_estimado)}</td>
                                        <td className="py-3 px-2 text-right align-top font-medium" style={{ color: "var(--color-primary)" }}>{fmtCur(item.valor_total_estimado)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Habilitação */}
            {Object.values(hab).some((v: any) => v?.length > 0) && (
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <ShieldCheck className="w-4 h-4 text-green-400" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>Habilitação</h4>
                    </div>
                    {["juridica", "fiscal", "trabalhista", "economica", "tecnica"].map((key) => {
                        const items = hab[key] || [];
                        if (items.length === 0) return null;
                        const labels: Record<string, string> = { juridica: "Jurídica", fiscal: "Fiscal", trabalhista: "Trabalhista", economica: "Econômico-Financeira", tecnica: "Técnica" };
                        return (
                            <div key={key} className="mb-3">
                                <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>{labels[key]}</p>
                                <ul className="space-y-1">
                                    {items.map((item: string, i: number) => (
                                        <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                                            <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "var(--color-success)" }} />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Entrega + Pagamento row */}
            {(entrega.prazo || pagamento.condicoes) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {entrega.prazo && (
                        <div className="card p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Truck className="w-4 h-4 text-blue-400" />
                                <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>Entrega</h4>
                            </div>
                            <InfoRow label="Prazo" value={entrega.prazo} />
                            <InfoRow label="Local" value={entrega.local} />
                        </div>
                    )}
                    {pagamento.condicoes && (
                        <div className="card p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <CreditCard className="w-4 h-4 text-green-400" />
                                <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>Pagamento</h4>
                            </div>
                            <InfoRow label="Condições" value={pagamento.condicoes} />
                            <InfoRow label="Prazo" value={pagamento.prazo} />
                        </div>
                    )}
                </div>
            )}

            {/* Observações */}
            {obs.length > 0 && (
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>Pontos de Atenção</h4>
                    </div>
                    <div className="space-y-2">
                        {obs.map((item: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 p-3 rounded-lg" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}>
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
                                <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{item}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Contatos */}
            {(contatos.pregoeiro || contatos.email) && (
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Users className="w-4 h-4 text-purple-400" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>Contatos</h4>
                    </div>
                    {contatos.pregoeiro && <InfoRow label="Pregoeiro" value={contatos.pregoeiro} />}
                    {contatos.email && <InfoRow label="Email" value={contatos.email} />}
                    {contatos.telefone && <InfoRow label="Telefone" value={contatos.telefone} />}
                </div>
            )}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
    const display = value === null || value === undefined ? "—" :
        typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value);
    return (
        <div className="flex items-baseline justify-between py-1.5" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{label}</span>
            <span className="text-sm font-medium text-right max-w-[60%]" style={{ color: "var(--color-text-primary)" }}>{display}</span>
        </div>
    );
}
