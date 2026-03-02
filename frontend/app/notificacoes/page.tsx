"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Notification } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import {
    Bell,
    BellOff,
    CheckCheck,
    Mail,
    MessageSquare,
} from "lucide-react";
import { useToast } from "@/components/toast";
import { SkeletonList } from "@/components/skeleton";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { InteractiveCard } from "@/components/interactive-card";

const channelIcons: Record<string, typeof Bell> = {
    in_app: Bell,
    email: Mail,
    whatsapp: MessageSquare,
    push: Bell,
};

export default function NotificacoesPage() {
    const router = useRouter();
    const toast = useToast();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api
            .listNotifications()
            .then(setNotifications)
            .finally(() => setLoading(false));
    }, []);

    async function markAllRead() {
        await api.markAllRead();
        setNotifications((prev) =>
            prev.map((n) => ({ ...n, is_read: true }))
        );
        toast.success("Todas as notificações marcadas como lidas");
    }

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    function getNotificationResultId(notif: Notification): string | null {
        const maybeId = notif.metadata_?.result_id;
        return typeof maybeId === "string" && maybeId.length > 0 ? maybeId : null;
    }

    return (
        <div className="max-w-3xl mx-auto">
            <PageHeader
                title="Notificações"
                subtitle={
                    unreadCount > 0
                        ? `${unreadCount} notificação(ões) não lida(s)`
                        : "Todas as notificações lidas"
                }
                actions={
                    unreadCount > 0 ? (
                        <button className="btn-ghost" onClick={markAllRead}>
                            <CheckCheck className="w-4 h-4" /> Marcar todas como lidas
                        </button>
                    ) : undefined
                }
            />

            {loading ? (
                <SkeletonList count={4} />
            ) : notifications.length === 0 ? (
                <EmptyState
                    icon={BellOff}
                    title="Sem notificações"
                    description="Você receberá notificações quando novas licitações forem encontradas."
                />
            ) : (
                <div className="space-y-2">
                    {notifications.map((notif, i) => {
                        const Icon = channelIcons[notif.channel] || Bell;
                        const resultId = getNotificationResultId(notif);
                        const content = (
                            <>
                                <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 hover:scale-110"
                                    style={{
                                        background: !notif.is_read
                                            ? "var(--color-primary-subtle)"
                                            : "rgba(100, 116, 139, 0.08)",
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
                                    <p
                                        className="text-sm mb-0.5"
                                        style={{
                                            color: "var(--color-text-primary)",
                                            fontWeight: notif.is_read ? 400 : 600,
                                        }}
                                    >
                                        {notif.title}
                                    </p>
                                    {notif.body && (
                                        <p
                                            className="text-xs"
                                            style={{ color: "var(--color-text-muted)" }}
                                        >
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
                            </>
                        );

                        if (resultId) {
                            return (
                                <InteractiveCard
                                    key={notif.id}
                                    className={`!p-4 flex items-start gap-4 transition-all duration-200 hover:scale-[1.005] stagger-${Math.min(i + 1, 10)} animate-in`}
                                    style={{
                                        animationFillMode: "both",
                                        opacity: 0,
                                        borderLeftWidth: 3,
                                        borderLeftColor: !notif.is_read
                                            ? "var(--color-primary)"
                                            : "transparent",
                                    }}
                                    onActivate={() => router.push(`/disputas/${resultId}`)}
                                    ariaLabel={`Abrir detalhes da disputa ${notif.title}`}
                                >
                                    {content}
                                </InteractiveCard>
                            );
                        }
                        return (
                            <div
                                key={notif.id}
                                className={`card !p-4 flex items-start gap-4 transition-all duration-200 hover:scale-[1.005] stagger-${Math.min(i + 1, 10)} animate-in`}
                                style={{
                                    animationFillMode: "both",
                                    opacity: 0,
                                    borderLeftWidth: 3,
                                    borderLeftColor: !notif.is_read
                                        ? "var(--color-primary)"
                                        : "transparent",
                                }}
                            >
                                {content}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
