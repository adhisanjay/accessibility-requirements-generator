import { z } from "zod";
import {
  suggestionCategories,
  suggestionPriorities,
  suggestionStatuses,
} from "../types/analysis.js";

export const analysisSuggestionInputSchema = z.object({
  id: z.string().trim().min(1).max(100),
  findingId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  gap: z.string().trim().min(1).max(5000),
  wcagCriterion: z.string().trim().max(20).nullable().optional(),
  wcagLevel: z.enum(["A", "AA", "AAA"]).nullable().optional(),
  accessibilityImpact: z.string().trim().max(5000).nullable().optional(),
  recommendedRemediation: z.string().trim().max(5000).nullable().optional(),
  developerGuidance: z.string().trim().max(5000).nullable().optional(),
  verificationSteps: z.array(z.string().trim().min(1).max(1000)).max(30).optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  category: z.enum(suggestionCategories),
  priority: z.enum(suggestionPriorities),
  source: z.string().trim().min(1).max(500),
  status: z.enum(suggestionStatuses).optional(),
});

export const accessibilityAnalysisOutputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  rootCause: z.string().trim().min(1).max(2000),
  wcagCriterion: z.string().trim().regex(/^\d\.\d\.\d{1,2}$/),
  wcagLevel: z.enum(["A", "AA", "AAA"]),
  accessibilityImpact: z.string().trim().min(1).max(2000),
  recommendedRemediation: z.string().trim().min(1).max(2000),
  developerGuidance: z.string().trim().min(1).max(2000),
  verificationSteps: z.array(z.string().trim().min(1).max(1000)).min(1).max(7),
  confidence: z.number().min(0).max(1),
}).strict();

export const accessibilityAnalysisStructuredSchema = z.object({
  title: z.string(),
  rootCause: z.string(),
  wcagCriterion: z.string(),
  wcagLevel: z.enum(["A", "AA", "AAA"]),
  accessibilityImpact: z.string(),
  recommendedRemediation: z.string(),
  developerGuidance: z.string(),
  verificationSteps: z.array(z.string()),
  confidence: z.number(),
}).strict();

export const analysisSuggestionStatusSchema = z.object({
  status: z.enum(suggestionStatuses),
});
