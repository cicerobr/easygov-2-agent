"use client";

import { useEffect, useState } from "react";
import { api, type ResultStats, type Automation, type AutomationRun } from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/utils";
import {
  FileSearch,
  Inbox,
  Bookmark,
  Trash2,
  Bot,
  TrendingUp,
  Clock,
  Activity,
} from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState<ResultStats | null>(null);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getResultStats(), api.listAutomations()])
      .then(([s, a]) => {
        setStats(s);
        setAutomations(a);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>Dashboard</h1>
        <p style={{ color: "var(--color-text-secondary)" }}>
          Visão geral do monitoramento de editais
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total de Editais"
          value={stats?.total ?? 0}
          icon={<FileSearch className="w-5 h-5" />}
          color="#6366f1"
        />
        <StatCard
          label="Pendentes"
          value={stats?.pending ?? 0}
          icon={<Inbox className="w-5 h-5" />}
          color="#f59e0b"
          subtitle={stats?.unread ? `${stats.unread} não lido(s)` : undefined}
        />
        <StatCard
          label="Salvos"
          value={stats?.saved ?? 0}
          icon={<Bookmark className="w-5 h-5" />}
          color="#22c55e"
        />
        <StatCard
          label="Descartados"
          value={stats?.discarded ?? 0}
          icon={<Trash2 className="w-5 h-5" />}
          color="#64748b"
        />
      </div>

      {/* Automations Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Automations */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
              <Bot className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
              Automações Ativas
            </h2>
            <span
              className="text-xs font-medium px-2 py-1 rounded-md"
              style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--color-primary)" }}
            >
              {automations.filter((a) => a.is_active).length} ativa(s)
            </span>
          </div>

          {automations.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
              <p style={{ color: "var(--color-text-muted)" }} className="text-sm">
                Nenhuma automação criada ainda
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {automations.slice(0, 5).map((auto) => (
                <div
                  key={auto.id}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: "var(--color-bg-secondary)" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: auto.is_active
                          ? "var(--color-success)"
                          : "var(--color-text-muted)",
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
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
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
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
              .map((auto) => (
                <div
                  key={auto.id}
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: "var(--color-bg-secondary)" }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(34, 197, 94, 0.15)" }}
                  >
                    <TrendingUp className="w-4 h-4" style={{ color: "var(--color-success)" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate" style={{ color: "var(--color-text-primary)" }}>
                      <span className="font-medium">{auto.name}</span>
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      Executada {timeAgo(auto.last_run_at!)} atrás
                    </p>
                  </div>
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
                </div>
              ))}

            {automations.filter((a) => a.last_run_at).length === 0 && (
              <div className="text-center py-8">
                <Activity className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
                <p style={{ color: "var(--color-text-muted)" }} className="text-sm">
                  Nenhuma atividade recente
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
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}20`, color }}
        >
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>{value.toLocaleString("pt-BR")}</p>
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </p>
      {subtitle && (
        <p className="text-xs mt-1" style={{ color }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
