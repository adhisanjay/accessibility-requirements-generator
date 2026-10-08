import { useEffect, useState } from "react";
import { Check, Pencil, Save, X } from "lucide-react";
import { api } from "../services/api";
import type { AnalysisSuggestion } from "../types/analysis";
import type {
  Requirement,
  RequirementPriority,
  RequirementStatus,
} from "../types/requirement";

interface RequirementAssistantProps {
  onNotice: (message: string) => void;
}

const statusOrder: RequirementStatus[] = [
  "Pending Review",
  "Approved",
  "Rejected",
];
const priorities: RequirementPriority[] = ["High", "Medium", "Low"];
const listFields = [
  ["functionalRequirements", "Functional Requirements"],
  ["accessibilityRequirements", "Accessibility Requirements"],
  ["nonFunctionalRequirements", "Non-Functional Requirements"],
  ["acceptanceCriteria", "Acceptance Criteria"],
  ["dependencies", "Dependencies"],
  ["assumptions", "Assumptions"],
] as const;

type ListField = (typeof listFields)[number][0];

export function RequirementAssistant({ onNotice }: RequirementAssistantProps) {
  const [enhancements, setEnhancements] = useState<AnalysisSuggestion[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const [suggestionResult, requirementResult] = await Promise.all([
        api.listSuggestions(),
        api.listRequirements(),
      ]);
      setEnhancements(
        suggestionResult.items.filter((item) => item.status === "Approved"),
      );
      setRequirements(requirementResult.items);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load requirements.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const generate = async (enhancementId: string) => {
    setGeneratingId(enhancementId);
    setError("");
    try {
      const requirement = await api.generateRequirement(enhancementId);
      setRequirements((current) =>
        current.some((item) => item.id === requirement.id)
          ? current.map((item) =>
              item.id === requirement.id ? requirement : item,
            )
          : [...current, requirement],
      );
      onNotice("Requirement generated for human review.");
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate requirement.",
      );
    } finally {
      setGeneratingId(null);
    }
  };

  const updateStatus = async (id: string, status: RequirementStatus) => {
    try {
      const updated = await api.updateRequirementStatus(id, status);
      setRequirements((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );
      onNotice(`Requirement marked ${status}.`);
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to update requirement status.",
      );
    }
  };

  const save = async () => {
    if (!draft) return;
    try {
      const updated = await api.updateRequirement(draft);
      setRequirements((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setEditingId(null);
      setDraft(null);
      onNotice("Requirement changes saved for human review.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save requirement.",
      );
    }
  };

  const counts = statusOrder.map((status) => ({
    status,
    count: requirements.filter((item) => item.status === status).length,
  }));

  return (
    <section className="requirements-page" aria-labelledby="requirements-title">
      <div className="analysis-hero">
        <div>
          <p className="eyebrow">Approved enhancement workflow</p>
          <h1 id="requirements-title">Requirement Assistant</h1>
          <p className="analysis-description">
            Convert approved AI enhancements into structured software
            requirements for human review.
          </p>
        </div>
      </div>
      <div className="analysis-note" role="note">
        <span>
          Only Approved AI enhancements are available here. Requirements remain
          independent from findings and are never sent to Jira automatically.
        </span>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="loading" role="status">
          Loading approved enhancements...
        </div>
      ) : enhancements.length === 0 ? (
        <div className="analysis-empty">
          <h2>
            No approved enhancements are available for requirement generation.
          </h2>
          <p>
            Approve an enhancement in AI Analysis Assistant before generating a
            requirement.
          </p>
        </div>
      ) : (
        <div className="enhancement-list" aria-label="Approved enhancements">
          {enhancements.map((enhancement) => {
            const requirement = requirements.find(
              (item) => item.enhancementId === enhancement.id,
            );
            return (
              <article className="enhancement-card" key={enhancement.id}>
                <div>
                  <span className="suggestion-category">
                    {enhancement.category}
                  </span>
                  <h2>{enhancement.title}</h2>
                  <p>{enhancement.description}</p>
                </div>
                {requirement ? (
                  <span className="requirement-linked">
                    Requirement generated
                  </span>
                ) : (
                  <button
                    className="button primary"
                    type="button"
                    disabled={generatingId === enhancement.id}
                    onClick={() => void generate(enhancement.id)}
                  >
                    {generatingId === enhancement.id
                      ? "Generating..."
                      : "Generate Requirement"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
      <div className="requirements-summary" aria-label="Requirement summary">
        <h2>
          Generated Requirements <span>{requirements.length}</span>
        </h2>
        <div className="analysis-summary">
          {counts.map(({ status, count }) => (
            <div
              className={`analysis-count ${status.toLowerCase().replace(" ", "-")}`}
              key={status}
            >
              <span>{status}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="requirement-list" aria-live="polite">
        {requirements.map((requirement) =>
          editingId === requirement.id && draft ? (
            <RequirementEditForm
              key={requirement.id}
              draft={draft}
              setDraft={setDraft}
              save={save}
              cancel={() => {
                setEditingId(null);
                setDraft(null);
              }}
            />
          ) : (
            <RequirementCard
              key={requirement.id}
              requirement={requirement}
              edit={() => {
                setEditingId(requirement.id);
                setDraft({ ...requirement });
              }}
              updateStatus={updateStatus}
            />
          ),
        )}
      </div>
    </section>
  );
}

function RequirementCard({
  requirement,
  edit,
  updateStatus,
}: {
  requirement: Requirement;
  edit: () => void;
  updateStatus: (id: string, status: RequirementStatus) => Promise<void>;
}) {
  return (
    <article className="requirement-card">
      <div className="requirement-card-heading">
        <div>
          <span className="requirement-id">{requirement.enhancementId}</span>
          <h2>{requirement.title}</h2>
        </div>
        <span
          className={`review-status ${requirement.status.toLowerCase().replace(" ", "-")}`}
        >
          {requirement.status}
        </span>
      </div>
      <p className="requirement-need">
        <strong>Business/User Need</strong>
        {requirement.businessUserNeed}
      </p>
      <p>{requirement.description}</p>
      <div className="requirement-columns">
        {listFields.map(([field, label]) => (
          <div key={field}>
            <h3>{label}</h3>
            <ul>
              {requirement[field].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="suggestion-actions">
        <button className="button secondary" type="button" onClick={edit}>
          <Pencil size={16} aria-hidden="true" /> Edit
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={() => void updateStatus(requirement.id, "Rejected")}
        >
          <X size={16} aria-hidden="true" /> Reject
        </button>
        <button
          className="button approve"
          type="button"
          onClick={() => void updateStatus(requirement.id, "Approved")}
        >
          <Check size={16} aria-hidden="true" /> Approve
        </button>
      </div>
    </article>
  );
}

function RequirementEditForm({
  draft,
  setDraft,
  save,
  cancel,
}: {
  draft: Requirement;
  setDraft: (draft: Requirement) => void;
  save: () => void;
  cancel: () => void;
}) {
  const updateList = (field: ListField, value: string) =>
    setDraft({
      ...draft,
      [field]: value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    });
  return (
    <article className="requirement-card requirement-edit-form">
      <label>
        Title
        <input
          value={draft.title}
          onChange={(event) =>
            setDraft({ ...draft, title: event.target.value })
          }
        />
      </label>
      <label>
        Business/User Need
        <textarea
          value={draft.businessUserNeed}
          onChange={(event) =>
            setDraft({ ...draft, businessUserNeed: event.target.value })
          }
        />
      </label>
      <label>
        Description
        <textarea
          value={draft.description}
          onChange={(event) =>
            setDraft({ ...draft, description: event.target.value })
          }
        />
      </label>
      {listFields.map(([field, label]) => (
        <label key={field}>
          {label}
          <textarea
            value={draft[field].join("\n")}
            onChange={(event) => updateList(field, event.target.value)}
          />
        </label>
      ))}
      <label>
        Priority
        <select
          value={draft.priority}
          onChange={(event) =>
            setDraft({
              ...draft,
              priority: event.target.value as RequirementPriority,
            })
          }
        >
          {priorities.map((priority) => (
            <option key={priority}>{priority}</option>
          ))}
        </select>
      </label>
      <div className="suggestion-actions">
        <button className="button secondary" type="button" onClick={cancel}>
          <X size={16} aria-hidden="true" /> Cancel
        </button>
        <button className="button approve" type="button" onClick={save}>
          <Save size={16} aria-hidden="true" /> Save
        </button>
      </div>
    </article>
  );
}
