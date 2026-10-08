import { accessibilityAnalysisOutputSchema } from "../schemas/analysis.js";
import { wcag22Criteria } from "./wcag22.js";
export const mockAccessibilityAnalysisProvider = {
    name: "mock",
    async analyzeFinding(issue) {
        const description = issue.description.slice(0, 2000);
        const recommendation = issue.recommendation.slice(0, 2000);
        const candidate = issue.wcagCriterion.match(/\d\.\d\.\d{1,2}/)?.[0] ?? "1.1.1";
        const wcagCriterion = candidate in wcag22Criteria ? candidate : "1.1.1";
        const expectedLevel = wcag22Criteria[wcagCriterion];
        const output = {
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
