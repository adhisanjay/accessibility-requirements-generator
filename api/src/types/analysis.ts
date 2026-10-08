export const suggestionCategories = [
  "Accessibility",
  "Usability",
  "Reporting",
  "Workflow",
  "Analytics",
] as const;
export const suggestionPriorities = ["High", "Medium", "Low"] as const;
export const suggestionStatuses = ["Pending", "Approved", "Rejected"] as const;

export type SuggestionCategory = (typeof suggestionCategories)[number];
export type SuggestionPriority = (typeof suggestionPriorities)[number];
export type SuggestionStatus = (typeof suggestionStatuses)[number];

export interface AnalysisSuggestion {
  id: string;
  findingId: number | null;
  title: string;
  description: string;
  gap: string;
  wcagCriterion: string | null;
  wcagLevel: "A" | "AA" | "AAA" | null;
  accessibilityImpact: string | null;
  recommendedRemediation: string | null;
  developerGuidance: string | null;
  verificationSteps: string[];
  confidence: number | null;
  category: SuggestionCategory;
  priority: SuggestionPriority;
  source: string;
  status: SuggestionStatus;
  createdAt: string;
  updatedAt: string;
}

export type AnalysisSuggestionInput = Pick<
  AnalysisSuggestion,
  "id" | "title" | "description" | "gap" | "category" | "priority" | "source"
> & Partial<Pick<
  AnalysisSuggestion,
  | "findingId"
  | "wcagCriterion"
  | "wcagLevel"
  | "accessibilityImpact"
  | "recommendedRemediation"
  | "developerGuidance"
  | "verificationSteps"
  | "confidence"
>> & { status?: SuggestionStatus };

export interface AccessibilityAnalysisOutput {
  title: string;
  rootCause: string;
  wcagCriterion: string;
  wcagLevel: "A" | "AA" | "AAA";
  accessibilityImpact: string;
  recommendedRemediation: string;
  developerGuidance: string;
  verificationSteps: string[];
  confidence: number;
}

export interface AnalysisOutcome {
  findingId: number;
  status: "created" | "existing" | "failed";
  suggestionId?: string;
  error?: string;
}
