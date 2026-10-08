import { Router } from "express";
import { scanResultSelectionSchema, startScanSchema } from "../schemas/scan.js";
import { ScanService } from "../services/scanService.js";
import { UnsafeScanTargetError } from "../services/scanTarget.js";

const positiveId = (value: string) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export function createScanRouter(service = new ScanService()) {
  const router = Router();

  router.post("/", async (request, response) => {
    const input = startScanSchema.safeParse(request.body);
    if (!input.success) {
      return response.status(400).json({
        error: "Invalid scan request",
        details: input.error.flatten(),
      });
    }

    try {
      const scan = await service.startScan(input.data.url);
      return response.status(202).json({ scan });
    } catch (error) {
      if (error instanceof UnsafeScanTargetError) {
        return response.status(400).json({ error: error.message });
      }
      return response.status(500).json({ error: "Unable to start the scan." });
    }
  });

  router.get("/:scanId/results", (request, response) => {
    const scanId = positiveId(request.params.scanId);
    if (!scanId) return response.status(400).json({ error: "Invalid scan ID" });
    const results = service.getResults(scanId);
    return results ? response.json(results) : response.status(404).json({ error: "Scan not found" });
  });

  router.patch("/:scanId/results/:resultId", (request, response) => {
    const scanId = positiveId(request.params.scanId);
    const resultId = positiveId(request.params.resultId);
    const input = scanResultSelectionSchema.safeParse(request.body);
    if (!scanId || !resultId || !input.success) {
      return response.status(400).json({ error: "Invalid result review request" });
    }
    const result = service.selectResult(scanId, resultId, input.data.selected);
    return result
      ? response.json({ item: result })
      : response.status(404).json({ error: "Scan result not found or cannot be changed" });
  });

  router.post("/:scanId/import", (request, response) => {
    const scanId = positiveId(request.params.scanId);
    if (!scanId) return response.status(400).json({ error: "Invalid scan ID" });
    const result = service.importSelected(scanId);
    return result ? response.json(result) : response.status(404).json({ error: "Completed scan not found" });
  });

  router.get("/:scanId", (request, response) => {
    const scanId = positiveId(request.params.scanId);
    if (!scanId) return response.status(400).json({ error: "Invalid scan ID" });
    const scan = service.getScan(scanId);
    return scan ? response.json({ scan }) : response.status(404).json({ error: "Scan not found" });
  });

  return router;
}

export const scanRouter = createScanRouter();