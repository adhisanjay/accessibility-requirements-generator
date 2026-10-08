import { Router } from "express";
import { AnalysisRepository } from "../repositories/analysisRepository.js";
import { analysisSuggestionInputSchema, analysisSuggestionStatusSchema } from "../schemas/analysis.js";
import { createAnalysisProvider } from "../services/createAnalysisProvider.js";
import { AccessibilityAnalysisService } from "../services/analysisOrchestrator.js";
import { readAnalysisConfig } from "../services/analysisConfig.js";

const repository = new AnalysisRepository();
const configuration = readAnalysisConfig();
const analysisService = new AccessibilityAnalysisService({
  provider: createAnalysisProvider(configuration),
  analysisRepository: repository,
  timeoutMs: configuration.timeoutMs,
});

export function createAnalysisRouter(service = analysisService) {
  const router = Router();

  router.get("/suggestions", (_request, response) =>
  response.json({ items: repository.list() }),
  );

  router.post("/suggestions", async (_request, response) => {
    try {
      const result = await service.analyzePersistedFindings();
      return response.status(201).json(result);
    } catch {
      return response.status(500).json({ error: "Analysis could not be completed." });
    }
  });

  router.put("/suggestions/:id", (request, response) => {
  const input = analysisSuggestionInputSchema.safeParse({
    ...request.body,
    id: request.params.id,
  });
  if (!input.success)
    return response
      .status(400)
      .json({
        error: "Invalid analysis suggestion data",
        details: input.error.flatten(),
      });
  const suggestion = repository.update(request.params.id, input.data);
  return suggestion
    ? response.json(suggestion)
    : response.status(404).json({ error: "Analysis suggestion not found" });
  });

  router.patch("/suggestions/:id/status", (request, response) => {
  const input = analysisSuggestionStatusSchema.safeParse(request.body);
  if (!input.success)
    return response
      .status(400)
      .json({ error: "Invalid review status", details: input.error.flatten() });
  const suggestion = repository.updateStatus(
    request.params.id,
    input.data.status,
  );
  return suggestion
    ? response.json(suggestion)
    : response.status(404).json({ error: "Analysis suggestion not found" });
  });

  return router;
}

export const analysisRouter = createAnalysisRouter();
