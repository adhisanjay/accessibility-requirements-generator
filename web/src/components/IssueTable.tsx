import type { AccessibilityIssue } from '../types';

interface IssueTableProps { issues: AccessibilityIssue[]; onDelete: (id: number) => Promise<void>; }

export function IssueTable({ issues, onDelete }: IssueTableProps) {
  if (!issues.length) return <div className="empty-state"><h2>No issues yet</h2><p>Create your first finding to start the audit.</p></div>;
  return <div className="table-wrap"><table><caption className="sr-only">Accessibility issues</caption><thead><tr><th scope="col">Issue</th><th scope="col">WCAG</th><th scope="col">Severity</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{issues.map((issue) => <tr key={issue.id}><td><strong>{issue.title}</strong><span className="muted">{issue.description}</span></td><td><span className="criterion">{issue.wcagCriterion}</span></td><td><span className={`severity ${issue.severity}`}>{issue.severity}</span></td><td><span className="status">{issue.status.replace('_', ' ')}</span></td><td><button className="text-button" type="button" onClick={() => onDelete(issue.id)} aria-label={`Delete ${issue.title}`}>Delete</button></td></tr>)}</tbody></table></div>;
}
