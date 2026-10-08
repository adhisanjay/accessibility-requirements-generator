import { useEffect, useState } from "react";
import { Check, Pencil, Save, Sparkles, X } from "lucide-react";
import { api } from "../services/api";
import type {
  AnalysisSuggestion,
  SuggestionCategory,
  SuggestionPriority,
  SuggestionStatus,
} from "../types/analysis";

interface AIAnalysisAssistantProps {
  issueCount: number;
  openIssueCount: number;
}

const statusOrder: SuggestionStatus[] = ["Pending", "Approved", "Rejected"];
const categories: SuggestionCategory[] = [
  "Accessibility",
  "Usability",
  "Reporting",
  "Workflow",
  "Analytics",
];
const priorities: SuggestionPriority[] = ["High", "Medium", "Low"];

export function AIAnalysisAssistant({
  issueCount,
  openIssueCount,
}: AIAnalysisAssistantProps) {
  const [suggestions, setSuggestions] = useState<AnalysisSuggestion[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AnalysisSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [analysisFeedback, setAnalysisFeedback] = useState("");

  const loadSuggestions = async () => {
    setError("");
    try {
      const result = await api.listSuggestions();
      setSuggestions(result.items);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load analysis suggestions.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSuggestions();
  }, []);

  const analyze = async () => {
    setAnalyzing(true);
    setError("");
    try {
      const result = await api.generateSuggestions({
        issueCount,
        openIssueCount,
      });
      setSuggestions(result.items);
      const failures = result.outcomes.filter((item) => item.status === "failed");
      setAnalysisFeedback(
        `${result.generatedCount} new analyses created; ${result.existingCount} already existed; ${result.failedCount} failed.` +
          (failures.length
            ? ` ${failures.map((item) => `Finding ${item.findingId}: ${item.error}`).join(" ")}`
            : ""),
      );
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "The analysis could not be completed. Please try again.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const updateStatus = async (id: string, status: SuggestionStatus) => {
    try {
      const updated = await api.updateSuggestionStatus(id, status);
      setSuggestions((current) =>
        current.map((suggestion) =>
          suggestion.id === id ? updated : suggestion,
        ),
      );
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to update review status.",
      );
    }
  };

  const startEditing = (suggestion: AnalysisSuggestion) => {
    setEditingId(suggestion.id);
    setDraft({ ...suggestion });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveSuggestion = async () => {
    if (!draft) return;
    try {
      const updated = await api.updateSuggestion(draft);
      setSuggestions((current) =>
        current.map((suggestion) =>
          suggestion.id === updated.id ? updated : suggestion,
        ),
      );
      cancelEditing();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save suggestion.",
      );
    }
  };

  const counts = statusOrder.map((status) => ({
    status,
    count: suggestions.filter((suggestion) => suggestion.status === status)
      .length,
  }));

  return (
    <section className="analysis-page" aria-labelledby="analysis-title">
      <div className="analysis-hero">
        <div>
          <p className="eyebrow">Human-reviewed recommendations</p>
          <h1 id="analysis-title">AI Analysis Assistant</h1>
          <p className="analysis-description">
            Generate an accessibility assessment for each finding in the register.
          </p>
        </div>
        <button
          className="button primary analyze-button"
          type="button"
          onClick={() => void analyze()}
          disabled={analyzing}
        >
          <Sparkles size={18} aria-hidden="true" />
          {analyzing ? "Analyzing application..." : "Analyze Application"}
        </button>
      </div>

      <div className="analysis-note" role="note">
        <Sparkles size={18} aria-hidden="true" />
        <span>
          Suggestions are proposed ideas only. Approving one records your human
          review; it does not create a finding, requirement, or Jira story.
        </span>
      </div>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {analysisFeedback && <div className="notice" role="status">{analysisFeedback}</div>}
      {loading ? (
        <div className="loading" role="status">
          Loading suggestions...
        </div>
      ) : suggestions.length === 0 ? (
        <div className="analysis-empty">
          <Sparkles size={28} aria-hidden="true" />
          <h2>Ready for a product-minded review?</h2>
          <p>
            Run an analysis to get structured enhancement suggestions based on
            the current finding register.
          </p>
        </div>
      ) : (
        <>
          <div className="analysis-summary" aria-label="Suggestion summary">
            {counts.map(({ status, count }) => (
              <div
                className={`analysis-count ${status.toLowerCase()}`}
                key={status}
              >
                <span>{status}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <div className="suggestion-list" aria-live="polite">
            {suggestions.map((suggestion) => (
              <article className="suggestion-card" key={suggestion.id}>
                {editingId === suggestion.id && draft ? (
                  <div className="suggestion-edit-form">
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
                      Description
                      <textarea
                        value={draft.description}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            description: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Gap identified
                      <textarea
                        value={draft.gap}
                        onChange={(event) =>
                          setDraft({ ...draft, gap: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      WCAG 2.2 criterion
                      <input
                        value={draft.wcagCriterion ?? ""}
                        onChange={(event) =>
                          setDraft({ ...draft, wcagCriterion: event.target.value || null })
                        }
                      />
                    </label>
                    <label>
                      WCAG level
                      <select
                        value={draft.wcagLevel ?? ""}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            wcagLevel: (event.target.value || null) as AnalysisSuggestion["wcagLevel"],
                          })
                        }
                      >
                        <option value="">Not specified</option>
                        <option value="A">A</option>
                        <option value="AA">AA</option>
                        <option value="AAA">AAA</option>
                      </select>
                    </label>
                    <label>
                      Accessibility impact
                      <textarea
                        value={draft.accessibilityImpact ?? ""}
                        onChange={(event) =>
                          setDraft({ ...draft, accessibilityImpact: event.target.value || null })
                        }
                      />
                    </label>
                    <label>
                      Recommended remediation
                      <textarea
                        value={draft.recommendedRemediation ?? ""}
                        onChange={(event) =>
                          setDraft({ ...draft, recommendedRemediation: event.target.value || null })
                        }
                      />
                    </label>
                    <label>
                      Developer implementation guidance
                      <textarea
                        value={draft.developerGuidance ?? ""}
                        onChange={(event) =>
                          setDraft({ ...draft, developerGuidance: event.target.value || null })
                        }
                      />
                    </label>
                    <label>
                      Verification steps
                      <textarea
                        value={draft.verificationSteps.join("\n")}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            verificationSteps: event.target.value
                              .split("\n")
                              .map((step) => step.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </label>
                    <label>
                      Confidence (0 to 1)
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={draft.confidence ?? ""}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            confidence: event.target.value === "" ? null : Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <div className="form-grid">
                      <label>
                        Category
                        <select
                          value={draft.category}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              category: event.target
                                .value as SuggestionCategory,
                            })
                          }
                        >
                          {categories.map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Priority
                        <select
                          value={draft.priority}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              priority: event.target
                                .value as SuggestionPriority,
                            })
                          }
                        >
                          {priorities.map((priority) => (
                            <option key={priority}>{priority}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label>
                      Source
                      <input
                        value={draft.source}
                        onChange={(event) =>
                          setDraft({ ...draft, source: event.target.value })
                        }
                      />
                    </label>
                    <div className="suggestion-actions">
                      <button
                        className="button secondary"
                        type="button"
                        onClick={cancelEditing}
                      >
                        <X size={16} aria-hidden="true" /> Cancel
                      </button>
                      <button
                        className="button approve"
                        type="button"
                        onClick={() => void saveSuggestion()}
                      >
                        <Save size={16} aria-hidden="true" /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="suggestion-card-topline">
                      <span className="suggestion-category">
                        {suggestion.category}
                      </span>
                      <span
                        className={`priority ${suggestion.priority.toLowerCase()}`}
                      >
                        {suggestion.priority} priority
                      </span>
                    </div>
                    <div className="suggestion-card-heading">
                      <div>
                        <h2>{suggestion.title}</h2>
                        <p>{suggestion.description}</p>
                      </div>
                      <span
                        className={`review-status ${suggestion.status.toLowerCase()}`}
                      >
                        {suggestion.status}
                      </span>
                    </div>
                    <dl className="suggestion-details">
                      <div>
                        <dt>Root cause</dt>
                        <dd>{suggestion.gap}</dd>
                      </div>
                      <div>
                        <dt>WCAG 2.2</dt>
                        <dd>
                          {suggestion.wcagCriterion
                            ? `${suggestion.wcagCriterion} (Level ${suggestion.wcagLevel ?? "not specified"})`
                            : "Not mapped"}
                        </dd>
                      </div>
                      <div>
                        <dt>Accessibility impact</dt>
                        <dd>{suggestion.accessibilityImpact ?? "Not provided"}</dd>
                      </div>
                      <div>
                        <dt>Recommended remediation</dt>
                        <dd>{suggestion.recommendedRemediation ?? "Not provided"}</dd>
                      </div>
                      <div>
                        <dt>Developer guidance</dt>
                        <dd>{suggestion.developerGuidance ?? "Not provided"}</dd>
                      </div>
                      <div>
                        <dt>Verification steps</dt>
                        <dd>
                          {suggestion.verificationSteps.length ? (
                            <ul>{suggestion.verificationSteps.map((step) => <li key={step}>{step}</li>)}</ul>
                          ) : "Not provided"}
                        </dd>
                      </div>
                      <div>
                        <dt>Confidence</dt>
                        <dd>{suggestion.confidence === null ? "Not provided" : `${Math.round(suggestion.confidence * 100)}%`}</dd>
                      </div>
                      <div>
                        <dt>Source</dt>
                        <dd>{suggestion.source}</dd>
                      </div>
                    </dl>
                    <div className="suggestion-actions">
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => startEditing(suggestion)}
                      >
                        <Pencil size={16} aria-hidden="true" /> Edit
                      </button>
                      {suggestion.status === "Pending" && (
                        <>
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() =>
                              void updateStatus(suggestion.id, "Rejected")
                            }
                          >
                            <X size={16} aria-hidden="true" /> Reject
                          </button>
                          <button
                            className="button approve"
                            type="button"
                            onClick={() =>
                              void updateStatus(suggestion.id, "Approved")
                            }
                          >
                            <Check size={16} aria-hidden="true" /> Approve
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
