import { z } from "zod";
export const startScanSchema = z.object({
    url: z.string().trim().min(1).max(2048),
});
export const scanResultSelectionSchema = z.object({
    selected: z.boolean(),
});
