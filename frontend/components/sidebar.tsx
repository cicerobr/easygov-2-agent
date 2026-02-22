"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Bot,
    Inbox,
    Bookmark,
    Bell,
    Shield,
    Sun,
    Moon,
    FileSearch,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/automacoes", icon: Bot, label: "Automações" },
    { href: "/inbox", icon: Inbox, label: "Inbox" },
    { href: "/salvos", icon: Bookmark, label: "Editais Salvos" },
    { href: "/analises", icon: FileSearch, label: "Análise de Editais" },
    { href: "/notificacoes", icon: Bell, label: "Notificações" },
];

export function Sidebar() {
    const pathname = usePathname();
    const { theme, toggleTheme } = useTheme();
    const [unreadCount, setUnreadCount] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        Promise.all([api.getUnreadCount(), api.getResultStats()])
            .then(([notif, stats]) => {
                setUnreadCount(notif.unread_count);
                setPendingCount(stats.pending);
            })
            .catch(() => { });

        const interval = setInterval(() => {
            api.getUnreadCount().then((r) => setUnreadCount(r.unread_count)).catch(() => { });
            api.getResultStats().then((s) => setPendingCount(s.pending)).catch(() => { });
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    return (
        <aside
            className="fixed left-0 top-0 bottom-0 w-[260px] flex flex-col"
            style={{
                background: "var(--color-bg-sidebar)",
                borderRight: "1px solid var(--color-border)",
                transition: "background 0.3s ease, border-color 0.3s ease",
            }}
        >
            {/* Logo */}
            <div className="p-6 pb-4">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                            boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                        }}
                    >
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1
                            className="text-lg font-bold tracking-tight"
                            style={{ color: "var(--color-text-primary)" }}
                        >
                            EasyGov
                        </h1>
                        <p
                            className="text-xs"
                            style={{ color: "var(--color-text-muted)" }}
                        >
                            Monitoramento PNCP
                        </p>
                    </div>
                </div>
            </div>

            {/* Divider */}
            <div className="mx-4 mb-2" style={{ borderTop: "1px solid var(--color-border)" }} />

            {/* Nav */}
            <nav className="flex-1 px-3 py-2">
                <ul className="space-y-1">
                    {navItems.map((item) => {
                        const isActive =
                            pathname === item.href ||
                            (item.href !== "/" && pathname.startsWith(item.href));
                        const Icon = item.icon;

                        let badge: number | null = null;
                        if (item.href === "/inbox" && pendingCount > 0) badge = pendingCount;
                        if (item.href === "/notificacoes" && unreadCount > 0) badge = unreadCount;

                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                                    )}
                                    style={{
                                        background: isActive
                                            ? "rgba(99, 102, 241, 0.15)"
                                            : "transparent",
                                        color: isActive
                                            ? "var(--color-primary)"
                                            : "var(--color-text-secondary)",
                                    }}
                                >
                                    <Icon
                                        className="w-[18px] h-[18px]"
                                        style={{
                                            color: isActive
                                                ? "var(--color-primary)"
                                                : "var(--color-text-muted)",
                                        }}
                                    />
                                    <span className="flex-1">{item.label}</span>
                                    {badge !== null && (
                                        <span
                                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                                            style={{
                                                background: "var(--color-primary)",
                                                color: "white",
                                                minWidth: 22,
                                                textAlign: "center",
                                            }}
                                        >
                                            {badge > 99 ? "99+" : badge}
                                        </span>
                                    )}
                                    {isActive && (
                                        <div
                                            className="absolute left-0 w-[3px] h-6 rounded-r-full"
                                            style={{ background: "var(--color-primary)" }}
                                        />
                                    )}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Theme Toggle */}
            <div className="px-4 pb-2">
                <button
                    onClick={toggleTheme}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                    style={{
                        background: "var(--color-sidebar-hover)",
                        color: "var(--color-text-secondary)",
                        border: "1px solid var(--color-border)",
                    }}
                    title={theme === "light" ? "Mudar para tema escuro" : "Mudar para tema claro"}
                >
                    {theme === "light" ? (
                        <Moon className="w-[18px] h-[18px]" style={{ color: "var(--color-primary)" }} />
                    ) : (
                        <Sun className="w-[18px] h-[18px]" style={{ color: "#f59e0b" }} />
                    )}
                    <span className="flex-1 text-left">
                        {theme === "light" ? "Tema Escuro" : "Tema Claro"}
                    </span>
                    <div className="theme-toggle">
                        <div className="toggle-thumb">
                            {theme === "light" ? (
                                <Sun className="w-3 h-3 text-white" />
                            ) : (
                                <Moon className="w-3 h-3 text-white" />
                            )}
                        </div>
                    </div>
                </button>
            </div>

            {/* Bottom */}
            <div className="p-4">
                <div
                    className="rounded-xl p-4"
                    style={{
                        background:
                            "linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))",
                        border: "1px solid rgba(99, 102, 241, 0.2)",
                    }}
                >
                    <p
                        className="text-xs font-medium mb-1"
                        style={{ color: "var(--color-text-secondary)" }}
                    >
                        Agente ativo
                    </p>
                    <div className="flex items-center gap-2">
                        <div
                            className="w-2 h-2 rounded-full pulse-dot"
                            style={{ background: "var(--color-success)" }}
                        />
                        <span className="text-xs" style={{ color: "var(--color-success)" }}>
                            Monitorando editais
                        </span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
