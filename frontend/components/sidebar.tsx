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
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";
import { getRouteLabel } from "@/lib/route-label";

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

    const sidebarRef = useRef<HTMLElement | null>(null);
    const firstFocusableRef = useRef<HTMLAnchorElement | null>(null);
    const previousFocusedElementRef = useRef<HTMLElement | null>(null);

    const currentPageLabel = useMemo(() => getRouteLabel(pathname), [pathname]);

    useEffect(() => {
        async function loadCounters() {
            try {
                const [notif, stats, disputeStats] = await Promise.all([
                    api.getUnreadCount(),
                    api.getResultStats(),
                    api.getDisputeStats(),
                ]);
                setUnreadCount(notif.unread_count);
                setPendingCount(stats.pending);
                setDisputeOpenCount(disputeStats.em_disputa);
            } catch {
                // Keep last valid counters if background refresh fails.
            }
        }

        loadCounters();
        const interval = setInterval(loadCounters, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!mobileOpen) return;
        previousFocusedElementRef.current = document.activeElement as HTMLElement | null;
        document.body.style.overflow = "hidden";
        window.setTimeout(() => firstFocusableRef.current?.focus(), 0);

        return () => {
            document.body.style.overflow = "unset";
            previousFocusedElementRef.current?.focus();
        };
    }, [mobileOpen]);

    useEffect(() => {
        if (!mobileOpen) return;
        function onEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setMobileOpen(false);
            }
        }
        window.addEventListener("keydown", onEscape);
        return () => window.removeEventListener("keydown", onEscape);
    }, [mobileOpen]);

    function trapFocus(event: ReactKeyboardEvent<HTMLElement>) {
        if (event.key !== "Tab" || !sidebarRef.current) return;
        const focusables = sidebarRef.current.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    return (
        <>
            <header
                className="md:hidden fixed top-0 left-0 right-0 h-[60px] z-40 px-3 flex items-center justify-between"
                style={{
                    background: "color-mix(in srgb, var(--color-bg-main) 92%, transparent)",
                    borderBottom: "1px solid var(--color-border)",
                    backdropFilter: "blur(10px)",
                }}
            >
                <button
                    className="mobile-menu-btn"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Abrir menu de navegação"
                    aria-expanded={mobileOpen}
                    aria-controls="sidebar-nav"
                >
                    <Menu className="w-5 h-5" />
                </button>

                <p
                    className="text-sm font-semibold truncate px-14"
                    style={{ color: "var(--color-text-primary)" }}
                    aria-live="polite"
                >
                    {currentPageLabel}
                </p>

                <button
                    className="w-10 h-10 rounded-lg inline-flex items-center justify-center"
                    style={{
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-secondary)",
                        background: "var(--color-bg-card)",
                    }}
                    onClick={toggleTheme}
                    aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
                >
                    {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
            </header>

            {mobileOpen && (
                <button
                    type="button"
                    className="sidebar-overlay md:hidden"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Fechar menu de navegação"
                />
            )}

            <aside
                id="sidebar-nav"
                ref={sidebarRef}
                onKeyDown={trapFocus}
                className={cn(
                    "fixed left-0 top-0 bottom-0 w-[260px] flex flex-col z-50 transition-transform duration-300 ease-out",
                    "max-md:-translate-x-full",
                    mobileOpen && "max-md:translate-x-0"
                )}
                style={{
                    background: "var(--color-bg-sidebar)",
                    borderRight: "1px solid var(--color-border)",
                }}
                role="navigation"
                aria-label="Navegação principal"
            >
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
                            <h1 className="text-lg font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
                                EasyGov
                            </h1>
                            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                Monitoramento PNCP
                            </p>
                        </div>
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

                <div className="mx-4 mb-2" style={{ borderTop: "1px solid var(--color-border)" }} />

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
                                        ref={index === 0 ? firstFocusableRef : undefined}
                                        href={item.href}
                                        onClick={() => setMobileOpen(false)}
                                        className="group relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                                        style={{
                                            background: isActive ? "var(--color-primary-subtle)" : "transparent",
                                            color: isActive ? "var(--color-primary)" : "var(--color-text-secondary)",
                                        }}
                                        aria-current={isActive ? "page" : undefined}
                                    >
                                        <Icon
                                            className="w-[18px] h-[18px] transition-colors duration-200"
                                            style={{
                                                color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
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

                <div className="px-4 pb-2 hidden md:block">
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
                        <span className="flex-1 text-left">{theme === "light" ? "Tema Escuro" : "Tema Claro"}</span>
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

                <div className="p-4">
                    <div
                        className="rounded-xl p-4"
                        style={{
                            background: "var(--color-primary-subtle)",
                            border: "1px solid var(--color-primary-glow)",
                        }}
                    >
                        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
                            Agente ativo
                        </p>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full pulse-dot" style={{ background: "var(--color-success)" }} />
                            <span className="text-xs" style={{ color: "var(--color-success)" }}>
                                Monitorando editais
                            </span>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}
