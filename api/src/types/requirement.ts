export const requirementPriorities = ["High", "Medium", "Low"] as const;
export const requirementStatuses = [
  "Pending Review",
  "Approved",
  "Rejected",
] as const;

export type RequirementPriority = (typeof requirementPriorities)[number];
export type RequirementStatus = (typeof requirementStatuses)[number];

export interface Requirement {
  id: string;
  enhancementId: string;
  title: string;
  businessUserNeed: string;
  description: string;
  functionalRequirements: string[];
  accessibilityRequirements: string[];
  nonFunctionalRequirements: string[];
  acceptanceCriteria: string[];
  dependencies: string[];
  assumptions: string[];
  priority: RequirementPriority;
  status: RequirementStatus;
  createdAt: string;
  updatedAt: string;
}

export type RequirementInput = Omit<Requirement, "createdAt" | "updatedAt">;
