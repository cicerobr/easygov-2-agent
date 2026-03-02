import type { ReactNode } from "react";

export function StickyFooterActions({ children }: { children: ReactNode }) {
    return (
        <div className="sticky-footer-actions md:hidden">
            <div className="sticky-footer-actions-inner">{children}</div>
        </div>
    );
}
