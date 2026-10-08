import { AnalysisRepository } from "../repositories/analysisRepository.js";
import { IssueRepository } from "../repositories/issueRepository.js";
import { accessibilityAnalysisOutputSchema } from "../schemas/analysis.js";
import type {
  AccessibilityAnalysisOutput,
  AnalysisOutcome,
  AnalysisSuggestionInput,
} from "../types/analysis.js";
import type { AccessibilityIssue } from "../types/issue.js";
import { validateWcagMapping } from "./wcag22.js";
import type { AccessibilityAnalysisProvider } from "./analysisProvider.js";
import { logProviderErrorDiagnostic } from "./analysisProviderDiagnostics.js";

const maximumConcurrentAnalyses = 3;

export interface AnalysisOrchestratorOptions {
  provider: AccessibilityAnalysisProvider;
  analysisRepository?: AnalysisRepository;
  issueRepository?: IssueRepository;
  timeoutMs?: number;
}

function findingPriority(severity: AccessibilityIssue["severity"]) {
  if (severity === "critical" || severity === "high") return "High" as const;
  if (severity === "low") return "Low" as const;
  return "Medium" as const;
}

function safeProviderError(error: unknown) {
  if (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError" || /timeout/i.test(error.message))
  ) {
    return "The analysis provider timed out.";
  }
  return "The analysis provider could not analyze this finding.";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout>;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      const error = new Error("Analysis request timed out.");
      error.name = "TimeoutError";
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timedOut]).finally(() => clearTimeout(timeout));
}

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  callback: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await callback(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

export class AccessibilityAnalysisService {
  private readonly provider: AccessibilityAnalysisProvider;
  private readonly analysisRepository: AnalysisRepository;
  private readonly issueRepository: IssueRepository;
  private readonly timeoutMs: number;

  constructor(options: AnalysisOrchestratorOptions) {
    this.provider = options.provider;
    this.analysisRepository = options.analysisRepository ?? new AnalysisRepository();
    this.issueRepository = options.issueRepository ?? new IssueRepository();
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  async analyzePersistedFindings() {
    const findings = this.issueRepository.listForAnalysis();
    const outcomes = await mapConcurrent(
      findings,
      maximumConcurrentAnalyses,
      (finding) => this.analyzeOne(finding),
    );
    return {
      items: this.analysisRepository.list(),
      outcomes,
      generatedCount: outcomes.filter((item) => item.status === "created").length,
      existingCount: outcomes.filter((item) => item.status === "existing").length,
      failedCount: outcomes.filter((item) => item.status === "failed").length,
    };
  }

  private async analyzeOne(finding: AccessibilityIssue): Promise<AnalysisOutcome> {
    const existing = this.analysisRepository.getByFindingId(finding.id);
    if (existing) {
      return {
        findingId: finding.id,
        status: "existing",
        suggestionId: existing.id,
      };
    }

    let output: AccessibilityAnalysisOutput;
    try {
      const rawOutput = await withTimeout(
        this.provider.analyzeFinding(finding),
        this.timeoutMs,
      );
      const parsed = accessibilityAnalysisOutputSchema.safeParse(rawOutput);
      if (!parsed.success) {
        return {
          findingId: finding.id,
          status: "failed",
          error: "The provider returned incomplete or invalid structured analysis.",
        };
      }
      if (!validateWcagMapping(parsed.data.wcagCriterion, parsed.data.wcagLevel)) {
        return {
          findingId: finding.id,
          status: "failed",
          error: "The provider returned a WCAG criterion and level that do not match WCAG 2.2.",
        };
      }
      output = parsed.data;
    } catch (error) {
      logProviderErrorDiagnostic(error);
      return {
        findingId: finding.id,
        status: "failed",
        error: safeProviderError(error),
      };
    }

    const input: AnalysisSuggestionInput & { findingId: number } = {
      id: `finding-analysis-${finding.id}`,
      findingId: finding.id,
      title: output.title,
      description: finding.description,
      gap: output.rootCause,
      wcagCriterion: output.wcagCriterion,
      wcagLevel: output.wcagLevel,
      accessibilityImpact: output.accessibilityImpact,
      recommendedRemediation: output.recommendedRemediation,
      developerGuidance: output.developerGuidance,
      verificationSteps: output.verificationSteps,
      confidence: output.confidence,
      category: "Accessibility",
      priority: findingPriority(finding.severity),
      source: this.provider.name,
    };
    const saved = this.analysisRepository.createForFinding(input);
    if (!saved) {
      return {
        findingId: finding.id,
        status: "failed",
        error: "The validated analysis could not be saved.",
      };
    }
    return {
      findingId: finding.id,
      status: saved.findingId === finding.id ? "created" : "existing",
      suggestionId: saved.id,
    };
  }
}