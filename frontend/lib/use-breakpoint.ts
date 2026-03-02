"use client";

import { useEffect, useState } from "react";

type Breakpoint = "xs" | "sm" | "md" | "lg";

function resolveBreakpoint(width: number): Breakpoint {
    if (width < 390) return "xs";
    if (width < 768) return "sm";
    if (width < 1024) return "md";
    return "lg";
}

export function useBreakpoint(): Breakpoint {
    const [breakpoint, setBreakpoint] = useState<Breakpoint>("lg");

    useEffect(() => {
        const update = () => setBreakpoint(resolveBreakpoint(window.innerWidth));
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    return breakpoint;
}

export function useIsMobile(): boolean {
    const breakpoint = useBreakpoint();
    return breakpoint === "xs" || breakpoint === "sm";
}

export function isTouchDevice(): boolean {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(pointer: coarse)").matches;
}
