const TECHNICAL_CONTEXT_MARKERS = [
    "qualificacao tecnica",
    "capacidade tecnica",
    "atestado",
    "acervo tecnico",
    "certidao de acervo",
    "cat ",
    "registro profissional",
    "responsavel tecnico",
    "crea",
    "cau",
    "crt",
    "cft",
    "experiencia tecnica",
    "aptidao tecnica",
];

const NEGATIVE_MARKERS = [
    "nao exig",
    "nao ha exig",
    "nao havera exig",
    "nao sera exig",
    "nao sera obrigatorio",
    "nao obrigatorio",
    "sem exig",
    "dispensad",
    "inexig",
];

function normalizeText(value: string): string {
    return value
        .toLowerCase()
        .replaceAll("á", "a")
        .replaceAll("à", "a")
        .replaceAll("â", "a")
        .replaceAll("ã", "a")
        .replaceAll("é", "e")
        .replaceAll("ê", "e")
        .replaceAll("í", "i")
        .replaceAll("ó", "o")
        .replaceAll("ô", "o")
        .replaceAll("õ", "o")
        .replaceAll("ú", "u")
        .replaceAll("ç", "c");
}

function toStringList(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value
            .map((item) => String(item).trim())
            .filter((item) => item.length > 0);
    }
    if (typeof value === "string" && value.trim().length > 0) {
        return [value.trim()];
    }
    if (value === null || value === undefined) return [];
    const parsed = String(value).trim();
    return parsed.length > 0 ? [parsed] : [];
}

function dedupeStrings(values: string[]): string[] {
    const result: string[] = [];
    const seen = new Set<string>();
    for (const value of values) {
        const normalized = normalizeText(value);
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(value);
    }
    return result;
}

export function isExplicitNoTechnicalRequirement(value: string): boolean {
    const normalized = normalizeText(value);
    const hasNegative = NEGATIVE_MARKERS.some((marker) => normalized.includes(marker));
    const hasContext = TECHNICAL_CONTEXT_MARKERS.some((marker) =>
        normalized.includes(marker)
    );
    return hasNegative && hasContext;
}

function getRawTechnicalItems(analysisData: unknown): string[] {
    if (!analysisData || typeof analysisData !== "object") return [];
    const habilitacao = (analysisData as { habilitacao?: unknown }).habilitacao;
    if (!habilitacao || typeof habilitacao !== "object") return [];
    const integral = (habilitacao as { tecnica_texto_integral?: unknown }).tecnica_texto_integral;
    const tecnica = (habilitacao as { tecnica?: unknown }).tecnica;
    const integralItems = toStringList(integral);
    if (integralItems.length > 0) return dedupeStrings(integralItems);
    return dedupeStrings(toStringList(tecnica));
}

export function hasNoTechnicalQualificationRequirement(analysisData: unknown): boolean {
    const items = getRawTechnicalItems(analysisData);
    return items.length > 0 && items.every((item) => isExplicitNoTechnicalRequirement(item));
}

export function getTechnicalQualificationItems(analysisData: unknown): string[] {
    const items = getRawTechnicalItems(analysisData);
    if (items.length === 0) return [];

    const hasPositiveRequirement = items.some(
        (item) => !isExplicitNoTechnicalRequirement(item)
    );
    if (!hasPositiveRequirement) return items;
    return items.filter((item) => !isExplicitNoTechnicalRequirement(item));
}
