"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    FileText,
    Building2,
    DollarSign,
    Calendar,
    Package,
    ShieldCheck,
    Truck,
    CreditCard,
    AlertTriangle,
    Bot,
    Clock,
    Loader2,
    XCircle,
    CheckCircle2,
    Users,
    Gavel,
} from "lucide-react";
import { api, EditalAnalysis } from "@/lib/api";

export default function AnaliseDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [analysis, setAnalysis] = useState<EditalAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("resumo");

    useEffect(() => {
        if (!id) return;
        api.getAnalysis(id as string)
            .then(setAnalysis)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--color-primary)" }} />
            </div>
        );
    }

    if (!analysis) {
        return (
            <div className="text-center py-20">
                <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--color-danger)" }} />
                <p style={{ color: "var(--color-text-primary)" }}>Análise não encontrada</p>
            </div>
        );
    }

    const data = analysis.analysis_data as Record<string, any> | null;

    const formatDate = (d: string | null) => {
        if (!d) return "—";
        try {
            return new Date(d).toLocaleDateString("pt-BR", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
            });
        } catch {
            return d; // Already formatted like "DD/MM/AAAA"
        }
    };

    const formatCurrency = (v: number | null | undefined) => {
        if (v === null || v === undefined) return "—";
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
    };

    const tabs = [
        { id: "resumo", label: "Resumo", icon: FileText },
        { id: "itens", label: "Itens", icon: Package },
        { id: "habilitacao", label: "Habilitação", icon: ShieldCheck },
        { id: "datas", label: "Prazos", icon: Calendar },
        { id: "observacoes", label: "Observações", icon: AlertTriangle },
    ];

    return (
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            {/* Back */}
            <button
                onClick={() => router.push("/analises")}
                className="flex items-center gap-2 mb-6 text-sm font-medium transition-all"
                style={{ color: "var(--color-text-muted)" }}
            >
                <ArrowLeft className="w-4 h-4" />
                Voltar para Análises
            </button>

            {/* Header */}
            <div
                className="rounded-xl p-6 mb-6"
                style={{
                    background: "var(--color-bg-card)",
                    border: "1px solid var(--color-border)",
                }}
            >
                <div className="flex items-start gap-4">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                            boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                        }}
                    >
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                            {analysis.pdf_filename || "Análise de Edital"}
                        </h1>
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                            {analysis.status === "completed" && (
                                <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--color-success)" }}>
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Concluída
                                </span>
                            )}
                            {analysis.status === "processing" && (
                                <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--color-primary)" }}>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando...
                                </span>
                            )}
                            {analysis.status === "error" && (
                                <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--color-danger)" }}>
                                    <XCircle className="w-3.5 h-3.5" /> Erro: {analysis.error_message}
                                </span>
                            )}
                            {analysis.page_count && (
                                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                    📄 {analysis.page_count} páginas
                                </span>
                            )}
                            {analysis.processing_time_ms && (
                                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                    ⏱️ {(analysis.processing_time_ms / 1000).toFixed(1)}s
                                </span>
                            )}
                            {analysis.tokens_used && (
                                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                    🤖 {analysis.tokens_used.toLocaleString()} tokens ({analysis.llm_model})
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Object Summary */}
                {data?.objeto_resumo && (
                    <div
                        className="mt-4 p-4 rounded-lg"
                        style={{ background: "rgba(99, 102, 241, 0.05)", border: "1px solid rgba(99, 102, 241, 0.15)" }}
                    >
                        <p className="text-sm font-medium" style={{ color: "var(--color-primary)" }}>
                            Objeto da Contratação
                        </p>
                        <p className="text-sm mt-1" style={{ color: "var(--color-text-primary)" }}>
                            {data.objeto_detalhado || data.objeto_resumo}
                        </p>
                    </div>
                )}
            </div>

            {/* Status error — don't show tabs */}
            {analysis.status !== "completed" || !data ? (
                <div
                    className="rounded-xl p-12 text-center"
                    style={{
                        background: "var(--color-bg-card)",
                        border: "1px solid var(--color-border)",
                    }}
                >
                    {analysis.status === "processing" && (
                        <>
                            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" style={{ color: "var(--color-primary)" }} />
                            <p style={{ color: "var(--color-text-primary)" }}>Analisando o edital com IA...</p>
                            <p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>Isso pode levar alguns segundos</p>
                        </>
                    )}
                    {analysis.status === "error" && (
                        <>
                            <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--color-danger)" }} />
                            <p style={{ color: "var(--color-text-primary)" }}>Falha na análise</p>
                            <p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>{analysis.error_message}</p>
                        </>
                    )}
                </div>
            ) : (
                <>
                    {/* Tabs */}
                    <div className="flex items-center gap-1 mb-6 p-1 rounded-xl" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center"
                                    style={{
                                        background: activeTab === tab.id ? "rgba(99, 102, 241, 0.15)" : "transparent",
                                        color: activeTab === tab.id ? "var(--color-primary)" : "var(--color-text-muted)",
                                    }}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Content */}
                    <div
                        className="rounded-xl p-6"
                        style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}
                    >
                        {activeTab === "resumo" && <ResumoTab data={data} formatCurrency={formatCurrency} />}
                        {activeTab === "itens" && <ItensTab data={data} formatCurrency={formatCurrency} />}
                        {activeTab === "habilitacao" && <HabilitacaoTab data={data} />}
                        {activeTab === "datas" && <DatasTab data={data} />}
                        {activeTab === "observacoes" && <ObservacoesTab data={data} />}
                    </div>
                </>
            )}
        </div>
    );
}

