import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
const dataDirectory = path.resolve(process.env.DATA_DIR ?? "../../data");
fs.mkdirSync(dataDirectory, { recursive: true });
export const database = new Database(path.join(dataDirectory, "a11y-audit.sqlite"));
database.pragma("foreign_keys = ON");
database.exec(`
  CREATE TABLE IF NOT EXISTS accessibility_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    wcag_criterion TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'wont_fix')),
    recommendation TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'axe')),
    axe_rule_id TEXT,
    page_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    total_violations INTEGER NOT NULL DEFAULT 0,
    started_at TEXT,
    completed_at TEXT,
    error_message TEXT
  );

  CREATE TABLE IF NOT EXISTS scan_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    rule_id TEXT NOT NULL,
    impact TEXT,
    description TEXT NOT NULL,
    help_text TEXT NOT NULL DEFAULT '',
    help_url TEXT,
    html_snippet TEXT,
    target TEXT,
    wcag_tags TEXT,
    review_status TEXT NOT NULL DEFAULT 'pending',
    page_url TEXT,
    imported_issue_id INTEGER REFERENCES accessibility_issues(id)
  );

  CREATE TABLE IF NOT EXISTS analysis_suggestions (
    id TEXT PRIMARY KEY,
    finding_id INTEGER REFERENCES accessibility_issues(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    gap TEXT NOT NULL,
    wcag_criterion TEXT,
    wcag_level TEXT,
    accessibility_impact TEXT,
    recommended_remediation TEXT,
    developer_guidance TEXT,
    verification_steps TEXT,
    confidence REAL,
    category TEXT NOT NULL CHECK (category IN ('Accessibility', 'Usability', 'Reporting', 'Workflow', 'Analytics')),
    priority TEXT NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS requirements (
    id TEXT PRIMARY KEY,
    enhancement_id TEXT NOT NULL UNIQUE REFERENCES analysis_suggestions(id),
    title TEXT NOT NULL,
    business_user_need TEXT NOT NULL,
    description TEXT NOT NULL,
    functional_requirements TEXT NOT NULL,
    accessibility_requirements TEXT NOT NULL,
    non_functional_requirements TEXT NOT NULL,
    acceptance_criteria TEXT NOT NULL,
    dependencies TEXT NOT NULL,
    assumptions TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
    status TEXT NOT NULL DEFAULT 'Pending Review' CHECK (status IN ('Pending Review', 'Approved', 'Rejected')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS jira_packages (
    id TEXT PRIMARY KEY,
    requirement_id TEXT NOT NULL UNIQUE REFERENCES requirements(id),
    status TEXT NOT NULL DEFAULT 'Pending Review' CHECK (status IN ('Pending Review', 'Approved', 'Rejected')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS jira_epics (
    id TEXT PRIMARY KEY,
    package_id TEXT NOT NULL UNIQUE REFERENCES jira_packages(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('High', 'Medium', 'Low'))
  );

  CREATE TABLE IF NOT EXISTS jira_stories (
    id TEXT PRIMARY KEY,
    package_id TEXT NOT NULL UNIQUE REFERENCES jira_packages(id) ON DELETE CASCADE,
    epic_id TEXT NOT NULL REFERENCES jira_epics(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    description TEXT NOT NULL,
    acceptance_criteria TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('High', 'Medium', 'Low'))
  );

  CREATE TABLE IF NOT EXISTS jira_tasks (
    id TEXT PRIMARY KEY,
    package_id TEXT NOT NULL REFERENCES jira_packages(id) ON DELETE CASCADE,
    epic_id TEXT NOT NULL REFERENCES jira_epics(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('High', 'Medium', 'Low'))
  );
`);
const analysisColumns = database
    .prepare("PRAGMA table_info(analysis_suggestions)")
    .all();
const existingAnalysisColumns = new Set(analysisColumns.map((column) => column.name));
const analysisMigrations = [
    ["finding_id", "INTEGER REFERENCES accessibility_issues(id) ON DELETE SET NULL"],
    ["wcag_criterion", "TEXT"],
    ["wcag_level", "TEXT"],
    ["accessibility_impact", "TEXT"],
    ["recommended_remediation", "TEXT"],
    ["developer_guidance", "TEXT"],
    ["verification_steps", "TEXT"],
    ["confidence", "REAL"],
];
for (const [column, definition] of analysisMigrations) {
    if (!existingAnalysisColumns.has(column)) {
        database.exec(`ALTER TABLE analysis_suggestions ADD COLUMN ${column} ${definition}`);
    }
}
database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_analysis_suggestions_finding_id ON analysis_suggestions(finding_id) WHERE finding_id IS NOT NULL");
const scanResultColumns = database
    .prepare("PRAGMA table_info(scan_results)")
    .all();
const existingScanResultColumns = new Set(scanResultColumns.map((column) => column.name));
if (!existingScanResultColumns.has("help_text")) {
    database.exec("ALTER TABLE scan_results ADD COLUMN help_text TEXT NOT NULL DEFAULT ''");
}
if (!existingScanResultColumns.has("page_url")) {
    database.exec("ALTER TABLE scan_results ADD COLUMN page_url TEXT");
}
if (!existingScanResultColumns.has("imported_issue_id")) {
    database.exec("ALTER TABLE scan_results ADD COLUMN imported_issue_id INTEGER REFERENCES accessibility_issues(id)");
}
database.exec("CREATE INDEX IF NOT EXISTS idx_scan_results_scan_id ON scan_results(scan_id)");
