"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { ModalPortal } from "@/components/modal-portal";

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
    variant?: "danger" | "warning" | "primary";
    isLoading?: boolean;
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
    isLoading = false,
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
        <ModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={isLoading ? undefined : onCancel}
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
                            disabled={isLoading}
                        >
                            {cancelLabel}
                        </button>
                        <button
                            className="px-6 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2"
                            style={{ background: colors[variant], opacity: isLoading ? 0.7 : 1 }}
                            onClick={onConfirm}
                            disabled={isLoading}
                        >
                            {isLoading && (
                                <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
}
