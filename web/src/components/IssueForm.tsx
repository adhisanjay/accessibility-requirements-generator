import { useState, type FormEvent } from 'react';
import type { IssueInput, Severity } from '../types';

interface IssueFormProps { onSubmit: (input: IssueInput) => Promise<void>; onCancel: () => void; }

const initialForm: IssueInput = { title: '', description: '', wcagCriterion: '', severity: 'medium', status: 'open', recommendation: '' };

export function IssueForm({ onSubmit, onCancel }: IssueFormProps) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const update = (field: keyof IssueInput, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try { await onSubmit(form); setForm(initialForm); } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : 'Unable to save the issue.'); }
  };
  return (
    <form className="issue-form" onSubmit={submit} aria-labelledby="form-title">
      <div className="form-heading"><div><p className="eyebrow">Manual finding</p><h2 id="form-title">Create accessibility issue</h2></div><button className="icon-button" type="button" onClick={onCancel} aria-label="Close issue form">×</button></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <label>Title<input required value={form.title} onChange={(event) => update('title', event.target.value)} /></label>
      <label>Description<textarea required rows={4} value={form.description} onChange={(event) => update('description', event.target.value)} /></label>
      <div className="form-grid"><label>WCAG criterion<input required placeholder="e.g. 1.4.3" value={form.wcagCriterion} onChange={(event) => update('wcagCriterion', event.target.value)} /></label><label>Severity<select value={form.severity} onChange={(event) => update('severity', event.target.value as Severity)}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label></div>
      <label>Recommendation<textarea required rows={4} value={form.recommendation} onChange={(event) => update('recommendation', event.target.value)} /></label>
      <div className="form-actions"><button className="button secondary" type="button" onClick={onCancel}>Cancel</button><button className="button primary" type="submit">Save issue</button></div>
    </form>
  );
}
