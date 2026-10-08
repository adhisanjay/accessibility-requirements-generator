import { database } from "../database/database.js";
function parseList(value) {
    if (!value)
        return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
            ? parsed
            : [];
    }
    catch {
        return [];
    }
}
const mapScan = (row) => ({
    id: row.id,
    url: row.url,
    status: row.status,
    totalViolations: row.total_violations,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
});
const mapResult = (row) => ({
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
    create(url) {
        const result = database
            .prepare("INSERT INTO scans (url, status, started_at) VALUES (?, 'running', ?)")
            .run(url, new Date().toISOString());
        return this.getScan(Number(result.lastInsertRowid));
    }
    getScan(id) {
        const row = database
            .prepare("SELECT * FROM scans WHERE id = ?")
            .get(id);
        return row ? mapScan(row) : null;
    }
    complete(id, url, violations) {
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
                if (existing)
                    continue;
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
                .prepare("UPDATE scans SET status = 'completed', total_violations = (SELECT COUNT(*) FROM scan_results WHERE scan_id = ?), completed_at = ?, error_message = NULL WHERE id = ?")
                .run(id, new Date().toISOString(), id);
        });
        transaction();
        return this.getScan(id);
    }
    fail(id, message) {
        database
            .prepare("UPDATE scans SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?")
            .run(message.slice(0, 500), new Date().toISOString(), id);
        return this.getScan(id);
    }
    listResults(scanId) {
        const rows = database
            .prepare("SELECT * FROM scan_results WHERE scan_id = ? ORDER BY id ASC")
            .all(scanId);
        return rows.map(mapResult);
    }
    getResult(scanId, resultId) {
        const row = database
            .prepare("SELECT * FROM scan_results WHERE scan_id = ? AND id = ?")
            .get(scanId, resultId);
        return row ? mapResult(row) : null;
    }
    setSelected(scanId, resultId, selected) {
        const result = database
            .prepare("UPDATE scan_results SET review_status = ? WHERE scan_id = ? AND id = ? AND imported_issue_id IS NULL")
            .run(selected ? "selected" : "pending", scanId, resultId);
        return result.changes ? this.getResult(scanId, resultId) : null;
    }
    markImported(scanId, resultId, issueId) {
        database
            .prepare("UPDATE scan_results SET review_status = 'imported', imported_issue_id = ? WHERE scan_id = ? AND id = ? AND imported_issue_id IS NULL")
            .run(issueId, scanId, resultId);
    }
}
