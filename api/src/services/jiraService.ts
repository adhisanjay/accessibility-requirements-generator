import type { Requirement } from '../types/requirement.js';
import type { JiraPackageInput, JiraTask } from '../types/jira.js';

export interface JiraGenerationService {
  generate(requirement: Requirement): JiraPackageInput;
}

export const mockJiraService: JiraGenerationService = {
  generate(requirement) {
    const packageId = `${requirement.id}-jira`;
    const epicId = `${packageId}-epic`;
    const storyId = `${packageId}-story`;
    const taskIdeas = requirement.functionalRequirements.slice(0, 5).map((item, index) => ({
      summary: item.replace(/^The system must /i, '').replace(/\.$/, ''),
      description: `Implement and verify this part of the approved requirement: ${item}`,
      priority: requirement.priority,
      index,
    }));
    while (taskIdeas.length < 3) {
      taskIdeas.push({
        summary: ['Add implementation tests', 'Document the workflow', 'Verify accessibility behavior'][taskIdeas.length - 0] ?? 'Complete implementation',
        description: `Complete the ${requirement.title} delivery and confirm it meets the approved acceptance criteria.`,
        priority: requirement.priority,
        index: taskIdeas.length,
      });
    }
    const tasks: JiraTask[] = taskIdeas.slice(0, 6).map((task, index) => ({
      id: `${packageId}-task-${index + 1}`,
      summary: task.summary,
      description: task.description,
      priority: task.priority,
      epicId,
    }));

    return {
      id: packageId,
      requirementId: requirement.id,
      status: 'Pending Review',
      epic: {
        id: epicId,
        summary: requirement.title,
        description: `Deliver the approved requirement: ${requirement.title}. ${requirement.description}`,
        priority: requirement.priority,
      },
      story: {
        id: storyId,
        summary: requirement.businessUserNeed,
        description: requirement.description,
        acceptanceCriteria: requirement.acceptanceCriteria,
        priority: requirement.priority,
        epicId,
      },
      tasks,
    };
  },
};
