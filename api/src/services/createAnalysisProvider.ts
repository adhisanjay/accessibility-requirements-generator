import { readAnalysisConfig } from "./analysisConfig.js";
import type {
  AccessibilityAnalysisProvider,
  AnalysisProviderConfig,
} from "./analysisProvider.js";
import { mockAccessibilityAnalysisProvider } from "./mockAnalysisProvider.js";
import { OpenAIAnalysisProvider } from "./openAIAnalysisProvider.js";

export function createAnalysisProvider(
  config: AnalysisProviderConfig = readAnalysisConfig(),
): AccessibilityAnalysisProvider {
  if (config.provider === "mock") return mockAccessibilityAnalysisProvider;
  if (!config.apiKey) {
    throw new Error("AI_API_KEY is required when AI_PROVIDER is openai.");
  }
  return new OpenAIAnalysisProvider({
    apiKey: config.apiKey,
    model: config.model,
    timeoutMs: config.timeoutMs,
  });
}