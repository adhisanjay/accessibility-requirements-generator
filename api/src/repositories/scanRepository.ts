import { database } from "../database/database.js";
import type {
  AxeViolation,
  ScanRecord,
  ScanResult,
  ScanStatus,
} from "../types/scan.js";

type ScanRow = {
  id: number;
  url: string;
  status: ScanStatus;
  total_violations: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
};

type ScanResultRow = {
  id: number;
  scan_id: number;
  rule_id: string;
  impact: ScanResult["impact"];
  description: string;
  help_text: string;
  help_url: string | null;
  html_snippet: string | null;
  target: string | null;
  wcag_tags: string | null;
  page_url: string | null;
  review_status: ScanResult["reviewStatus"];
  imported_issue_id: number | null;
};

function parseList(value: string | null) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

const mapScan = (row: ScanRow): ScanRecord => ({
  id: row.id,
  url: row.url,
  status: row.status,
  totalViolations: row.total_violations,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  errorMessage: row.error_message,
});

const mapResult = (row: ScanResultRow): ScanResult => ({
  id: row.id,
  scanId: row.scan_id,
  ruleId: row.rule_id,
  impact: row.impact,
  description: row.description,
  helpText: row.help_text,
  helpUrl: row.help_url,
  htmlSnippets: parseList(row.html_snippet),
  targets: parseList(row.target),
  wcagTags: parseList(row.wcag_tags),
  pageUrl: row.page_url ?? "",
  reviewStatus: row.review_status,
  importedIssueId: row.imported_issue_id,
});

export class ScanRepository {
  create(url: string) {
    const result = database
      .prepare(
        "INSERT INTO scans (url, status, started_at) VALUES (?, 'running', ?)",
      )
      .run(url, new Date().toISOString());
    return this.getScan(Number(result.lastInsertRowid));
  }

  getScan(id: number) {
    const row = database
      .prepare("SELECT * FROM scans WHERE id = ?")
      .get(id) as ScanRow | undefined;
    return row ? mapScan(row) : null;
  }

  complete(id: number, url: string, violations: AxeViolation[]) {
    const insert = database.prepare(`
      INSERT INTO scan_results (
        scan_id, rule_id, impact, description, help_text, help_url,
        html_snippet, target, wcag_tags, review_status, page_url
      ) VALUES (
        @scanId, @ruleId, @impact, @description, @helpText, @helpUrl,
        @htmlSnippet, @target, @wcagTags, 'pending', @pageUrl
      )
    `);
    const transaction = database.transaction(() => {
      for (const violation of violations) {
        const existing = database
          .prepare("SELECT id FROM scan_results WHERE scan_id = ? AND rule_id = ?")
          .get(id, violation.ruleId);
        if (existing) continue;
        insert.run({
          scanId: id,
          ruleId: violation.ruleId,
          impact: violation.impact,
          description: violation.description.slice(0, 5000),
          helpText: violation.helpText.slice(0, 1000),
          helpUrl: violation.helpUrl,
          htmlSnippet: JSON.stringify(violation.htmlSnippets.slice(0, 100)),
          target: JSON.stringify(violation.targets.slice(0, 500)),
          wcagTags: JSON.stringify(violation.wcagTags),
          pageUrl: url,
        });
      }
      database
        .prepare(
          "UPDATE scans SET status = 'completed', total_violations = (SELECT COUNT(*) FROM scan_results WHERE scan_id = ?), completed_at = ?, error_message = NULL WHERE id = ?",
        )
        .run(id, new Date().toISOString(), id);
    });
    transaction();
    return this.getScan(id);
  }

  fail(id: number, message: string) {
    database
      .prepare(
        "UPDATE scans SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?",
      )
      .run(message.slice(0, 500), new Date().toISOString(), id);
    return this.getScan(id);
  }

  listResults(scanId: number) {
    const rows = database
      .prepare("SELECT * FROM scan_results WHERE scan_id = ? ORDER BY id ASC")
      .all(scanId) as ScanResultRow[];
    return rows.map(mapResult);
  }

  getResult(scanId: number, resultId: number) {
    const row = database
      .prepare("SELECT * FROM scan_results WHERE scan_id = ? AND id = ?")
      .get(scanId, resultId) as ScanResultRow | undefined;
    return row ? mapResult(row) : null;
  }

  setSelected(scanId: number, resultId: number, selected: boolean) {
    const result = database
      .prepare(
        "UPDATE scan_results SET review_status = ? WHERE scan_id = ? AND id = ? AND imported_issue_id IS NULL",
      )
      .run(selected ? "selected" : "pending", scanId, resultId);
    return result.changes ? this.getResult(scanId, resultId) : null;
  }

  markImported(scanId: number, resultId: number, issueId: number) {
    database
      .prepare(
        "UPDATE scan_results SET review_status = 'imported', imported_issue_id = ? WHERE scan_id = ? AND id = ? AND imported_issue_id IS NULL",
      )
      .run(issueId, scanId, resultId);
  }
}