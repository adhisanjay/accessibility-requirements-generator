import { database } from "../database/database.js";
const mapRequirement = (row) => ({
    id: row.id,
    enhancementId: row.enhancement_id,
    title: row.title,
    businessUserNeed: row.business_user_need,
    description: row.description,
    functionalRequirements: JSON.parse(row.functional_requirements),
    accessibilityRequirements: JSON.parse(row.accessibility_requirements),
    nonFunctionalRequirements: JSON.parse(row.non_functional_requirements),
    acceptanceCriteria: JSON.parse(row.acceptance_criteria),
    dependencies: JSON.parse(row.dependencies),
    assumptions: JSON.parse(row.assumptions),
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});
export class RequirementRepository {
    list() {
        const rows = database
            .prepare("SELECT * FROM requirements ORDER BY created_at ASC")
            .all();
        return rows.map(mapRequirement);
    }
    getById(id) {
        const row = database
            .prepare("SELECT * FROM requirements WHERE id = ?")
            .get(id);
        return row ? mapRequirement(row) : null;
    }
    getByEnhancementId(enhancementId) {
        const row = database
            .prepare("SELECT * FROM requirements WHERE enhancement_id = ?")
            .get(enhancementId);
        return row ? mapRequirement(row) : null;
    }
    create(input) {
        const existing = this.getByEnhancementId(input.enhancementId);
        if (existing)
            return existing;
        const now = new Date().toISOString();
        database
            .prepare(`INSERT INTO requirements (id, enhancement_id, title, business_user_need, description, functional_requirements, accessibility_requirements, non_functional_requirements, acceptance_criteria, dependencies, assumptions, priority, status, created_at, updated_at)
      VALUES (@id, @enhancementId, @title, @businessUserNeed, @description, @functionalRequirements, @accessibilityRequirements, @nonFunctionalRequirements, @acceptanceCriteria, @dependencies, @assumptions, @priority, @status, @createdAt, @updatedAt)`)
            .run({
            ...input,
            functionalRequirements: JSON.stringify(input.functionalRequirements),
            accessibilityRequirements: JSON.stringify(input.accessibilityRequirements),
            nonFunctionalRequirements: JSON.stringify(input.nonFunctionalRequirements),
            acceptanceCriteria: JSON.stringify(input.acceptanceCriteria),
            dependencies: JSON.stringify(input.dependencies),
            assumptions: JSON.stringify(input.assumptions),
            status: input.status ?? "Pending Review",
            createdAt: now,
            updatedAt: now,
        });
        return this.getById(input.id);
    }
    update(id, input) {
        const now = new Date().toISOString();
        const result = database
            .prepare(`UPDATE requirements SET title = @title, business_user_need = @businessUserNeed, description = @description, functional_requirements = @functionalRequirements, accessibility_requirements = @accessibilityRequirements, non_functional_requirements = @nonFunctionalRequirements, acceptance_criteria = @acceptanceCriteria, dependencies = @dependencies, assumptions = @assumptions, priority = @priority, status = 'Pending Review', updated_at = @updatedAt WHERE id = @id`)
            .run({
            ...input,
            id,
            functionalRequirements: JSON.stringify(input.functionalRequirements),
            accessibilityRequirements: JSON.stringify(input.accessibilityRequirements),
            nonFunctionalRequirements: JSON.stringify(input.nonFunctionalRequirements),
            acceptanceCriteria: JSON.stringify(input.acceptanceCriteria),
            dependencies: JSON.stringify(input.dependencies),
            assumptions: JSON.stringify(input.assumptions),
            updatedAt: now,
        });
        return result.changes ? this.getById(id) : null;
    }
    updateStatus(id, status) {
        const result = database
            .prepare("UPDATE requirements SET status = @status, updated_at = @updatedAt WHERE id = @id")
            .run({ id, status, updatedAt: new Date().toISOString() });
        return result.changes ? this.getById(id) : null;
    }
}
