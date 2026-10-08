import { database } from "../database/database.js";
import { IssueRepository } from "../repositories/issueRepository.js";
import { ScanRepository } from "../repositories/scanRepository.js";
import type {
  AxeViolation,
  ScanImportResult,
  ScanResult,
  ScanSummary,
} from "../types/scan.js";
import { runAxeScan } from "./axeScanner.js";
import {
  normalizeAndValidateScanUrl,
  type AllowedScanHosts,
  type HostResolver,
} from "./scanTarget.js";

export interface ScanServiceOptions {
  repository?: ScanRepository;
  issueRepository?: IssueRepository;
  executor?: (url: string) => Promise<AxeViolation[]>;
  resolveHostname?: HostResolver;
  allowedHosts?: AllowedScanHosts;
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "The scan could not be completed.";
  return message.replace(/https?:\/\/[^\s]+/gi, "[target URL]").slice(0, 500);
}

function wcagCriterion(tags: string[]) {
  const tag = tags.find((value) => /^wcag\d{3,4}$/i.test(value));
  if (!tag) return "Not mapped";
  const digits = tag.slice(4);
  const criterion = digits.length === 3
    ? `${digits[0]}.${digits[1]}.${digits[2]}`
    : `${digits[0]}.${digits[1]}.${digits.slice(2)}`;
  return `WCAG ${criterion}`;
}

function findingSeverity(impact: ScanResult["impact"]) {
  switch (impact) {
    case "critical": return "critical" as const;
    case "serious": return "high" as const;
    case "moderate": return "medium" as const;
    case "minor": return "low" as const;
    default: return "medium" as const;
  }
}

export class ScanService {
  private readonly repository: ScanRepository;
  private readonly issueRepository: IssueRepository;
  private readonly executor: (url: string) => Promise<AxeViolation[]>;
  private readonly resolveHostname?: HostResolver;
  private readonly allowedHosts?: AllowedScanHosts;

  constructor(options: ScanServiceOptions = {}) {
    this.repository = options.repository ?? new ScanRepository();
    this.issueRepository = options.issueRepository ?? new IssueRepository();
    this.executor = options.executor ?? runAxeScan;
    this.resolveHostname = options.resolveHostname;
    this.allowedHosts = options.allowedHosts;
  }

  async startScan(inputUrl: string) {
    const url = await normalizeAndValidateScanUrl(
      inputUrl,
      this.resolveHostname,
      this.allowedHosts,
    );
    const scan = this.repository.create(url);
    if (!scan) throw new Error("Unable to create scan record.");

    void this.executeScan(scan.id, url);
    return scan;
  }

  private async executeScan(scanId: number, url: string) {
    try {
      const violations = await this.executor(url);
      this.repository.complete(scanId, url, violations);
    } catch (error) {
      this.repository.fail(scanId, errorMessage(error));
    }
  }

  getScan(id: number) {
    return this.repository.getScan(id);
  }

  getResults(id: number) {
    const scan = this.repository.getScan(id);
    if (!scan) return null;
    const results = this.repository.listResults(id);
    const summary: ScanSummary = {
      violations: results.length,
      critical: results.filter((item) => item.impact === "critical").length,
      serious: results.filter((item) => item.impact === "serious").length,
      moderate: results.filter((item) => item.impact === "moderate").length,
      minor: results.filter((item) => item.impact === "minor").length,
    };
    return { scan, summary, items: results };
  }

  selectResult(scanId: number, resultId: number, selected: boolean) {
    const scan = this.repository.getScan(scanId);
    if (!scan || scan.status !== "completed") return null;
    return this.repository.setSelected(scanId, resultId, selected);
  }

  importSelected(scanId: number): ScanImportResult | null {
    const scan = this.repository.getScan(scanId);
    if (!scan || scan.status !== "completed") return null;

    const outcomes: ScanImportResult = {
      importedCount: 0,
      alreadyImportedCount: 0,
      errors: [],
    };
    const results = this.repository.listResults(scanId);

    for (const item of results) {
      if (item.importedIssueId !== null) {
        outcomes.alreadyImportedCount += 1;
        continue;
      }
      if (item.reviewStatus !== "selected") continue;

      try {
        const imported = database.transaction(() => {
          const current = this.repository.getResult(scanId, item.id);
          if (!current || current.importedIssueId !== null) return false;

          const evidence = [
            current.targets.length
              ? `Affected targets:\n${current.targets.map((target) => `- ${target}`).join("\n")}`
              : "",
            current.htmlSnippets.length
              ? `HTML evidence:\n${current.htmlSnippets.map((html) => `- ${html}`).join("\n")}`
              : "",
          ].filter(Boolean).join("\n\n");
          const description = [current.description, evidence]
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 5000);
          const recommendation = [current.helpText, current.helpUrl]
            .filter(Boolean)
            .join(" ") || "Review the axe-core finding and determine an appropriate fix.";
          const issue = this.issueRepository.create({
            title: `${current.ruleId}: ${current.helpText}`.slice(0, 200),
            description,
            wcagCriterion: wcagCriterion(current.wcagTags),
            severity: findingSeverity(current.impact),
            status: "open",
            recommendation: recommendation.slice(0, 5000),
            source: "axe",
            axeRuleId: current.ruleId,
            pageUrl: current.pageUrl,
          });
          if (!issue) throw new Error("The finding could not be created.");
          this.repository.markImported(scanId, current.id, issue.id);
          return true;
        })();

        if (imported) outcomes.importedCount += 1;
        else outcomes.alreadyImportedCount += 1;
      } catch {
        outcomes.errors.push({
          resultId: item.id,
          message: "This finding could not be imported.",
        });
      }
    }

    return outcomes;
  }
}