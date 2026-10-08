import type { AccessibilityIssue } from "../types/issue.js";

export interface AccessibilityAnalysisProvider {
  readonly name: string;
  analyzeFinding(issue: AccessibilityIssue): Promise<unknown>;
}

export interface AnalysisProviderConfig {
  provider: "mock" | "openai";
  apiKey?: string;
  model: string;
  timeoutMs: number;
}