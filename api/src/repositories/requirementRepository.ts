import { database } from "../database/database.js";
import type {
  Requirement,
  RequirementInput,
  RequirementStatus,
} from "../types/requirement.js";

type RequirementRow = Omit<
  Requirement,
  | "enhancementId"
  | "businessUserNeed"
  | "functionalRequirements"
  | "accessibilityRequirements"
  | "nonFunctionalRequirements"
  | "acceptanceCriteria"
  | "dependencies"
  | "assumptions"
  | "createdAt"
  | "updatedAt"
> & {
  enhancement_id: string;
  business_user_need: string;
  functional_requirements: string;
  accessibility_requirements: string;
  non_functional_requirements: string;
  acceptance_criteria: string;
  dependencies: string;
  assumptions: string;
  created_at: string;
  updated_at: string;
};

const mapRequirement = (row: RequirementRow): Requirement => ({
  id: row.id,
  enhancementId: row.enhancement_id,
  title: row.title,
  businessUserNeed: row.business_user_need,
  description: row.description,
  functionalRequirements: JSON.parse(row.functional_requirements) as string[],
  accessibilityRequirements: JSON.parse(
    row.accessibility_requirements,
  ) as string[],
  nonFunctionalRequirements: JSON.parse(
    row.non_functional_requirements,
  ) as string[],
  acceptanceCriteria: JSON.parse(row.acceptance_criteria) as string[],
  dependencies: JSON.parse(row.dependencies) as string[],
  assumptions: JSON.parse(row.assumptions) as string[],
  priority: row.priority,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class RequirementRepository {
  list() {
    const rows = database
      .prepare("SELECT * FROM requirements ORDER BY created_at ASC")
      .all() as RequirementRow[];
    return rows.map(mapRequirement);
  }

  getById(id: string) {
    const row = database
      .prepare("SELECT * FROM requirements WHERE id = ?")
      .get(id) as RequirementRow | undefined;
    return row ? mapRequirement(row) : null;
  }

  getByEnhancementId(enhancementId: string) {
    const row = database
      .prepare("SELECT * FROM requirements WHERE enhancement_id = ?")
      .get(enhancementId) as RequirementRow | undefined;
    return row ? mapRequirement(row) : null;
  }

  create(input: RequirementInput) {
    const existing = this.getByEnhancementId(input.enhancementId);
    if (existing) return existing;
    const now = new Date().toISOString();
    database
      .prepare(
        `INSERT INTO requirements (id, enhancement_id, title, business_user_need, description, functional_requirements, accessibility_requirements, non_functional_requirements, acceptance_criteria, dependencies, assumptions, priority, status, created_at, updated_at)
      VALUES (@id, @enhancementId, @title, @businessUserNeed, @description, @functionalRequirements, @accessibilityRequirements, @nonFunctionalRequirements, @acceptanceCriteria, @dependencies, @assumptions, @priority, @status, @createdAt, @updatedAt)`,
      )
      .run({
        ...input,
        functionalRequirements: JSON.stringify(input.functionalRequirements),
        accessibilityRequirements: JSON.stringify(
          input.accessibilityRequirements,
        ),
        nonFunctionalRequirements: JSON.stringify(
          input.nonFunctionalRequirements,
        ),
        acceptanceCriteria: JSON.stringify(input.acceptanceCriteria),
        dependencies: JSON.stringify(input.dependencies),
        assumptions: JSON.stringify(input.assumptions),
        status: input.status ?? "Pending Review",
        createdAt: now,
        updatedAt: now,
      });
    return this.getById(input.id);
  }

  update(id: string, input: RequirementInput) {
    const now = new Date().toISOString();
    const result = database
      .prepare(
        `UPDATE requirements SET title = @title, business_user_need = @businessUserNeed, description = @description, functional_requirements = @functionalRequirements, accessibility_requirements = @accessibilityRequirements, non_functional_requirements = @nonFunctionalRequirements, acceptance_criteria = @acceptanceCriteria, dependencies = @dependencies, assumptions = @assumptions, priority = @priority, status = 'Pending Review', updated_at = @updatedAt WHERE id = @id`,
      )
      .run({
        ...input,
        id,
        functionalRequirements: JSON.stringify(input.functionalRequirements),
        accessibilityRequirements: JSON.stringify(
          input.accessibilityRequirements,
        ),
        nonFunctionalRequirements: JSON.stringify(
          input.nonFunctionalRequirements,
        ),
        acceptanceCriteria: JSON.stringify(input.acceptanceCriteria),
        dependencies: JSON.stringify(input.dependencies),
        assumptions: JSON.stringify(input.assumptions),
        updatedAt: now,
      });
    return result.changes ? this.getById(id) : null;
  }

  updateStatus(id: string, status: RequirementStatus) {
    const result = database
      .prepare(
        "UPDATE requirements SET status = @status, updated_at = @updatedAt WHERE id = @id",
      )
      .run({ id, status, updatedAt: new Date().toISOString() });
    return result.changes ? this.getById(id) : null;
  }
}
