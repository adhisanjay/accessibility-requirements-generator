import { useEffect, useState } from "react";
import { Check, Pencil, Save, X } from "lucide-react";
import { api } from "../services/api";
import type { Requirement } from "../types/requirement";
import type { JiraPackage, JiraPackageStatus, JiraPriority } from "../types/jira";

const priorities: JiraPriority[] = ["High", "Medium", "Low"];
const statuses: JiraPackageStatus[] = ["Pending Review", "Approved", "Rejected"];

export function JiraAssistant({ onNotice }: { onNotice: (message: string) => void }) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [packages, setPackages] = useState<JiraPackage[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<JiraPackage | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const [requirementResult, packageResult] = await Promise.all([
        api.listRequirements(),
        api.listJiraPackages(),
      ]);
      setRequirements(requirementResult.items);
      setPackages(packageResult.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Jira packages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const approvedRequirements = requirements.filter((item) => item.status === "Approved");
  const generate = async (requirementId: string) => {
    setGeneratingId(requirementId);
    try {
      const packageRecord = await api.generateJiraPackage(requirementId);
      setPackages((current) => current.some((item) => item.id === packageRecord.id)
        ? current.map((item) => item.id === packageRecord.id ? packageRecord : item)
        : [...current, packageRecord]);
      onNotice("Jira work items generated for human review.");
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Unable to generate Jira work items.");
    } finally {
      setGeneratingId(null);
    }
  };

  const save = async () => {
    if (!draft) return;
    try {
      const updated = await api.updateJiraPackage(draft);
      setPackages((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingId(null);
      setDraft(null);
      onNotice("Jira work item changes saved for human review.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save Jira work items.");
    }
  };

  const updateStatus = async (id: string, status: JiraPackageStatus) => {
    try {
      const updated = await api.updateJiraPackageStatus(id, status);
      setPackages((current) => current.map((item) => item.id === id ? updated : item));
      onNotice(`Jira package marked ${status}.`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update Jira package status.");
    }
  };

  return (
    <section className="requirements-page" aria-labelledby="jira-title">
      <div className="analysis-hero">
        <div>
          <p className="eyebrow">Approved requirement workflow</p>
          <h1 id="jira-title">Jira Assistant</h1>
          <p className="analysis-description">Convert approved requirements into a structured Jira Epic, User Story, and implementation Tasks for human review.</p>
        </div>
      </div>
      <div className="analysis-note" role="note">Mock Jira work items are persisted locally. Nothing is created in Jira automatically.</div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {loading ? <div className="loading" role="status">Loading approved requirements...</div> : approvedRequirements.length === 0 ? (
        <div className="analysis-empty"><h2>No approved requirements are available for Jira work item generation.</h2><p>Approve a requirement in Requirement Assistant before generating Jira work items.</p></div>
      ) : (
        <div className="enhancement-list" aria-label="Approved requirements">
          {approvedRequirements.map((requirement) => {
            const packageRecord = packages.find((item) => item.requirementId === requirement.id);
            return <article className="enhancement-card" key={requirement.id}><div><span className="suggestion-category">{requirement.priority} priority</span><h2>{requirement.title}</h2><p>{requirement.description}</p></div>{packageRecord ? <span className="requirement-linked">Jira package generated</span> : <button className="button primary" type="button" disabled={generatingId === requirement.id} onClick={() => void generate(requirement.id)}>{generatingId === requirement.id ? "Generating..." : "Generate Jira Items"}</button>}</article>;
          })}
        </div>
      )}
      <div className="requirements-summary" aria-label="Jira package summary"><h2>Jira Packages <span>{packages.length}</span></h2><div className="analysis-summary">{statuses.map((status) => <div className={`analysis-count ${status.toLowerCase().replace(" ", "-")}`} key={status}><span>{status}</span><strong>{packages.filter((item) => item.status === status).length}</strong></div>)}</div></div>
      <div className="requirement-list" aria-live="polite">{packages.map((packageRecord) => editingId === packageRecord.id && draft ? <JiraEditForm key={packageRecord.id} draft={draft} setDraft={setDraft} save={save} cancel={() => { setEditingId(null); setDraft(null); }} /> : <JiraPackageCard key={packageRecord.id} packageRecord={packageRecord} edit={() => { setEditingId(packageRecord.id); setDraft(structuredClone(packageRecord)); }} updateStatus={updateStatus} />)}</div>
    </section>
  );
}

function JiraPackageCard({ packageRecord, edit, updateStatus }: { packageRecord: JiraPackage; edit: () => void; updateStatus: (id: string, status: JiraPackageStatus) => Promise<void> }) {
  return <article className="requirement-card"><div className="requirement-card-heading"><div><span className="requirement-id">Requirement {packageRecord.requirementId}</span><h2>{packageRecord.epic.summary}</h2></div><span className={`review-status ${packageRecord.status.toLowerCase().replace(" ", "-")}`}>{packageRecord.status}</span></div><div className="jira-hierarchy"><div><h3>Epic</h3><p><strong>{packageRecord.epic.summary}</strong><br />{packageRecord.epic.description}</p><span>{packageRecord.epic.priority}</span></div><div><h3>Story</h3><p><strong>{packageRecord.story.summary}</strong><br />{packageRecord.story.description}</p><ul>{packageRecord.story.acceptanceCriteria.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>Tasks ({packageRecord.tasks.length})</h3><ul>{packageRecord.tasks.map((task) => <li key={task.id}><strong>{task.summary}</strong> <span>{task.priority}</span><br />{task.description}</li>)}</ul></div></div><div className="suggestion-actions"><button className="button secondary" type="button" onClick={edit}><Pencil size={16} aria-hidden="true" /> Edit</button><button className="button secondary" type="button" onClick={() => void updateStatus(packageRecord.id, "Rejected")}><X size={16} aria-hidden="true" /> Reject</button><button className="button approve" type="button" onClick={() => void updateStatus(packageRecord.id, "Approved")}><Check size={16} aria-hidden="true" /> Approve</button></div></article>;
}

function JiraEditForm({ draft, setDraft, save, cancel }: { draft: JiraPackage; setDraft: (value: JiraPackage) => void; save: () => void; cancel: () => void }) {
  const updateEpic = (field: "summary" | "description" | "priority", value: string) => setDraft({ ...draft, epic: { ...draft.epic, [field]: value } as JiraPackage["epic"] });
  const updateStory = (field: "summary" | "description" | "priority" | "acceptanceCriteria", value: string) => setDraft({ ...draft, story: { ...draft.story, [field]: field === "acceptanceCriteria" ? value.split("\n").filter(Boolean) : value } as JiraPackage["story"] });
  return <article className="requirement-card edit-form"><h2>Edit Jira Work Items</h2><fieldset><legend>Epic</legend><label>Summary<input value={draft.epic.summary} onChange={(event) => updateEpic("summary", event.target.value)} /></label><label>Description<textarea value={draft.epic.description} onChange={(event) => updateEpic("description", event.target.value)} /></label><label>Priority<select value={draft.epic.priority} onChange={(event) => updateEpic("priority", event.target.value)}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label></fieldset><fieldset><legend>User Story</legend><label>Summary<input value={draft.story.summary} onChange={(event) => updateStory("summary", event.target.value)} /></label><label>Description<textarea value={draft.story.description} onChange={(event) => updateStory("description", event.target.value)} /></label><label>Acceptance Criteria<textarea value={draft.story.acceptanceCriteria.join("\n")} onChange={(event) => updateStory("acceptanceCriteria", event.target.value)} /></label><label>Priority<select value={draft.story.priority} onChange={(event) => updateStory("priority", event.target.value)}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label></fieldset><fieldset><legend>Tasks</legend>{draft.tasks.map((task, index) => <div className="jira-task-edit" key={task.id}><label>Task {index + 1} Summary<input value={task.summary} onChange={(event) => setDraft({ ...draft, tasks: draft.tasks.map((item) => item.id === task.id ? { ...item, summary: event.target.value } : item) })} /></label><label>Description<textarea value={task.description} onChange={(event) => setDraft({ ...draft, tasks: draft.tasks.map((item) => item.id === task.id ? { ...item, description: event.target.value } : item) })} /></label><label>Priority<select value={task.priority} onChange={(event) => setDraft({ ...draft, tasks: draft.tasks.map((item) => item.id === task.id ? { ...item, priority: event.target.value as JiraPriority } : item) })}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label></div>)}</fieldset><div className="suggestion-actions"><button className="button secondary" type="button" onClick={cancel}><X size={16} aria-hidden="true" /> Cancel</button><button className="button primary" type="button" onClick={() => void save()}><Save size={16} aria-hidden="true" /> Save for review</button></div></article>;
}
