export const scanStatuses = ["pending", "running", "completed", "failed"] as const;
export const scanReviewStatuses = ["pending", "selected", "imported"] as const;
export const axeImpacts = ["critical", "serious", "moderate", "minor"] as const;

export type ScanStatus = (typeof scanStatuses)[number];
export type ScanReviewStatus = (typeof scanReviewStatuses)[number];
export type AxeImpact = (typeof axeImpacts)[number];

export interface ScanRecord {
  id: number;
  url: string;
  status: ScanStatus;
  totalViolations: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface ScanResult {
  id: number;
  scanId: number;
  ruleId: string;
  impact: AxeImpact | null;
  description: string;
  helpText: string;
  helpUrl: string | null;
  htmlSnippets: string[];
  targets: string[];
  wcagTags: string[];
  pageUrl: string;
  reviewStatus: ScanReviewStatus;
  importedIssueId: number | null;
}

export interface AxeViolation {
  ruleId: string;
  impact: AxeImpact | null;
  description: string;
  helpText: string;
  helpUrl: string | null;
  htmlSnippets: string[];
  targets: string[];
  wcagTags: string[];
}

export interface ScanSummary {
  violations: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

export interface ScanImportResult {
  importedCount: number;
  alreadyImportedCount: number;
  errors: { resultId: number; message: string }[];
}