import { z } from 'zod';
import { jiraPackageStatuses, jiraPriorities } from '../types/jira.js';

const priority = z.enum(jiraPriorities);
const textList = z.array(z.string().trim().min(1).max(1000)).min(1).max(30);

const epicSchema = z.object({
  id: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(5000),
  priority,
});

const storySchema = z.object({
  id: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(5000),
  acceptanceCriteria: textList,
  priority,
  epicId: z.string().trim().min(1).max(120),
});

const taskSchema = z.object({
  id: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(5000),
  priority,
  epicId: z.string().trim().min(1).max(120),
});

export const jiraPackageInputSchema = z.object({
  id: z.string().trim().min(1).max(120),
  requirementId: z.string().trim().min(1).max(120),
  status: z.enum(jiraPackageStatuses).optional(),
  epic: epicSchema,
  story: storySchema,
  tasks: z.array(taskSchema).min(3).max(6),
});

export const jiraPackageGenerationSchema = z.object({
  requirementId: z.string().trim().min(1).max(120),
});

export const jiraPackageStatusSchema = z.object({
  status: z.enum(jiraPackageStatuses),
});
