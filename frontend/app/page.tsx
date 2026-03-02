"use client";

import { useEffect, useState } from "react";
import { api, type ResultStats, type Automation, type ResultPipelineKpis } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import {
  FileSearch,
  Inbox,
  Bookmark,
  Trash2,
  Bot,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Gavel,
  Trophy,
  Gauge,
} from "lucide-react";
import { SkeletonDashboard } from "@/components/skeleton";
import { PageHeader } from "@/components/page-header";

export default function DashboardPage() {
  const [stats, setStats] = useState<ResultStats | null>(null);
  const [kpis, setKpis] = useState<ResultPipelineKpis | null>(null);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getResultStats(), api.getResultKpis(), api.listAutomations()])
      .then(([s, k, a]) => {
        setStats(s);
        setKpis(k);
        setAutomations(a);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral do monitoramento de editais"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total de Editais"
          value={stats?.total ?? 0}
          icon={<FileSearch className="w-5 h-5" />}
          color="var(--color-primary)"
          delay={0}
        />
        <StatCard
          label="Pendentes"
          value={stats?.pending ?? 0}
          icon={<Inbox className="w-5 h-5" />}
          color="var(--color-warning)"
          subtitle={stats?.unread ? `${stats.unread} não lido(s)` : undefined}
          delay={1}
        />
        <StatCard
          label="Salvos"
          value={stats?.saved ?? 0}
          icon={<Bookmark className="w-5 h-5" />}
          color="var(--color-success)"
          delay={2}
        />
        <StatCard
          label="Descartados"
          value={stats?.discarded ?? 0}
          icon={<Trash2 className="w-5 h-5" />}
          color="var(--color-text-muted)"
          delay={3}
        />
      </div>

      {/* Operational KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card animate-in-scale" style={{ animationDelay: "120ms", opacity: 0 }}>
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Conversão Triagem
            </h3>
            <Gauge className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
          </div>
          <p className="text-2xl font-extrabold" style={{ color: "var(--color-text-primary)" }}>
            {kpis?.pending_to_saved_rate ?? 0}%
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Pendentes que viraram Salvos no funil
          </p>
        </div>

        <div className="card animate-in-scale" style={{ animationDelay: "180ms", opacity: 0 }}>
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Conversão para Disputa
            </h3>
            <Gavel className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
          </div>
          <p className="text-2xl font-extrabold" style={{ color: "var(--color-text-primary)" }}>
            {kpis?.saved_to_dispute_rate ?? 0}%
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Salvos que entraram em disputa
          </p>
        </div>

        <div className="card animate-in-scale" style={{ animationDelay: "240ms", opacity: 0 }}>
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Taxa de Vitória
            </h3>
            <Trophy className="w-4 h-4" style={{ color: "var(--color-success)" }} />
          </div>
          <p className="text-2xl font-extrabold" style={{ color: "var(--color-text-primary)" }}>
            {kpis?.dispute_win_rate ?? 0}%
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Disputas fechadas em Vencidos
          </p>
        </div>
      </div>

      {/* Automations Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Automations */}
        <div className="card animate-in-up" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center justify-between mb-5">
            <h2
              className="text-base font-semibold flex items-center gap-2"
              style={{ color: "var(--color-text-primary)" }}
            >
              <Bot className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
              Automações Ativas
            </h2>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: "var(--color-primary-subtle)",
                color: "var(--color-primary)",
              }}
            >
              {automations.filter((a) => a.is_active).length} ativa(s)
            </span>
          </div>

          {automations.length === 0 ? (
            <div className="text-center py-8">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "var(--color-primary-subtle)" }}
              >
                <Bot className="w-7 h-7" style={{ color: "var(--color-text-muted)" }} />
              </div>
              <p style={{ color: "var(--color-text-muted)" }} className="text-sm">
                Nenhuma automação criada ainda
              </p>
              <p style={{ color: "var(--color-text-muted)" }} className="text-xs mt-1">
                Crie uma automação para começar a monitorar editais
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {automations.slice(0, 5).map((auto, i) => (
                <div
                  key={auto.id}
                  className={`group flex items-center justify-between p-3 rounded-xl transition-all duration-200 hover:scale-[1.01] stagger-${i + 1} animate-in`}
                  style={{
                    background: "var(--color-bg-secondary)",
                    opacity: 0,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform duration-300 group-hover:scale-125"
                      style={{
                        background: auto.is_active
                          ? "var(--color-success)"
                          : "var(--color-text-muted)",
                        boxShadow: auto.is_active ? "0 0 8px rgba(22, 163, 74, 0.4)" : "none",
                      }}
                    />
                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {auto.name}
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {auto.uf ? `📍 ${auto.uf}` : "🌐 Todo Brasil"} •{" "}
                        {auto.keywords?.length
                          ? auto.keywords.slice(0, 2).join(", ")
                          : "Sem filtros"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {auto.last_run_at
                        ? `Há ${timeAgo(auto.last_run_at)}`
                        : "Nunca executada"}
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      ⏰ a cada {auto.interval_hours}h
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card animate-in-up" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center justify-between mb-5">
            <h2
              className="text-base font-semibold flex items-center gap-2"
              style={{ color: "var(--color-text-primary)" }}
            >
              <Activity className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
              Atividade Recente
            </h2>
          </div>

          <div className="space-y-3">
            {automations
              .filter((a) => a.last_run_at)
              .sort(
                (a, b) =>
                  new Date(b.last_run_at!).getTime() -
                  new Date(a.last_run_at!).getTime()
              )
              .slice(0, 5)
              .map((auto, i) => (
                <div
                  key={auto.id}
                  className={`group flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:scale-[1.01] stagger-${i + 1} animate-in`}
                  style={{
                    background: "var(--color-bg-secondary)",
                    opacity: 0,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                    style={{ background: "rgba(22, 163, 74, 0.12)" }}
                  >
                    <TrendingUp className="w-4 h-4" style={{ color: "var(--color-success)" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm truncate"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      <span className="font-medium">{auto.name}</span>
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      Executada {timeAgo(auto.last_run_at!)} atrás
                    </p>
                  </div>
                  <ArrowUpRight
                    className="w-4 h-4 flex-shrink-0 opacity-0 transition-all duration-200 group-hover:opacity-100"
                    style={{ color: "var(--color-primary)" }}
                  />
                </div>
              ))}

            {automations.filter((a) => a.last_run_at).length === 0 && (
              <div className="text-center py-8">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "var(--color-primary-subtle)" }}
                >
                  <Activity className="w-7 h-7" style={{ color: "var(--color-text-muted)" }} />
                </div>
                <p style={{ color: "var(--color-text-muted)" }} className="text-sm">
                  Nenhuma atividade recente
                </p>
                <p style={{ color: "var(--color-text-muted)" }} className="text-xs mt-1">
                  As execuções das automações aparecerão aqui
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  subtitle,
  delay = 0,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
  delay?: number;
}) {
  return (
    <div
      className="stat-card animate-in-scale"
      style={{ animationDelay: `${delay * 80}ms`, opacity: 0 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 hover:scale-110"
          style={{ background: `${color}18`, color }}
        >
          {icon}
        </div>
      </div>
      <p
        className="text-3xl font-extrabold mb-1 animate-count-up"
        style={{ color: "var(--color-text-primary)" }}
      >
        {value.toLocaleString("pt-BR")}
      </p>
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </p>
      {subtitle && (
        <p
          className="text-xs mt-1.5 font-semibold"
          style={{ color }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
