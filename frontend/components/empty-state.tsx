import type { LucideIcon } from "lucide-react";

export function EmptyState({
    icon: Icon,
    title,
    description,
}: {
    icon: LucideIcon;
    title: string;
    description?: string;
}) {
    return (
        <div className="card text-center py-16 animate-in-scale">
            <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "var(--color-primary-subtle)" }}
            >
                <Icon className="w-8 h-8" style={{ color: "var(--color-text-muted)" }} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>
                {title}
            </h2>
            {description && (
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    {description}
                </p>
            )}
        </div>
    );
}
