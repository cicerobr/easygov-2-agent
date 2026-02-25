import type { KeywordMatchEvidence, KeywordMatchScope } from "@/lib/api";

export function getKeywordScopeLabel(scope?: KeywordMatchScope | null): string | null {
    if (scope === "object") return "Objeto";
    if (scope === "item") return "Item";
    if (scope === "both") return "Objeto+Item";
    return null;
}

export function getKeywordScopeBadgeClass(scope?: KeywordMatchScope | null): string {
    if (scope === "item") return "bg-sky-500/15 text-sky-300 border border-sky-500/30";
    if (scope === "both") return "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30";
    return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
}

export function summarizeKeywordEvidence(
    evidence?: KeywordMatchEvidence[] | null
): string | null {
    if (!evidence || evidence.length === 0) return null;
    const first = evidence[0];
    const target =
        first.scope === "item"
            ? `Item ${first.item_numero ?? "?"}`
            : "Objeto";
    const snippet = (first.snippet || "").trim();
    if (!snippet) return target;
    return `${target}: "${snippet}"`;
}
