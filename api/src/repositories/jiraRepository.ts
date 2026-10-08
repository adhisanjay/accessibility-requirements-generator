import { database } from '../database/database.js';
import type { JiraEpic, JiraPackage, JiraPackageInput, JiraPackageStatus, JiraStory, JiraTask } from '../types/jira.js';

type PackageRow = { id: string; requirement_id: string; status: JiraPackageStatus; created_at: string; updated_at: string };
type EpicRow = { id: string; summary: string; description: string; priority: JiraEpic['priority'] };
type StoryRow = { id: string; summary: string; description: string; acceptance_criteria: string; priority: JiraStory['priority']; epic_id: string };
type TaskRow = { id: string; summary: string; description: string; priority: JiraTask['priority']; epic_id: string };

export class JiraRepository {
  list() {
    const rows = database.prepare('SELECT * FROM jira_packages ORDER BY created_at ASC').all() as PackageRow[];
    return rows.map((row) => this.getById(row.id)).filter((item): item is JiraPackage => item !== null);
  }

  getById(id: string) {
    const packageRow = database.prepare('SELECT * FROM jira_packages WHERE id = ?').get(id) as PackageRow | undefined;
    if (!packageRow) return null;
    const epic = database.prepare('SELECT id, summary, description, priority FROM jira_epics WHERE package_id = ?').get(id) as EpicRow;
    const story = database.prepare('SELECT id, summary, description, acceptance_criteria, priority, epic_id FROM jira_stories WHERE package_id = ?').get(id) as StoryRow;
    const tasks = database.prepare('SELECT id, summary, description, priority, epic_id FROM jira_tasks WHERE package_id = ? ORDER BY id ASC').all(id) as TaskRow[];
    const packageRecord: JiraPackage = {
      id: packageRow.id,
      requirementId: packageRow.requirement_id,
      status: packageRow.status,
      epic: { id: epic.id, summary: epic.summary, description: epic.description, priority: epic.priority },
      story: { id: story.id, summary: story.summary, description: story.description, acceptanceCriteria: JSON.parse(story.acceptance_criteria) as string[], priority: story.priority, epicId: story.epic_id },
      tasks: tasks.map((task) => ({ id: task.id, summary: task.summary, description: task.description, priority: task.priority, epicId: task.epic_id })),
      createdAt: packageRow.created_at,
      updatedAt: packageRow.updated_at,
    };
    return packageRecord;
  }

  getByRequirementId(requirementId: string) {
    const row = database.prepare('SELECT id FROM jira_packages WHERE requirement_id = ?').get(requirementId) as { id: string } | undefined;
    return row ? this.getById(row.id) : null;
  }

  create(input: JiraPackageInput) {
    const existing = this.getByRequirementId(input.requirementId);
    if (existing) return existing;
    const now = new Date().toISOString();
    const transaction = database.transaction(() => {
      database.prepare('INSERT INTO jira_packages (id, requirement_id, status, created_at, updated_at) VALUES (@id, @requirementId, @status, @createdAt, @updatedAt)').run({ id: input.id, requirementId: input.requirementId, status: input.status ?? 'Pending Review', createdAt: now, updatedAt: now });
      database.prepare('INSERT INTO jira_epics (id, package_id, summary, description, priority) VALUES (@id, @packageId, @summary, @description, @priority)').run({ ...input.epic, packageId: input.id });
      database.prepare('INSERT INTO jira_stories (id, package_id, epic_id, summary, description, acceptance_criteria, priority) VALUES (@id, @packageId, @epicId, @summary, @description, @acceptanceCriteria, @priority)').run({ ...input.story, packageId: input.id, acceptanceCriteria: JSON.stringify(input.story.acceptanceCriteria) });
      const taskInsert = database.prepare('INSERT INTO jira_tasks (id, package_id, epic_id, summary, description, priority) VALUES (@id, @packageId, @epicId, @summary, @description, @priority)');
      input.tasks.forEach((task) => taskInsert.run({ ...task, packageId: input.id }));
    });
    transaction();
    return this.getById(input.id);
  }

  update(id: string, input: JiraPackageInput) {
    const now = new Date().toISOString();
    const transaction = database.transaction(() => {
      const packageResult = database.prepare("UPDATE jira_packages SET updated_at = @updatedAt, status = 'Pending Review' WHERE id = @id").run({ id, updatedAt: now });
      if (!packageResult.changes) return false;
      database.prepare('UPDATE jira_epics SET summary = @summary, description = @description, priority = @priority WHERE package_id = @packageId').run({ ...input.epic, packageId: id });
      database.prepare('UPDATE jira_stories SET summary = @summary, description = @description, acceptance_criteria = @acceptanceCriteria, priority = @priority WHERE package_id = @packageId').run({ ...input.story, packageId: id, acceptanceCriteria: JSON.stringify(input.story.acceptanceCriteria) });
      database.prepare('DELETE FROM jira_tasks WHERE package_id = ?').run(id);
      const taskInsert = database.prepare('INSERT INTO jira_tasks (id, package_id, epic_id, summary, description, priority) VALUES (@id, @packageId, @epicId, @summary, @description, @priority)');
      input.tasks.forEach((task) => taskInsert.run({ ...task, packageId: id }));
      return true;
    });
    return transaction() ? this.getById(id) : null;
  }

  updateStatus(id: string, status: JiraPackageStatus) {
    const result = database.prepare('UPDATE jira_packages SET status = @status, updated_at = @updatedAt WHERE id = @id').run({ id, status, updatedAt: new Date().toISOString() });
    return result.changes ? this.getById(id) : null;
  }
}