/* ─── Tab Components ──────────────────────────────────────────────────────── */

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
    return (
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>
            <Icon className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
            {title}
        </h3>
    );
}

function InfoRow({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
    const display = value === null || value === undefined ? "—" :
        typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value);
    return (
        <div className="flex items-baseline justify-between py-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>{label}</span>
            <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{display}</span>
        </div>
    );
}

function ResumoTab({ data, formatCurrency }: { data: any; formatCurrency: (v: any) => string }) {
    const orgao = data?.orgao || {};
    const licitacao = data?.licitacao || {};
    const valores = data?.valores || {};
    const entrega = data?.entrega || {};
    const pagamento = data?.pagamento || {};
    const garantia = data?.garantia || {};
    const contatos = data?.contatos || {};

    return (
        <div className="space-y-6">
            {/* Órgão */}
            <div>
                <SectionTitle icon={Building2} title="Órgão Contratante" />
                <InfoRow label="Nome" value={orgao.nome} />
                <InfoRow label="CNPJ" value={orgao.cnpj} />
                <InfoRow label="UF" value={orgao.uf} />
                <InfoRow label="Município" value={orgao.municipio} />
                {orgao.endereco && <InfoRow label="Endereço" value={orgao.endereco} />}
            </div>

            {/* Licitação */}
            <div>
                <SectionTitle icon={Gavel} title="Dados da Licitação" />
                <InfoRow label="Modalidade" value={licitacao.modalidade} />
                <InfoRow label="Modo de Disputa" value={licitacao.modo_disputa} />
                <InfoRow label="Nº Processo" value={licitacao.numero_processo} />
                <InfoRow label="Nº Edital" value={licitacao.numero_edital} />
                <InfoRow label="Critério de Julgamento" value={licitacao.criterio_julgamento} />
                <InfoRow label="Tipo de Benefício" value={licitacao.tipo_beneficio} />
                <InfoRow label="SRP" value={licitacao.srp} />
                <InfoRow label="Exclusivo ME/EPP" value={licitacao.exclusivo_me_epp} />
            </div>

            {/* Valores */}
            <div>
                <SectionTitle icon={DollarSign} title="Valores" />
                <InfoRow label="Valor Total Estimado" value={formatCurrency(valores.valor_total_estimado)} />
                <InfoRow label="Valor Máximo Aceitável" value={valores.valor_maximo_aceitavel ? formatCurrency(valores.valor_maximo_aceitavel) : null} />
            </div>

            {/* Entrega */}
            {(entrega.prazo || entrega.local) && (
                <div>
                    <SectionTitle icon={Truck} title="Entrega / Execução" />
                    <InfoRow label="Prazo" value={entrega.prazo} />
                    <InfoRow label="Local" value={entrega.local} />
                    {entrega.condicoes && <InfoRow label="Condições" value={entrega.condicoes} />}
                </div>
            )}

            {/* Pagamento */}
            {(pagamento.condicoes || pagamento.prazo) && (
                <div>
                    <SectionTitle icon={CreditCard} title="Pagamento" />
                    <InfoRow label="Condições" value={pagamento.condicoes} />
                    <InfoRow label="Prazo" value={pagamento.prazo} />
                </div>
            )}

            {/* Garantia */}
            {garantia.exige_garantia && (
                <div>
                    <SectionTitle icon={ShieldCheck} title="Garantia" />
                    <InfoRow label="Exige Garantia" value={garantia.exige_garantia} />
                    {garantia.percentual && <InfoRow label="Percentual" value={`${garantia.percentual}%`} />}
                    {garantia.detalhes && <InfoRow label="Detalhes" value={garantia.detalhes} />}
                </div>
            )}

            {/* Contatos */}
            {(contatos.pregoeiro || contatos.email) && (
                <div>
                    <SectionTitle icon={Users} title="Contatos" />
                    {contatos.pregoeiro && <InfoRow label="Pregoeiro" value={contatos.pregoeiro} />}
                    {contatos.email && <InfoRow label="Email" value={contatos.email} />}
                    {contatos.telefone && <InfoRow label="Telefone" value={contatos.telefone} />}
                </div>
            )}
        </div>
    );
}

