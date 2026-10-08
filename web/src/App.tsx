import { useEffect, useState } from "react";
import { Plus, Search, ShieldCheck, Sparkles } from "lucide-react";
import { AIAnalysisAssistant } from "./components/AIAnalysisAssistant";
import { RequirementAssistant } from "./components/RequirementAssistant";
import { JiraAssistant } from "./components/JiraAssistant";
import { ScannerAssistant } from "./components/ScannerAssistant";
import { IssueForm } from "./components/IssueForm";
import { IssueTable } from "./components/IssueTable";
import { api } from "./services/api";
import type {
  IssueInput,
  IssueListResponse,
  IssueStatus,
  IssueSummary,
  Severity,
} from "./types";
import "./styles.css";

const emptyList: IssueListResponse = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
};
const emptySummary: IssueSummary = { total: 0, byStatus: [], bySeverity: [] };

export default function App() {
  const [list, setList] = useState(emptyList);
  const [summary, setSummary] = useState(emptySummary);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<Severity | "">("");
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "">("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<
    "dashboard" | "analysis" | "requirements" | "jira" | "scanner"
  >("dashboard");
  const load = async (
    value = search,
    severity = severityFilter,
    status = statusFilter,
  ) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (value) params.set("search", value);
      if (severity) params.set("severity", severity);
      if (status) params.set("status", status);
      const queryString = params.toString();
      const query = queryString ? `?${queryString}` : "";
      const [issues, totals] = await Promise.all([
        api.listIssues(query),
        api.getSummary(),
      ]);
      setList(issues);
      setSummary(totals);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load issues.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const createIssue = async (input: IssueInput) => {
    await api.createIssue(input);
    setShowForm(false);
    setNotice("Accessibility issue created.");
    await load();
  };
  const deleteIssue = async (id: number) => {
    await api.deleteIssue(id);
    setNotice("Accessibility issue deleted.");
    await load();
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <ShieldCheck size={22} aria-hidden="true" />
          </span>
          <span>
            A11y Audit
            <br />
            <strong>Assistant</strong>
          </span>
        </div>
        <nav aria-label="Primary navigation">
          <button
            className={view === "dashboard" ? "active" : ""}
            type="button"
            onClick={() => setView("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={view === "analysis" ? "active" : ""}
            type="button"
            onClick={() => setView("analysis")}
          >
            <span>
              <Sparkles size={15} aria-hidden="true" /> AI Analysis Assistant
            </span>
          </button>
          <button
            className={view === "requirements" ? "active" : ""}
            type="button"
            onClick={() => setView("requirements")}
          >
            Requirement Assistant
          </button>
          <button
            className={view === "jira" ? "active" : ""}
            type="button"
            onClick={() => setView("jira")}
          >
            Jira Assistant
          </button>
          <a href="#issues">Issues</a>
          <button
            className={view === "scanner" ? "active" : ""}
            type="button"
            aria-current={view === "scanner" ? "page" : undefined}
            onClick={() => setView("scanner")}
          >
            Scanner
          </button>
        </nav>
        <div className="sidebar-footer">
          <p>Local workspace</p>
          <span>V1 capstone demo</span>
        </div>
      </aside>
      <main className="main-content">
        {view === "dashboard" && (
          <header className="topbar">
            <div>
              <p className="eyebrow">Accessibility operations</p>
              <h1>Issues dashboard</h1>
            </div>
            <button
              className="button primary"
              type="button"
              onClick={() => setShowForm(true)}
            >
              <Plus size={18} aria-hidden="true" /> New issue
            </button>
          </header>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {view === "dashboard" && (
          <section className="summary-grid" aria-label="Issue summary">
            <article className="summary-card">
              <span>Total findings</span>
              <strong>{summary.total}</strong>
              <small>Across this workspace</small>
            </article>
            <article className="summary-card accent">
              <span>Open issues</span>
              <strong>
                {summary.byStatus.find((item) => item.status === "open")
                  ?.count ?? 0}
              </strong>
              <small>Ready for review</small>
            </article>
            <article className="summary-card">
              <span>High priority</span>
              <strong>
                {summary.bySeverity.find((item) => item.severity === "high")
                  ?.count ?? 0}
              </strong>
              <small>Needs attention</small>
            </article>
          </section>
        )}
        {view === "dashboard" && (
          <section className="issues-section" id="issues">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Finding register</p>
                <h2>
                  Accessibility issues <span>{list.total}</span>
                </h2>
              </div>
              <div className="register-controls">
                <div className="search-wrap">
                  <Search size={18} aria-hidden="true" />
                  <label className="sr-only" htmlFor="issue-search">
                    Search issues
                  </label>
                  <input
                    id="issue-search"
                    placeholder="Search issues"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      void load(
                        event.target.value,
                        severityFilter,
                        statusFilter,
                      );
                    }}
                  />
                </div>
                <label className="filter-control" htmlFor="severity-filter">
                  Severity
                  <select
                    id="severity-filter"
                    value={severityFilter}
                    onChange={(event) => {
                      const value = event.target.value as Severity | "";
                      setSeverityFilter(value);
                      void load(search, value, statusFilter);
                    }}
                  >
                    <option value="">All</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
                <label className="filter-control" htmlFor="status-filter">
                  Status
                  <select
                    id="status-filter"
                    value={statusFilter}
                    onChange={(event) => {
                      const value = event.target.value as IssueStatus | "";
                      setStatusFilter(value);
                      void load(search, severityFilter, value);
                    }}
                  >
                    <option value="">All</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </label>
              </div>
            </div>
            {loading ? (
              <div className="loading" role="status">
                Loading issues...
              </div>
            ) : (
              <IssueTable issues={list.items} onDelete={deleteIssue} />
            )}
          </section>
        )}
        {view === "analysis" && (
          <AIAnalysisAssistant
            issueCount={summary.total}
            openIssueCount={
              summary.byStatus.find((item) => item.status === "open")?.count ??
              0
            }
          />
        )}
        {view === "requirements" && (
          <RequirementAssistant onNotice={setNotice} />
        )}
        {view === "jira" && <JiraAssistant onNotice={setNotice} />}
        {view === "scanner" && <ScannerAssistant />}
        {showForm && (
          <div className="drawer-backdrop">
            <div className="drawer" role="dialog" aria-modal="true">
              <IssueForm
                onSubmit={createIssue}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
