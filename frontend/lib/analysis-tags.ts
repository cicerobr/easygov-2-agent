const OPPORTUNITY_TAG_LOWER = "oportunidade";

export function getAnalysisTags(analysisData: unknown): string[] {
    if (!analysisData || typeof analysisData !== "object") return [];

    const raw = (analysisData as { tags?: unknown }).tags;
    const parsed = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];

    const normalized = parsed
        .map((tag) => String(tag).trim())
        .filter((tag) => tag.length > 0);

    return Array.from(new Set(normalized));
}

export function hasOpportunityTag(analysisData: unknown): boolean {
    return getAnalysisTags(analysisData).some(
        (tag) => tag.toLocaleLowerCase("pt-BR") === OPPORTUNITY_TAG_LOWER
    );
}
