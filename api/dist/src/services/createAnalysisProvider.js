import { readAnalysisConfig } from "./analysisConfig.js";
import { mockAccessibilityAnalysisProvider } from "./mockAnalysisProvider.js";
import { OpenAIAnalysisProvider } from "./openAIAnalysisProvider.js";
export function createAnalysisProvider(config = readAnalysisConfig()) {
    if (config.provider === "mock")
        return mockAccessibilityAnalysisProvider;
    if (!config.apiKey) {
        throw new Error("AI_API_KEY is required when AI_PROVIDER is openai.");
    }
    return new OpenAIAnalysisProvider({
        apiKey: config.apiKey,
        model: config.model,
        timeoutMs: config.timeoutMs,
    });
}