function ItensTab({ data, formatCurrency }: { data: any; formatCurrency: (v: any) => string }) {
    const itens = data?.itens || [];
    if (itens.length === 0) return <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Nenhum item encontrado no edital.</p>;

    return (
        <div>
            <SectionTitle icon={Package} title={`Itens (${itens.length})`} />
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ borderBottom: "2px solid var(--color-border)" }}>
                            <th className="text-left py-2 px-2 font-medium" style={{ color: "var(--color-text-muted)" }}>#</th>
                            <th className="text-left py-2 px-2 font-medium" style={{ color: "var(--color-text-muted)" }}>Descrição</th>
                            <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--color-text-muted)" }}>Qtd</th>
                            <th className="text-left py-2 px-2 font-medium" style={{ color: "var(--color-text-muted)" }}>Unid.</th>
                            <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--color-text-muted)" }}>Vlr. Unit.</th>
                            <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--color-text-muted)" }}>Vlr. Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {itens.map((item: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: "1px solid var(--color-border)" }}>
                                <td className="py-2.5 px-2" style={{ color: "var(--color-text-muted)" }}>{item.numero || idx + 1}</td>
                                <td className="py-2.5 px-2" style={{ color: "var(--color-text-primary)" }}>
                                    {item.descricao}
                                    {item.catmat_catser && (
                                        <span className="text-xs ml-2 px-1.5 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "var(--color-primary)" }}>
                                            {item.catmat_catser}
                                        </span>
                                    )}
                                </td>
                                <td className="py-2.5 px-2 text-right" style={{ color: "var(--color-text-primary)" }}>{item.quantidade ?? "—"}</td>
                                <td className="py-2.5 px-2" style={{ color: "var(--color-text-muted)" }}>{item.unidade || "—"}</td>
                                <td className="py-2.5 px-2 text-right" style={{ color: "var(--color-text-primary)" }}>{formatCurrency(item.valor_unitario_estimado)}</td>
                                <td className="py-2.5 px-2 text-right font-medium" style={{ color: "var(--color-primary)" }}>{formatCurrency(item.valor_total_estimado)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function HabilitacaoTab({ data }: { data: any }) {
    const hab = data?.habilitacao || {};
    const sections = [
        { key: "juridica", label: "Habilitação Jurídica" },
        { key: "fiscal", label: "Regularidade Fiscal" },
        { key: "trabalhista", label: "Regularidade Trabalhista" },
        { key: "economica", label: "Qualificação Econômico-Financeira" },
        { key: "tecnica", label: "Qualificação Técnica" },
    ];

    const hasAny = sections.some((s) => hab[s.key]?.length > 0);
    if (!hasAny) return <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Requisitos de habilitação não identificados.</p>;

    return (
        <div className="space-y-6">
            {sections.map((s) => {
                const items = hab[s.key] || [];
                if (items.length === 0) return null;
                return (
                    <div key={s.key}>
                        <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>{s.label}</h4>
                        <ul className="space-y-1.5">
                            {items.map((item: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--color-success)" }} />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
}

function DatasTab({ data }: { data: any }) {
    const datas = data?.datas || {};
    const entries = [
        { label: "Publicação", value: datas.publicacao },
        { label: "Abertura das Propostas", value: datas.abertura_propostas },
        { label: "Encerramento das Propostas", value: datas.encerramento_propostas },
        { label: "Início da Disputa", value: datas.inicio_disputa },
        { label: "Prazo para Impugnação", value: datas.prazo_impugnacao },
        { label: "Prazo para Esclarecimentos", value: datas.prazo_esclarecimentos },
    ];

    const entrega = data?.entrega || {};

    return (
        <div className="space-y-6">
            <div>
                <SectionTitle icon={Calendar} title="Datas da Licitação" />
                {entries.map((e, i) => (
                    <InfoRow key={i} label={e.label} value={e.value} />
                ))}
            </div>
            {entrega.prazo && (
                <div>
                    <SectionTitle icon={Truck} title="Prazo de Entrega" />
                    <InfoRow label="Prazo" value={entrega.prazo} />
                    {entrega.local && <InfoRow label="Local" value={entrega.local} />}
                </div>
            )}
        </div>
    );
}

function ObservacoesTab({ data }: { data: any }) {
    const obs = data?.observacoes || [];
    if (obs.length === 0) return <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Nenhuma observação ou ponto de atenção identificado.</p>;

    return (
        <div>
            <SectionTitle icon={AlertTriangle} title="Pontos de Atenção" />
            <div className="space-y-3">
                {obs.map((item: string, idx: number) => (
                    <div
                        key={idx}
                        className="flex items-start gap-3 p-3 rounded-lg"
                        style={{ background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.15)" }}
                    >
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
                        <p className="text-sm" style={{ color: "var(--color-text-primary)" }}>{item}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
