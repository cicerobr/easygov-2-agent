"use client";

import { useEffect, useState } from "react";
import { api, type Notification } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import {
    Bell,
    BellOff,
    CheckCheck,
    Loader2,
    Bot,
    Mail,
    MessageSquare,
} from "lucide-react";

const channelIcons: Record<string, typeof Bell> = {
    in_app: Bell,
    email: Mail,
    whatsapp: MessageSquare,
    push: Bell,
};

export default function NotificacoesPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.listNotifications()
            .then(setNotifications)
            .finally(() => setLoading(false));
    }, []);

    async function markAllRead() {
        await api.markAllRead();
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return (
        <div className="max-w-3xl mx-auto animate-in">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>Notificações</h1>
                    <p style={{ color: "var(--color-text-secondary)" }}>
                        {unreadCount > 0
                            ? `${unreadCount} notificação(ões) não lida(s)`
                            : "Todas as notificações lidas"}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button className="btn-ghost" onClick={markAllRead}>
                        <CheckCheck className="w-4 h-4" /> Marcar todas como lidas
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--color-primary)" }} />
                </div>
            ) : notifications.length === 0 ? (
                <div className="card text-center py-16">
                    <BellOff className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--color-text-muted)" }} />
                    <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>Sem notificações</h2>
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                        Você receberá notificações quando novas licitações forem encontradas.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {notifications.map((notif, i) => {
                        const Icon = channelIcons[notif.channel] || Bell;
                        return (
                            <div
                                key={notif.id}
                                className="card !p-4 flex items-start gap-4 animate-in"
                                style={{
                                    animationDelay: `${i * 20}ms`,
                                    borderLeftWidth: 3,
                                    borderLeftColor: !notif.is_read ? "var(--color-primary)" : "transparent",
                                    opacity: notif.is_read ? 0.7 : 1,
                                }}
                            >
                                <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{
                                        background: !notif.is_read
                                            ? "rgba(99, 102, 241, 0.15)"
                                            : "rgba(100, 116, 139, 0.1)",
                                    }}
                                >
                                    <Icon
                                        className="w-4 h-4"
                                        style={{
                                            color: !notif.is_read
                                                ? "var(--color-primary)"
                                                : "var(--color-text-muted)",
                                        }}
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium mb-0.5" style={{ color: "var(--color-text-primary)" }}>
                                        {notif.title}
                                    </p>
                                    {notif.body && (
                                        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                            {notif.body}
                                        </p>
                                    )}
                                </div>
                                <span
                                    className="text-xs flex-shrink-0"
                                    style={{ color: "var(--color-text-muted)" }}
                                >
                                    {timeAgo(notif.sent_at)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
