import { database } from "../database/database.js";
function parseVerificationSteps(value) {
    if (!value)
        return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.every((step) => typeof step === "string")
            ? parsed
            : [];
    }
    catch {
        return [];
    }
}
const mapSuggestion = (row) => ({
    id: row.id,
    findingId: row.finding_id,
    title: row.title,
    description: row.description,
    gap: row.gap,
    wcagCriterion: row.wcag_criterion,
    wcagLevel: row.wcag_level,
    accessibilityImpact: row.accessibility_impact,
    recommendedRemediation: row.recommended_remediation,
    developerGuidance: row.developer_guidance,
    verificationSteps: parseVerificationSteps(row.verification_steps),
    confidence: row.confidence,
    category: row.category,
    priority: row.priority,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});
export class AnalysisRepository {
    list() {
        const rows = database
            .prepare("SELECT * FROM analysis_suggestions ORDER BY created_at ASC")
            .all();
        return rows.map(mapSuggestion);
    }
    getById(id) {
        const row = database
            .prepare("SELECT * FROM analysis_suggestions WHERE id = ?")
            .get(id);
        return row ? mapSuggestion(row) : null;
    }
    createMany(suggestions) {
        const now = new Date().toISOString();
        const insert = database.prepare(`INSERT OR IGNORE INTO analysis_suggestions (
      id, finding_id, title, description, gap, wcag_criterion, wcag_level,
      accessibility_impact, recommended_remediation, developer_guidance,
      verification_steps, confidence, category, priority, source, status,
      created_at, updated_at
    ) VALUES (
      @id, @findingId, @title, @description, @gap, @wcagCriterion, @wcagLevel,
      @accessibilityImpact, @recommendedRemediation, @developerGuidance,
      @verificationSteps, @confidence, @category, @priority, @source, @status,
      @createdAt, @updatedAt
    )`);
        const transaction = database.transaction((items) => {
            items.forEach((suggestion) => insert.run({
                ...suggestion,
                findingId: suggestion.findingId ?? null,
                wcagCriterion: suggestion.wcagCriterion ?? null,
                wcagLevel: suggestion.wcagLevel ?? null,
                accessibilityImpact: suggestion.accessibilityImpact ?? null,
                recommendedRemediation: suggestion.recommendedRemediation ?? null,
                developerGuidance: suggestion.developerGuidance ?? null,
                verificationSteps: JSON.stringify(suggestion.verificationSteps ?? []),
                confidence: suggestion.confidence ?? null,
                status: suggestion.status ?? "Pending",
                createdAt: now,
                updatedAt: now,
            }));
        });
        transaction(suggestions);
        return this.list();
    }
    getByFindingId(findingId) {
        const row = database
            .prepare("SELECT * FROM analysis_suggestions WHERE finding_id = ?")
            .get(findingId);
        return row ? mapSuggestion(row) : null;
    }
    createForFinding(input) {
        const now = new Date().toISOString();
        database.prepare(`INSERT OR IGNORE INTO analysis_suggestions (
      id, finding_id, title, description, gap, wcag_criterion, wcag_level,
      accessibility_impact, recommended_remediation, developer_guidance,
      verification_steps, confidence, category, priority, source, status,
      created_at, updated_at
    ) VALUES (
      @id, @findingId, @title, @description, @gap, @wcagCriterion, @wcagLevel,
      @accessibilityImpact, @recommendedRemediation, @developerGuidance,
      @verificationSteps, @confidence, @category, @priority, @source, 'Pending',
      @createdAt, @updatedAt
    )`).run({
            ...input,
            wcagCriterion: input.wcagCriterion ?? null,
            wcagLevel: input.wcagLevel ?? null,
            accessibilityImpact: input.accessibilityImpact ?? null,
            recommendedRemediation: input.recommendedRemediation ?? null,
            developerGuidance: input.developerGuidance ?? null,
            verificationSteps: JSON.stringify(input.verificationSteps ?? []),
            confidence: input.confidence ?? null,
            createdAt: now,
            updatedAt: now,
        });
        return this.getByFindingId(input.findingId);
    }
    update(id, input) {
        const current = this.getById(id);
        if (!current)
            return null;
        const now = new Date().toISOString();
        const result = database
            .prepare(`UPDATE analysis_suggestions
      SET title = @title, description = @description, gap = @gap,
          wcag_criterion = @wcagCriterion, wcag_level = @wcagLevel,
          accessibility_impact = @accessibilityImpact,
          recommended_remediation = @recommendedRemediation,
          developer_guidance = @developerGuidance,
          verification_steps = @verificationSteps, confidence = @confidence,
          category = @category, priority = @priority, source = @source,
          updated_at = @updatedAt
      WHERE id = @id`)
            .run({
            ...current,
            ...input,
            wcagCriterion: input.wcagCriterion === undefined ? current.wcagCriterion : input.wcagCriterion,
            wcagLevel: input.wcagLevel === undefined ? current.wcagLevel : input.wcagLevel,
            accessibilityImpact: input.accessibilityImpact === undefined ? current.accessibilityImpact : input.accessibilityImpact,
            recommendedRemediation: input.recommendedRemediation === undefined ? current.recommendedRemediation : input.recommendedRemediation,
            developerGuidance: input.developerGuidance === undefined ? current.developerGuidance : input.developerGuidance,
            verificationSteps: JSON.stringify(input.verificationSteps === undefined ? current.verificationSteps : input.verificationSteps),
            confidence: input.confidence === undefined ? current.confidence : input.confidence,
            id,
            updatedAt: now,
        });
        return result.changes ? this.getById(id) : null;
    }
    updateStatus(id, status) {
        const result = database
            .prepare("UPDATE analysis_suggestions SET status = @status, updated_at = @updatedAt WHERE id = @id")
            .run({ id, status, updatedAt: new Date().toISOString() });
        return result.changes ? this.getById(id) : null;
    }
}
