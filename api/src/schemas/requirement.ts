import { z } from "zod";
import {
  requirementPriorities,
  requirementStatuses,
} from "../types/requirement.js";

const textList = z.array(z.string().trim().min(1).max(500)).min(1).max(30);

export const requirementInputSchema = z.object({
  enhancementId: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  businessUserNeed: z.string().trim().min(1).max(5000),
  description: z.string().trim().min(1).max(5000),
  functionalRequirements: textList,
  accessibilityRequirements: textList,
  nonFunctionalRequirements: textList,
  acceptanceCriteria: textList,
  dependencies: textList,
  assumptions: textList,
  priority: z.enum(requirementPriorities),
  status: z.enum(requirementStatuses).optional(),
});

export const requirementStatusSchema = z.object({
  status: z.enum(requirementStatuses),
});

export const requirementGenerationSchema = z.object({
  enhancementId: z.string().trim().min(1).max(100),
});
