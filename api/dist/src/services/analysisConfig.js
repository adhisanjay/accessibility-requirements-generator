export class AnalysisConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = "AnalysisConfigurationError";
    }
}
export function readAnalysisConfig(environment = process.env) {
    const provider = (environment.AI_PROVIDER ?? "mock").trim().toLowerCase();
    if (provider !== "mock" && provider !== "openai") {
        throw new AnalysisConfigurationError("AI_PROVIDER must be 'mock' or 'openai'.");
    }
    const timeoutMs = Number(environment.AI_TIMEOUT_MS ?? 20_000);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
        throw new AnalysisConfigurationError("AI_TIMEOUT_MS must be between 1000 and 120000.");
    }
    const apiKey = environment.AI_API_KEY?.trim();
    if (provider === "openai" && !apiKey) {
        throw new AnalysisConfigurationError("AI_API_KEY is required when AI_PROVIDER is openai.");
    }
    return {
        provider,
        ...(apiKey ? { apiKey } : {}),
        model: environment.AI_MODEL?.trim() || "gpt-4.1-mini",
        timeoutMs,
    };
}
