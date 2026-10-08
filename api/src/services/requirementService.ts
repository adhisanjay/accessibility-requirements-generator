import type { AnalysisSuggestion } from "../types/analysis.js";
import type { RequirementInput } from "../types/requirement.js";

function splitRequirementText(value: string) {
  const chunks: string[] = [];
  let remaining = value.trim();
  while (remaining.length > 500) {
    let boundary = remaining.lastIndexOf(" ", 500);
    if (boundary < 250) boundary = 500;
    chunks.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export interface RequirementGenerationService {
  generate(enhancement: AnalysisSuggestion): RequirementInput;
}

export const mockRequirementGenerationService: RequirementGenerationService = {
  generate(enhancement) {
    const analysisRequirements = [
      enhancement.wcagCriterion && enhancement.wcagLevel
        ? `WCAG 2.2 ${enhancement.wcagCriterion}, Level ${enhancement.wcagLevel}.`
        : null,
      enhancement.accessibilityImpact
        ? `Accessibility impact: ${enhancement.accessibilityImpact}`
        : null,
      enhancement.recommendedRemediation
        ? `Recommended remediation: ${enhancement.recommendedRemediation}`
        : null,
      enhancement.developerGuidance
        ? `Developer guidance: ${enhancement.developerGuidance}`
        : null,
      ...enhancement.verificationSteps.map((step) => `Verification: ${step}`),
    ].filter((item): item is string => Boolean(item));
    const accessibilityCriteria =
      enhancement.category === "Accessibility"
        ? [
            "The experience must expose all new controls and status changes to assistive technologies.",
            "The experience must preserve visible keyboard focus and meet applicable WCAG guidance.",
            ...analysisRequirements.flatMap(splitRequirementText),
          ]
        : [
            "The enhancement must not reduce the accessibility of existing workflows.",
          ];

    return {
      id: `${enhancement.id}-requirement`,
      enhancementId: enhancement.id,
      title: enhancement.title,
      businessUserNeed: `As an accessibility team member, I want ${enhancement.title.toLowerCase()} so that the team can address the gap identified in the approved enhancement.`,
      description: enhancement.description,
      functionalRequirements: [
        `The system must provide the capability described by "${enhancement.title}".`,
        `The system must preserve a clear relationship to approved enhancement ${enhancement.id}.`,
      ],
      accessibilityRequirements: accessibilityCriteria,
      nonFunctionalRequirements: [
        "The feature must provide clear feedback for loading, success, and error states.",
        "The feature must preserve the existing application data and review workflow.",
      ],
      acceptanceCriteria: [
        `Given an approved enhancement titled "${enhancement.title}"\nWhen a reviewer generates a requirement\nThen the system should create a structured requirement linked to ${enhancement.id}.`,
        ...enhancement.verificationSteps.flatMap(splitRequirementText),
        "Given a generated requirement\nWhen a reviewer edits and saves it\nThen the updated content should be available after refreshing the page.",
        "Given a requirement is under review\nWhen a reviewer approves or rejects it\nThen the system should persist the selected review status.",
      ],
      dependencies: [
        "Approved AI enhancement record",
        "Existing application workspace",
      ],
      assumptions: [
        "A human reviewer will validate the generated content before implementation.",
      ],
      priority: enhancement.priority,
      status: "Pending Review",
    };
  },
};
