import type { AnalysisSuggestionInput } from "../types/analysis.js";

export interface AnalysisContext {
  issueCount: number;
  openIssueCount: number;
}

export interface AnalysisService {
  analyzeApplication(context: AnalysisContext): AnalysisSuggestionInput[];
}

export const mockAnalysisService: AnalysisService = {
  analyzeApplication(context) {
    const source = "Mock analysis of the current finding workflow";
    return [
      {
        id: "scan-integration",
        title: "Accessibility Scan Integration",
        description:
          "Allow users to scan a webpage with axe-core and import detected violations into the finding register.",
        gap: "The current workflow depends on manually entered findings, which makes repeatable discovery and import time-consuming.",
        category: "Accessibility",
        priority: "High",
        source,
      },
      {
        id: "audit-history",
        title: "Audit History",
        description:
          "Maintain historical audit results so teams can compare findings and resolution progress over time.",
        gap: "The application currently shows the latest workspace state without a way to understand whether accessibility is improving.",
        category: "Analytics",
        priority: "Medium",
        source,
      },
      {
        id: "issue-evidence",
        title: "Issue Evidence",
        description:
          "Allow screenshots, HTML snippets, or other evidence to be attached to accessibility findings.",
        gap: "A finding has text and a recommendation today, but reviewers cannot see the visual or technical context behind it.",
        category: "Usability",
        priority: "High",
        source,
      },
      {
        id: "wcag-details",
        title: "WCAG Details",
        description:
          "Provide criterion descriptions, conformance levels, and links to understanding resources beside each finding.",
        gap: "The register stores a WCAG criterion identifier but does not help users interpret or act on that criterion.",
        category: "Accessibility",
        priority: "Medium",
        source,
      },
      {
        id: "report-export",
        title: "Accessibility Report Export",
        description:
          "Let users export filtered accessibility findings as PDF or CSV for sharing with project stakeholders.",
        gap: "The current register is useful in the browser, but it has no handoff format for audits, status meetings, or client reports.",
        category: "Reporting",
        priority: "Medium",
        source,
      },
      {
        id: "issue-assignment",
        title: "Issue Assignment",
        description:
          "Allow findings to be assigned to team members with clear ownership and follow-up responsibility.",
        gap: "Status alone does not identify who should resolve an issue or who is responsible for reviewing it.",
        category: "Workflow",
        priority: "Low",
        source,
      },
      {
        id: "dashboard-analytics",
        title: "Dashboard Analytics",
        description:
          "Add charts showing issue counts by severity, status, and WCAG criterion.",
        gap: `The dashboard has summary counts, but deeper patterns are hard to spot across ${context.issueCount} findings, including ${context.openIssueCount} open items.`,
        category: "Analytics",
        priority: "Low",
        source,
      },
    ];
  },
};
