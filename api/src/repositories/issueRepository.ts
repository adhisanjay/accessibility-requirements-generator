import { database } from '../database/database.js';
import type { AccessibilityIssue, IssueInput } from '../types/issue.js';

type IssueRow = Omit<AccessibilityIssue, 'wcagCriterion' | 'axeRuleId' | 'pageUrl' | 'createdAt' | 'updatedAt'> & {
  wcag_criterion: string;
  axe_rule_id: string | null;
  page_url: string | null;
  created_at: string;
  updated_at: string;
};

const mapIssue = (row: IssueRow): AccessibilityIssue => ({
  ...row,
  wcagCriterion: row.wcag_criterion,
  axeRuleId: row.axe_rule_id,
  pageUrl: row.page_url,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class IssueRepository {
  list(filters: { search?: string; severity?: string; status?: string; page: number; pageSize: number }) {
    const conditions: string[] = [];
    const parameters: Record<string, string | number> = {};
    if (filters.search) {
      conditions.push('(title LIKE @search OR description LIKE @search OR wcag_criterion LIKE @search)');
      parameters.search = `%${filters.search}%`;
    }
    if (filters.severity) {
      conditions.push('severity = @severity');
      parameters.severity = filters.severity;
    }
    if (filters.status) {
      conditions.push('status = @status');
      parameters.status = filters.status;
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (filters.page - 1) * filters.pageSize;
    const rows = database.prepare(`SELECT * FROM accessibility_issues ${where} ORDER BY updated_at DESC LIMIT @pageSize OFFSET @offset`).all({ ...parameters, pageSize: filters.pageSize, offset }) as IssueRow[];
    const total = database.prepare(`SELECT COUNT(*) as count FROM accessibility_issues ${where}`).get(parameters) as { count: number };
    return { items: rows.map(mapIssue), total: total.count, page: filters.page, pageSize: filters.pageSize };
  }

  getById(id: number) {
    const row = database.prepare('SELECT * FROM accessibility_issues WHERE id = ?').get(id) as IssueRow | undefined;
    return row ? mapIssue(row) : null;
  }

  listForAnalysis() {
    const rows = database
      .prepare("SELECT * FROM accessibility_issues ORDER BY id ASC")
      .all() as IssueRow[];
    return rows.map(mapIssue);
  }

  create(input: IssueInput) {
    const now = new Date().toISOString();
    const result = database.prepare(`INSERT INTO accessibility_issues (title, description, wcag_criterion, severity, status, recommendation, source, axe_rule_id, page_url, created_at, updated_at) VALUES (@title, @description, @wcagCriterion, @severity, @status, @recommendation, @source, @axeRuleId, @pageUrl, @createdAt, @updatedAt)`).run({ ...input, source: input.source ?? 'manual', axeRuleId: input.axeRuleId ?? null, pageUrl: input.pageUrl ?? null, createdAt: now, updatedAt: now });
    return this.getById(Number(result.lastInsertRowid));
  }

  update(id: number, input: IssueInput) {
    const now = new Date().toISOString();
    const result = database.prepare(`UPDATE accessibility_issues SET title = @title, description = @description, wcag_criterion = @wcagCriterion, severity = @severity, status = @status, recommendation = @recommendation, source = @source, axe_rule_id = @axeRuleId, page_url = @pageUrl, updated_at = @updatedAt WHERE id = @id`).run({ ...input, id, source: input.source ?? 'manual', axeRuleId: input.axeRuleId ?? null, pageUrl: input.pageUrl ?? null, updatedAt: now });
    return result.changes ? this.getById(id) : null;
  }

  delete(id: number) {
    return database.prepare('DELETE FROM accessibility_issues WHERE id = ?').run(id).changes > 0;
  }

  summary() {
    const total = (database.prepare('SELECT COUNT(*) as count FROM accessibility_issues').get() as { count: number }).count;
    const byStatus = database.prepare('SELECT status, COUNT(*) as count FROM accessibility_issues GROUP BY status').all() as { status: string; count: number }[];
    const bySeverity = database.prepare('SELECT severity, COUNT(*) as count FROM accessibility_issues GROUP BY severity').all() as { severity: string; count: number }[];
    return { total, byStatus, bySeverity };
  }
}
