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
    Scale,
    Sun,
    Moon,
    FileSearch,
    Menu,
    X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/automacoes", icon: Bot, label: "Automações" },
    { href: "/inbox", icon: Inbox, label: "Editais encontrados" },
    { href: "/salvos", icon: Bookmark, label: "Editais Salvos" },
    { href: "/disputas", icon: Scale, label: "Disputas" },
    { href: "/analises", icon: FileSearch, label: "Análise de Editais" },
    { href: "/notificacoes", icon: Bell, label: "Notificações" },
];

export function Sidebar() {
    const pathname = usePathname();
    const { theme, toggleTheme } = useTheme();
    const [unreadCount, setUnreadCount] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);
    const [disputeOpenCount, setDisputeOpenCount] = useState(0);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        Promise.all([api.getUnreadCount(), api.getResultStats(), api.getDisputeStats()])
            .then(([notif, stats, disputeStats]) => {
                setUnreadCount(notif.unread_count);
                setPendingCount(stats.pending);
                setDisputeOpenCount(disputeStats.em_disputa);
            })
            .catch(() => { });

        const interval = setInterval(() => {
            api.getUnreadCount().then((r) => setUnreadCount(r.unread_count)).catch(() => { });
            api.getResultStats().then((s) => setPendingCount(s.pending)).catch(() => { });
            api.getDisputeStats().then((s) => setDisputeOpenCount(s.em_disputa)).catch(() => { });
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [mobileOpen]);

    const sidebarContent = (
        <>
            {/* Logo */}
            <div className="p-6 pb-4">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                            background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))",
                            boxShadow: "0 4px 12px var(--color-primary-glow)",
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
                    {/* Mobile close */}
                    <button
                        className="ml-auto md:hidden p-1 rounded-lg"
                        onClick={() => setMobileOpen(false)}
                        aria-label="Fechar menu"
                        style={{ color: "var(--color-text-muted)" }}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Divider */}
            <div className="mx-4 mb-2" style={{ borderTop: "1px solid var(--color-border)" }} />

            {/* Nav */}
            <nav className="flex-1 px-3 py-2" aria-label="Menu principal">
                <ul className="space-y-1">
                    {navItems.map((item, index) => {
                        const isActive =
                            pathname === item.href ||
                            (item.href !== "/" && pathname.startsWith(item.href));
                        const Icon = item.icon;

                        let badge: number | null = null;
                        if (item.href === "/inbox" && pendingCount > 0) badge = pendingCount;
                        if (item.href === "/disputas" && disputeOpenCount > 0) badge = disputeOpenCount;
                        if (item.href === "/notificacoes" && unreadCount > 0) badge = unreadCount;

                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        "group relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                                    )}
                                    style={{
                                        background: isActive
                                            ? "var(--color-primary-subtle)"
                                            : "transparent",
                                        color: isActive
                                            ? "var(--color-primary)"
                                            : "var(--color-text-secondary)",
                                    }}
                                    aria-current={isActive ? "page" : undefined}
                                >
                                    <Icon
                                        className="w-[18px] h-[18px] transition-colors duration-200"
                                        style={{
                                            color: isActive
                                                ? "var(--color-primary)"
                                                : "var(--color-text-muted)",
                                        }}
                                    />
                                    <span className="flex-1">{item.label}</span>
                                    {badge !== null && (
                                        <span
                                            className="text-xs font-bold px-2 py-0.5 rounded-full transition-transform duration-200"
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
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                    style={{
                        background: "var(--color-sidebar-hover)",
                        color: "var(--color-text-secondary)",
                        border: "1px solid var(--color-border)",
                    }}
                    title={theme === "light" ? "Mudar para tema escuro" : "Mudar para tema claro"}
                    aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
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

            {/* Bottom status */}
            <div className="p-4">
                <div
                    className="rounded-xl p-4"
                    style={{
                        background: "var(--color-primary-subtle)",
                        border: "1px solid var(--color-primary-glow)",
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
        </>
    );

    return (
        <>
            {/* Mobile hamburger */}
            <button
                className="mobile-menu-btn"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menu de navegação"
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="sidebar-overlay md:hidden"
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed left-0 top-0 bottom-0 w-[260px] flex flex-col z-50 transition-transform duration-300 ease-out",
                    "max-md:-translate-x-full",
                    mobileOpen && "max-md:translate-x-0"
                )}
                style={{
                    background: "var(--color-bg-sidebar)",
                    borderRight: "1px solid var(--color-border)",
                    transition: "background 0.3s ease, border-color 0.3s ease, transform 0.3s ease",
                }}
                role="navigation"
                aria-label="Navegação principal"
            >
                {sidebarContent}
            </aside>
        </>
    );
}
