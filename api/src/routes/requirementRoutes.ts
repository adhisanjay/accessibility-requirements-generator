import { Router } from "express";
import { AnalysisRepository } from "../repositories/analysisRepository.js";
import { RequirementRepository } from "../repositories/requirementRepository.js";
import {
  requirementGenerationSchema,
  requirementInputSchema,
  requirementStatusSchema,
} from "../schemas/requirement.js";
import { mockRequirementGenerationService } from "../services/requirementService.js";

const analysisRepository = new AnalysisRepository();
const repository = new RequirementRepository();
export const requirementRouter = Router();

requirementRouter.get("/", (_request, response) =>
  response.json({ items: repository.list() }),
);

requirementRouter.post("/", (request, response) => {
  const input = requirementGenerationSchema.safeParse(request.body);
  if (!input.success)
    return response.status(400).json({
      error: "Invalid requirement generation request",
      details: input.error.flatten(),
    });
  const enhancement = analysisRepository.getById(input.data.enhancementId);
  if (!enhancement)
    return response.status(404).json({ error: "Enhancement not found" });
  if (enhancement.status !== "Approved")
    return response
      .status(409)
      .json({ error: "Only approved enhancements can generate requirements" });
  return response
    .status(201)
    .json(
      repository.create(mockRequirementGenerationService.generate(enhancement)),
    );
});

requirementRouter.put("/:id", (request, response) => {
  const input = requirementInputSchema.safeParse({
    ...request.body,
    id: request.params.id,
  });
  if (!input.success)
    return response.status(400).json({
      error: "Invalid requirement data",
      details: input.error.flatten(),
    });
  const requirement = repository.update(request.params.id, {
    ...input.data,
    id: request.params.id,
    status: input.data.status ?? "Pending Review",
  });
  return requirement
    ? response.json(requirement)
    : response.status(404).json({ error: "Requirement not found" });
});

requirementRouter.patch("/:id/status", (request, response) => {
  const input = requirementStatusSchema.safeParse(request.body);
  if (!input.success)
    return response.status(400).json({
      error: "Invalid requirement status",
      details: input.error.flatten(),
    });
  const requirement = repository.updateStatus(
    request.params.id,
    input.data.status,
  );
  return requirement
    ? response.json(requirement)
    : response.status(404).json({ error: "Requirement not found" });
});
