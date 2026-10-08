import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { accessibilityAnalysisStructuredSchema } from "../schemas/analysis.js";
import type { AccessibilityIssue } from "../types/issue.js";
import type { AccessibilityAnalysisOutput } from "../types/analysis.js";
import type { AccessibilityAnalysisProvider } from "./analysisProvider.js";
import { wcag22Criteria } from "./wcag22.js";

const systemInstructions = `You are an accessibility specialist analyzing one persisted accessibility finding. Return only the requested structured analysis. Use WCAG 2.2 success criterion IDs and their exact conformance levels. Ground the analysis in the supplied finding; do not invent implementation details, and express uncertainty through confidence. Provide practical, testable remediation, developer guidance, and verification steps. Do not make approval decisions.`;

export class OpenAIAnalysisProvider implements AccessibilityAnalysisProvider {
  readonly name: string;
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: { apiKey: string; model: string; timeoutMs: number; client?: OpenAI }) {
    this.name = `OpenAI (${options.model})`;
    this.model = options.model;
    this.client = options.client ?? new OpenAI({
      apiKey: options.apiKey,
      timeout: options.timeoutMs,
      maxRetries: 1,
      ...(process.env.AI_BASE_URL ? { baseURL: process.env.AI_BASE_URL } : {}),
    });
  }

  async analyzeFinding(issue: AccessibilityIssue): Promise<AccessibilityAnalysisOutput> {
    const response = await this.client.responses.parse({
      model: this.model,
      max_output_tokens: 2000,
      input: [
        { role: "system", content: systemInstructions },
        {
          role: "user",
          content: JSON.stringify({
            finding: {
              title: issue.title,
              description: issue.description,
              currentWcagCriterion: issue.wcagCriterion,
              severity: issue.severity,
              status: issue.status,
              recommendation: issue.recommendation,
              source: issue.source,
              axeRuleId: issue.axeRuleId,
              pageUrl: issue.pageUrl,
            },
            allowedWcagCriteria: Object.entries(wcag22Criteria).map(
              ([criterion, level]) => ({ criterion, level }),
            ),
          }),
        },
      ],
      text: {
        format: zodTextFormat(
          accessibilityAnalysisStructuredSchema,
          "accessibility_analysis",
        ),
      },
    });
    if (!response.output_parsed) {
      throw new Error("The provider did not return structured analysis.");
    }
    return response.output_parsed;
  }
}