import { z } from 'zod';
import { severities, statuses } from '../types/issue.js';
export const issueInputSchema = z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(5000),
    wcagCriterion: z.string().trim().min(1).max(100),
    severity: z.enum(severities),
    status: z.enum(statuses),
    recommendation: z.string().trim().min(1).max(5000),
    source: z.enum(['manual', 'axe']).optional(),
    axeRuleId: z.string().nullable().optional(),
    pageUrl: z.string().url().nullable().optional(),
});
export const issueQuerySchema = z.object({
    search: z.string().trim().optional(),
    severity: z.enum(severities).optional(),
    status: z.enum(statuses).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
