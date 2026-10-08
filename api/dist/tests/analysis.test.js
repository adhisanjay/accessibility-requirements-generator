import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisRepository } from "../src/repositories/analysisRepository.js";
import { IssueRepository } from "../src/repositories/issueRepository.js";
import { createAnalysisRouter } from "../src/routes/analysisRoutes.js";
import { requirementRouter } from "../src/routes/requirementRoutes.js";
import { AccessibilityAnalysisService } from "../src/services/analysisOrchestrator.js";
import { mockAccessibilityAnalysisProvider } from "../src/services/mockAnalysisProvider.js";
import { OpenAIAnalysisProvider } from "../src/services/openAIAnalysisProvider.js";
import { classifyProviderError } from "../src/services/analysisProviderDiagnostics.js";
import { database } from "../src/database/database.js";
const validOutput = {
    title: "Improve text contrast",
    rootCause: "The foreground color is too close to the background color.",
    wcagCriterion: "1.4.3",
    wcagLevel: "AA",
    accessibilityImpact: "Users with low vision may not be able to read the text.",
    recommendedRemediation: "Adjust the foreground and background colors to meet contrast requirements.",
    developerGuidance: "Use design tokens with verified contrast pairs and test every state.",
    verificationSteps: [
        "Measure text contrast against the WCAG 2.2 AA threshold.",
        "Verify default, hover, focus, and disabled states.",
    ],
    confidence: 0.91,
};
const issueInput = (title = "Low contrast button") => ({
    title,
    description: "The button text is difficult to read against its background.",
    wcagCriterion: "WCAG 1.4.3",
    severity: "high",
    status: "open",
    recommendation: "Increase text contrast.",
});
function seedIssue(title) {
    const issue = new IssueRepository().create(issueInput(title));
    if (!issue)
        throw new Error("Unable to seed test issue.");
    return issue;
}
function serviceFor(analyzeFinding, timeoutMs = 100) {
    const provider = {
        name: "test-provider",
        analyzeFinding,
    };
    return new AccessibilityAnalysisService({ provider, timeoutMs });
}
describe("accessibility analysis providers and workflow", () => {
    beforeEach(() => {
        database.exec("DELETE FROM jira_tasks; DELETE FROM jira_stories; DELETE FROM jira_epics; DELETE FROM jira_packages; DELETE FROM requirements; DELETE FROM analysis_suggestions; DELETE FROM scan_results; DELETE FROM scans; DELETE FROM accessibility_issues");
    });
    it("provides deterministic mock analysis without a network call", async () => {
        const issue = seedIssue();
        const output = await mockAccessibilityAnalysisProvider.analyzeFinding(issue);
        expect(output).toMatchObject({
            wcagCriterion: "1.4.3",
            wcagLevel: "AA",
            confidence: expect.any(Number),
        });
        const longIssue = new IssueRepository().create({
            ...issueInput("Long finding"),
            description: "d".repeat(5000),
            recommendation: "r".repeat(5000),
        });
        if (!longIssue)
            throw new Error("Unable to seed long test issue.");
        await expect(mockAccessibilityAnalysisProvider.analyzeFinding(longIssue)).resolves.toMatchObject({
            rootCause: expect.any(String),
            recommendedRemediation: expect.any(String),
        });
    });
    it("uses the OpenAI Responses API structured Zod format", async () => {
        const parse = vi.fn(async () => ({ output_parsed: validOutput }));
        const fakeClient = { responses: { parse } };
        const provider = new OpenAIAnalysisProvider({
            apiKey: "test-key-not-used-for-network",
            model: "test-model",
            timeoutMs: 100,
            client: fakeClient,
        });
        const output = await provider.analyzeFinding(seedIssue());
        expect(output).toEqual(validOutput);
        expect(parse).toHaveBeenCalledWith(expect.objectContaining({
            model: "test-model",
            text: { format: expect.objectContaining({ type: "json_schema" }) },
        }));
    });
    it("does not persist malformed provider output", async () => {
        seedIssue();
        const result = await serviceFor(async () => ({ title: "Incomplete" })).analyzePersistedFindings();
        expect(result.failedCount).toBe(1);
        expect(result.items).toHaveLength(0);
    });
    it("rejects WCAG criteria outside the local WCAG 2.2 reference", async () => {
        seedIssue();
        const result = await serviceFor(async () => ({ ...validOutput, wcagCriterion: "9.9.9" }))
            .analyzePersistedFindings();
        expect(result.outcomes[0].error).toContain("WCAG criterion");
        expect(result.items).toHaveLength(0);
    });
    it("rejects a criterion whose level does not match WCAG 2.2", async () => {
        seedIssue();
        const result = await serviceFor(async () => ({ ...validOutput, wcagLevel: "A" }))
            .analyzePersistedFindings();
        expect(result.outcomes[0].status).toBe("failed");
        expect(result.items).toHaveLength(0);
    });
    it("rejects confidence outside the allowed range", async () => {
        seedIssue();
        const result = await serviceFor(async () => ({ ...validOutput, confidence: 1.01 }))
            .analyzePersistedFindings();
        expect(result.outcomes[0].status).toBe("failed");
        expect(result.items).toHaveLength(0);
    });
    it("records a safe timeout outcome", async () => {
        seedIssue();
        const never = new Promise(() => { });
        const result = await serviceFor(async () => never, 5).analyzePersistedFindings();
        expect(result.outcomes[0].error).toContain("timed out");
    });
    it("records provider failures without exposing provider messages", async () => {
        seedIssue();
        const result = await serviceFor(async () => {
            throw new Error("Authorization failed for secret-provider-response");
        }).analyzePersistedFindings();
        expect(result.outcomes[0]).toMatchObject({
            status: "failed",
            error: "The analysis provider could not analyze this finding.",
        });
    });
    it("classifies provider errors and excludes secrets from development diagnostics", async () => {
        const fakeSecret = "sk-proj-diagnostic-test-secret-never-log";
        const authenticationError = Object.assign(new Error(`Invalid API key ${fakeSecret}`), {
            status: 401,
            type: "authentication_error",
            code: "invalid_api_key",
            request_id: "req_diagnostic_123",
            headers: {
                authorization: `Bearer ${fakeSecret}`,
                "x-request-id": "req_diagnostic_123",
            },
        });
        const authenticationDiagnostic = classifyProviderError(authenticationError);
        expect(authenticationDiagnostic).toMatchObject({
            category: "authentication",
            statusCode: 401,
            openaiErrorType: "authentication_error",
            openaiErrorCode: "invalid_api_key",
            requestId: "req_diagnostic_123",
        });
        expect(JSON.stringify(authenticationDiagnostic)).not.toContain(fakeSecret);
        const secretMetadata = classifyProviderError(Object.assign(new Error("Provider error"), {
            status: 401,
            type: fakeSecret,
            code: fakeSecret,
            request_id: fakeSecret,
        }));
        expect(secretMetadata.openaiErrorType).toBeNull();
        expect(secretMetadata.openaiErrorCode).toBeNull();
        expect(secretMetadata.requestId).toBeNull();
        expect(JSON.stringify(secretMetadata)).not.toContain(fakeSecret);
        const classifiedErrors = [
            [Object.assign(new Error("Request timed out"), { name: "APIConnectionTimeoutError" }), "timeout"],
            [Object.assign(new Error("Quota exceeded"), { status: 429, code: "insufficient_quota" }), "quota"],
            [Object.assign(new Error("Slow down"), { status: 429, code: "rate_limit_exceeded" }), "rate_limit"],
            [Object.assign(new Error("Model was not found"), { status: 404, code: "model_not_found" }), "model_unavailable"],
            [Object.assign(new Error("Invalid structured schema"), { status: 400, type: "invalid_request_error" }), "invalid_request"],
            [Object.assign(new Error("Socket reset"), { name: "APIConnectionError", code: "ECONNRESET" }), "network"],
        ];
        for (const [error, category] of classifiedErrors) {
            expect(classifyProviderError(error).category).toBe(category);
        }
        seedIssue();
        const warning = vi.spyOn(console, "warn").mockImplementation(() => { });
        const originalEnvironment = process.env.NODE_ENV;
        process.env.NODE_ENV = "test";
        try {
            const result = await serviceFor(async () => {
                throw authenticationError;
            }).analyzePersistedFindings();
            expect(result.outcomes[0].error).toBe("The analysis provider could not analyze this finding.");
            expect(warning).toHaveBeenCalledOnce();
            const loggedDiagnostics = warning.mock.calls.flat().join(" ");
            expect(loggedDiagnostics).toContain('"category":"authentication"');
            expect(loggedDiagnostics).not.toContain(fakeSecret);
            expect(loggedDiagnostics).not.toContain("authorization");
        }
        finally {
            warning.mockRestore();
            if (originalEnvironment === undefined)
                delete process.env.NODE_ENV;
            else
                process.env.NODE_ENV = originalEnvironment;
        }
    });
    it("keeps successful results when another finding fails", async () => {
        seedIssue("Successful finding");
        seedIssue("Provider failure finding");
        const result = await serviceFor(async (issue) => {
            if (issue.title === "Provider failure finding")
                throw new Error("private error");
            return validOutput;
        }).analyzePersistedFindings();
        expect(result.generatedCount).toBe(1);
        expect(result.failedCount).toBe(1);
        expect(result.items).toHaveLength(1);
    });
    it("does not overwrite an approved analysis on repeat analysis", async () => {
        const issue = seedIssue();
        const analysisService = serviceFor(async () => validOutput);
        await analysisService.analyzePersistedFindings();
        const repository = new AnalysisRepository();
        const existing = repository.getByFindingId(issue.id);
        if (!existing)
            throw new Error("Expected persisted analysis.");
        repository.updateStatus(existing.id, "Approved");
        const repeated = await serviceFor(async () => {
            throw new Error("Provider should not be called for existing analysis.");
        }).analyzePersistedFindings();
        expect(repeated.outcomes[0].status).toBe("existing");
        expect(repository.getByFindingId(issue.id)?.status).toBe("Approved");
    });
    it("does not overwrite edited analysis on repeat analysis", async () => {
        const issue = seedIssue();
        await serviceFor(async () => validOutput).analyzePersistedFindings();
        const repository = new AnalysisRepository();
        const existing = repository.getByFindingId(issue.id);
        if (!existing)
            throw new Error("Expected persisted analysis.");
        repository.update(existing.id, {
            ...existing,
            title: "Reviewer-edited title",
            gap: "Reviewer-edited root cause",
        });
        await serviceFor(async () => validOutput).analyzePersistedFindings();
        expect(repository.getByFindingId(issue.id)).toMatchObject({
            title: "Reviewer-edited title",
            gap: "Reviewer-edited root cause",
        });
    });
    it("preserves extended fields when a legacy edit payload omits them", async () => {
        const issue = seedIssue();
        await serviceFor(async () => validOutput).analyzePersistedFindings();
        const repository = new AnalysisRepository();
        const existing = repository.getByFindingId(issue.id);
        if (!existing)
            throw new Error("Expected persisted analysis.");
        repository.update(existing.id, {
            id: existing.id,
            title: "Legacy client edit",
            description: existing.description,
            gap: existing.gap,
            category: existing.category,
            priority: existing.priority,
            source: existing.source,
        });
        expect(repository.getByFindingId(issue.id)).toMatchObject({
            title: "Legacy client edit",
            wcagCriterion: validOutput.wcagCriterion,
            verificationSteps: validOutput.verificationSteps,
        });
    });
    it("keeps requirement generation gated by human approval and includes WCAG guidance", async () => {
        const issue = seedIssue();
        await serviceFor(async () => validOutput).analyzePersistedFindings();
        const analysis = new AnalysisRepository().getByFindingId(issue.id);
        if (!analysis)
            throw new Error("Expected persisted analysis.");
        const app = express();
        app.use(express.json());
        app.use("/api/requirements", requirementRouter);
        const blocked = await request(app)
            .post("/api/requirements")
            .send({ enhancementId: analysis.id });
        expect(blocked.status).toBe(409);
        new AnalysisRepository().updateStatus(analysis.id, "Approved");
        const generated = await request(app)
            .post("/api/requirements")
            .send({ enhancementId: analysis.id });
        expect(generated.status).toBe(201);
        expect(generated.body.accessibilityRequirements.join(" ")).toContain("1.4.3");
        expect(generated.body.accessibilityRequirements.join(" ")).toContain("Recommended remediation");
        expect(generated.body.accessibilityRequirements.join(" ")).toContain("Developer guidance");
        expect(generated.body.acceptanceCriteria).toContain(validOutput.verificationSteps[0]);
        expect(generated.body.status).toBe("Pending Review");
    });
    it("never returns the configured API key in analysis responses", async () => {
        const secret = "sk-proj-test-secret-value-never-returned";
        const issue = seedIssue();
        const analyze = vi.fn(async () => validOutput);
        const service = serviceFor(analyze);
        const app = express();
        app.use(express.json());
        app.use("/api/analysis", createAnalysisRouter(service));
        const originalApiKey = process.env.AI_API_KEY;
        process.env.AI_API_KEY = secret;
        try {
            const response = await request(app).post("/api/analysis/suggestions").send({
                issueCount: 999,
                openIssueCount: 999,
                findings: [{ ...issue, title: "untrusted client issue" }],
            });
            expect(response.status).toBe(201);
            expect(JSON.stringify(response.body)).not.toContain(secret);
            expect(analyze).toHaveBeenCalledWith(expect.objectContaining({
                id: issue.id,
                title: issue.title,
            }));
            expect(response.body.items[0].title).toBe(validOutput.title);
            expect(response.body.items[0].status).toBe("Pending");
            expect(response.body.items[0].findingId).toBe(issue.id);
        }
        finally {
            if (originalApiKey === undefined)
                delete process.env.AI_API_KEY;
            else
                process.env.AI_API_KEY = originalApiKey;
        }
    });
});
