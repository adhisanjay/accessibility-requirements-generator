import type { AccessibilityIssue } from "../types/issue.js";
import type { AccessibilityAnalysisOutput } from "../types/analysis.js";
import { accessibilityAnalysisOutputSchema } from "../schemas/analysis.js";
import { wcag22Criteria, type Wcag22Criterion } from "./wcag22.js";
import type { AccessibilityAnalysisProvider } from "./analysisProvider.js";

export const mockAccessibilityAnalysisProvider: AccessibilityAnalysisProvider = {
  name: "mock",
  async analyzeFinding(issue: AccessibilityIssue): Promise<AccessibilityAnalysisOutput> {
    const description = issue.description.slice(0, 2000);
    const recommendation = issue.recommendation.slice(0, 2000);
    const candidate = issue.wcagCriterion.match(/\d\.\d\.\d{1,2}/)?.[0] ?? "1.1.1";
    const wcagCriterion = candidate in wcag22Criteria ? candidate : "1.1.1";
    const expectedLevel = wcag22Criteria[wcagCriterion as Wcag22Criterion];
    const output: AccessibilityAnalysisOutput = {
      title: issue.title,
      rootCause: description,
      wcagCriterion,
      wcagLevel: expectedLevel,
      accessibilityImpact: `Users may be prevented from completing the affected task: ${issue.description}`.slice(0, 2000),
      recommendedRemediation: recommendation,
      developerGuidance: `Review the affected component and preserve its behavior while addressing: ${description}`.slice(0, 2000),
      verificationSteps: [
        "Verify the affected workflow using only a keyboard.",
        "Verify the corrected behavior with a screen reader.",
        "Re-run automated accessibility checks and manually confirm the criterion.",
      ],
      confidence: 0.75,
    };
    return accessibilityAnalysisOutputSchema.parse(output);
  },
};