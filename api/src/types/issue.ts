export const severities = ['critical', 'high', 'medium', 'low'] as const;
export const statuses = ['open', 'in_progress', 'resolved', 'wont_fix'] as const;

export type Severity = (typeof severities)[number];
export type IssueStatus = (typeof statuses)[number];

export interface AccessibilityIssue {
  id: number;
  title: string;
  description: string;
  wcagCriterion: string;
  severity: Severity;
  status: IssueStatus;
  recommendation: string;
  source: 'manual' | 'axe';
  axeRuleId: string | null;
  pageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssueInput {
  title: string;
  description: string;
  wcagCriterion: string;
  severity: Severity;
  status: IssueStatus;
  recommendation: string;
  source?: 'manual' | 'axe';
  axeRuleId?: string | null;
  pageUrl?: string | null;
}
