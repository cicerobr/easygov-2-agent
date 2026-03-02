import { type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function InteractiveCard({
    children,
    className,
    style,
    onActivate,
    ariaLabel,
}: {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
    onActivate: () => void;
    ariaLabel: string;
}) {
    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onActivate();
        }
    }

    return (
        <div
            role="link"
            tabIndex={0}
            aria-label={ariaLabel}
            className={cn("interactive-card card card-interactive", className)}
            style={style}
            onClick={onActivate}
            onKeyDown={handleKeyDown}
        >
            {children}
        </div>
    );
}
