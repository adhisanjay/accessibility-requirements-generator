export const jiraPriorities = ['High', 'Medium', 'Low'] as const;
export const jiraPackageStatuses = ['Pending Review', 'Approved', 'Rejected'] as const;

export type JiraPriority = (typeof jiraPriorities)[number];
export type JiraPackageStatus = (typeof jiraPackageStatuses)[number];

export interface JiraEpic {
  id: string;
  summary: string;
  description: string;
  priority: JiraPriority;
}

export interface JiraStory {
  id: string;
  summary: string;
  description: string;
  acceptanceCriteria: string[];
  priority: JiraPriority;
  epicId: string;
}

export interface JiraTask {
  id: string;
  summary: string;
  description: string;
  priority: JiraPriority;
  epicId: string;
}

export interface JiraPackage {
  id: string;
  requirementId: string;
  status: JiraPackageStatus;
  epic: JiraEpic;
  story: JiraStory;
  tasks: JiraTask[];
  createdAt: string;
  updatedAt: string;
}

export type JiraPackageInput = Omit<JiraPackage, 'createdAt' | 'updatedAt'>;
