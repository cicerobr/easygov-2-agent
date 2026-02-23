"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Building2,
    Calendar,
    FileText,
    Package,
    Download,
    ExternalLink,
    Bookmark,
    Trash2,
    DollarSign,
    Info,
    ShieldCheck,
    Scale,
    Loader2,
    AlertCircle,
    ChevronRight,
} from "lucide-react";
import { api, SearchResultDetail, ResultItem, ResultDocument } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

type TabId = "geral" | "itens" | "documentos";

export default function ResultDetailPage() {
    const params = useParams();
    const router = useRouter();
    const resultId = params.id as string;

    const [result, setResult] = useState<SearchResultDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>("geral");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadResult();
    }, [resultId]);

    async function loadResult() {
        try {
            setLoading(true);
            setError(null);
            const data = await api.getResultDetail(resultId);
            setResult(data);
        } catch (err) {
            setError("Erro ao carregar detalhes do edital.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleAction(action: "saved" | "discarded") {
        if (!result) return;
        setSaving(true);
        try {
            await api.updateResultStatus(result.id, action);
            setResult({ ...result, status: action });
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
                    <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-3" />
                    <p className="text-[var(--text-secondary)]">
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
                    <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                    <p className="text-red-400 mb-4">{error || "Edital não encontrado"}</p>
                    <button onClick={() => router.back()} className="btn-primary">
                        Voltar
                    </button>
                </div>
            </div>
        );
    }

    const tabs: { id: TabId; label: string; icon: typeof FileText; count?: number }[] = [
        { id: "geral", label: "Informações Gerais", icon: Info },
        { id: "itens", label: "Itens", icon: Package, count: result.items.length },
        { id: "documentos", label: "Documentos", icon: FileText, count: result.documents.length },
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
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para Inbox
                </button>

                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className={`badge border ${statusColors[result.status]}`}>
                                {statusLabels[result.status]}
                            </span>
                            {result.modalidade_nome && (
                                <span className="badge bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                                    {result.modalidade_nome}
                                </span>
                            )}
                            {result.srp && (
                                <span className="badge bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                    SRP
                                </span>
                            )}
                        </div>
                        <h1 className="text-xl font-semibold text-[var(--text-primary)] leading-tight mb-2">
                            {result.objeto_compra || "Sem descrição"}
                        </h1>
                        <p className="text-sm text-[var(--text-tertiary)] font-mono">
                            {result.numero_controle_pncp}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                        {result.status !== "saved" && (
                            <button
                                onClick={() => handleAction("saved")}
                                disabled={saving}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Bookmark className="w-4 h-4" />
                                Salvar
                            </button>
                        )}
                        {result.status !== "discarded" && (
                            <button
                                onClick={() => handleAction("discarded")}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Descartar
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-[var(--bg-secondary)] rounded-xl p-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${activeTab === tab.id
                            ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                            }`}
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
            <div className="animate-fade-in">
                {activeTab === "geral" && <GeneralTab result={result} />}
                {activeTab === "itens" && <ItemsTab items={result.items} />}
                {activeTab === "documentos" && <DocumentsTab documents={result.documents} cnpjOrgao={result.cnpj_orgao} anoCompra={result.ano_compra} sequencialCompra={result.sequencial_compra} />}
            </div>
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
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
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
                        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                            {section.title}
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {section.items.map((item) => (
                            <div key={item.label}>
                                <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
                                    {item.label}
                                </span>
                                <p
                                    className={`text-sm mt-0.5 ${item.highlight
                                        ? "text-green-400 font-semibold"
                                        : "text-[var(--text-primary)]"
                                        }`}
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
                        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
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
                <Package className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3 opacity-50" />
                <p className="text-[var(--text-secondary)]">Nenhum item encontrado para este edital.</p>
            </div>
        );
    }

    // Calculate total
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
                            <p className="text-sm text-[var(--text-secondary)]">Total de itens</p>
                            <p className="text-lg font-bold text-[var(--text-primary)]">{items.length}</p>
                        </div>
                    </div>
                    {totalValue > 0 && (
                        <div className="text-right">
                            <p className="text-sm text-[var(--text-secondary)]">Valor total estimado</p>
                            <p className="text-lg font-bold text-green-400">{formatCurrency(totalValue)}</p>
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
                            {/* Item number badge */}
                            <div className="shrink-0 w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
                                <span className="text-sm font-bold text-purple-400">
                                    {item.numero_item}
                                </span>
                            </div>

                            <div className="flex-1 min-w-0">
                                {/* Description */}
                                <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2 leading-relaxed">
                                    {item.descricao || "Sem descrição"}
                                </h4>

                                {/* Tags */}
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {item.material_ou_servico_nome && (
                                        <span className="badge bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
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
                                        <span className="badge bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
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
                                        <span className="text-xs text-[var(--text-tertiary)]">Quantidade</span>
                                        <p className="text-sm font-medium text-[var(--text-primary)]">
                                            {item.quantidade != null
                                                ? `${item.quantidade} ${item.unidade_medida || ""}`
                                                : "—"}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-[var(--text-tertiary)]">Valor Unitário</span>
                                        <p className="text-sm font-medium text-[var(--text-primary)]">
                                            {item.valor_unitario_estimado != null && !item.orcamento_sigiloso
                                                ? formatCurrency(item.valor_unitario_estimado)
                                                : "—"}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-[var(--text-tertiary)]">Valor Total</span>
                                        <p className="text-sm font-semibold text-green-400">
                                            {item.valor_total != null && !item.orcamento_sigiloso
                                                ? formatCurrency(item.valor_total)
                                                : "—"}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-[var(--text-tertiary)]">Categoria</span>
                                        <p className="text-sm font-medium text-[var(--text-primary)]">
                                            {item.item_categoria_nome || "—"}
                                        </p>
                                    </div>
                                </div>

                                {/* Additional info */}
                                {item.informacao_complementar && (
                                    <div className="mt-3 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
                                        <p className="text-xs text-[var(--text-tertiary)] mb-1">
                                            Informação Complementar
                                        </p>
                                        <p className="text-sm text-[var(--text-secondary)]">
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
}: {
    documents: ResultDocument[];
    cnpjOrgao: string;
    anoCompra: number;
    sequencialCompra: number;
}) {
    if (documents.length === 0) {
        return (
            <div className="card p-12 text-center">
                <FileText className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3 opacity-50" />
                <p className="text-[var(--text-secondary)]">
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
        default: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-color)]",
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
                        <p className="text-sm text-[var(--text-secondary)]">
                            Documentos disponíveis
                        </p>
                        <p className="text-lg font-bold text-[var(--text-primary)]">
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
                                    <h4 className="text-sm font-medium text-[var(--text-primary)] truncate mb-1">
                                        {doc.titulo || "Documento sem título"}
                                    </h4>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {doc.tipo_documento_nome && (
                                            <span className="text-xs text-[var(--text-tertiary)]">
                                                {doc.tipo_documento_nome}
                                            </span>
                                        )}
                                        {doc.data_publicacao_pncp && (
                                            <span className="text-xs text-[var(--text-tertiary)]">
                                                • {formatDate(doc.data_publicacao_pncp)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {downloadUrl && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <a
                                            href={downloadUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="shrink-0 p-2 rounded-lg text-[var(--text-tertiary)] hover:text-purple-400 hover:bg-purple-500/10 transition-all opacity-0 group-hover:opacity-100"
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
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
            <div className={`p-2 rounded-lg ${colorMap[color]}`}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-[var(--text-tertiary)] truncate">{label}</p>
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
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
