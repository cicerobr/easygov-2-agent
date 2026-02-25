"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    exiting?: boolean;
}

interface ToastContextType {
    toast: (message: string, type?: ToastType) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({
    toast: () => { },
    success: () => { },
    error: () => { },
    info: () => { },
    warning: () => { },
});

export function useToast() {
    return useContext(ToastContext);
}

const icons: Record<ToastType, typeof CheckCircle2> = {
    success: CheckCircle2,
    error: XCircle,
    info: Info,
    warning: AlertTriangle,
};

const iconColors: Record<ToastType, string> = {
    success: "var(--color-success)",
    error: "var(--color-danger)",
    info: "var(--color-info)",
    warning: "var(--color-warning)",
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 300);
    }, []);

    const addToast = useCallback(
        (message: string, type: ToastType = "info") => {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
            setTimeout(() => removeToast(id), 4000);
        },
        [removeToast]
    );

    const contextValue: ToastContextType = {
        toast: addToast,
        success: (msg) => addToast(msg, "success"),
        error: (msg) => addToast(msg, "error"),
        info: (msg) => addToast(msg, "info"),
        warning: (msg) => addToast(msg, "warning"),
    };

    return (
        <ToastContext.Provider value={contextValue}>
            {children}
            <div className="toast-container" role="region" aria-label="Notificações">
                {toasts.map((t) => {
                    const Icon = icons[t.type];
                    return (
                        <div
                            key={t.id}
                            className={`toast toast-${t.type}${t.exiting ? " toast-exit" : ""}`}
                            role="alert"
                        >
                            <Icon className="toast-icon" style={{ color: iconColors[t.type] }} />
                            <span className="toast-message">{t.message}</span>
                            <button
                                className="toast-close"
                                onClick={() => removeToast(t.id)}
                                aria-label="Fechar notificação"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}
