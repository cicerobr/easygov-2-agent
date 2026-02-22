"use client";

import { X, AlertTriangle } from "lucide-react";
import { useEffect } from "react";

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: "danger" | "warning" | "primary";
}

export function ConfirmModal({
    isOpen,
    title,
    message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    onConfirm,
    onCancel,
    variant = "danger",
}: ConfirmModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const colors = {
        danger: "var(--color-danger)",
        warning: "var(--color-warning)",
        primary: "var(--color-primary)",
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onCancel}
            />
            <div
                className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200"
                style={{ background: "var(--color-bg-primary)" }}
            >
                <div className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div
                            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: `${colors[variant]}15` }}
                        >
                            <AlertTriangle className="w-6 h-6" style={{ color: colors[variant] }} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                                {title}
                            </h3>
                        </div>
                    </div>

                    <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                        {message}
                    </p>
                </div>

                <div className="p-4 flex items-center justify-end gap-3" style={{ background: "var(--color-bg-secondary)" }}>
                    <button
                        className="btn-ghost px-4 py-2 text-sm font-medium"
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        className="px-6 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
                        style={{ background: colors[variant] }}
                        onClick={() => {
                            onConfirm();
                            onCancel();
                        }}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
