import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRouter } from "../src/routes/issueRoutes.js";
import { createScanRouter } from "../src/routes/scanRoutes.js";
import { database } from "../src/database/database.js";
import { ScanService } from "../src/services/scanService.js";
const axeResult = {
    ruleId: "color-contrast",
    impact: "serious",
    description: "Elements must have sufficient color contrast.",
    helpText: "Ensure the contrast ratio is sufficient.",
    helpUrl: "https://dequeuniversity.com/rules/axe/4.10/color-contrast",
    htmlSnippets: ['<button id="continue">Continue</button>'],
    targets: ["#continue"],
    wcagTags: ["wcag143", "wcag21aa"],
};
const publicResolver = async () => [
    { address: "93.184.216.34", family: 4 },
];
function createTestApp(executor = async () => [axeResult], resolveHostname = publicResolver) {
    const app = express();
    app.use(express.json());
    app.use("/api/scans", createScanRouter(new ScanService({
        executor,
        resolveHostname,
        allowedHosts: ["example.com"],
    })));
    app.use("/api/issues", issueRouter);
    return app;
}
async function waitForScan(app, scanId) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const response = await request(app).get(`/api/scans/${scanId}`);
        if (response.body.scan.status !== "running")
            return response.body.scan;
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("Scan did not finish within the test timeout.");
}
describe("scan API", () => {
    beforeEach(() => {
        database.exec("DELETE FROM scan_results; DELETE FROM scans; DELETE FROM accessibility_issues");
    });
    it("normalizes a valid URL and persists axe results", async () => {
        const app = createTestApp();
        const created = await request(app)
            .post("/api/scans")
            .send({ url: "HTTPS://Example.com/audit#section" });
        expect(created.status).toBe(202);
        expect(created.body.scan.status).toBe("running");
        const completedScan = await waitForScan(app, created.body.scan.id);
        expect(completedScan).toMatchObject({
            url: "https://example.com/audit",
            status: "completed",
            totalViolations: 1,
        });
        const results = await request(app).get(`/api/scans/${created.body.scan.id}/results`);
        expect(results.body.summary).toMatchObject({ violations: 1, serious: 1 });
        expect(results.body.items[0]).toMatchObject({
            ruleId: "color-contrast",
            helpText: axeResult.helpText,
            helpUrl: axeResult.helpUrl,
            targets: ["#continue"],
            pageUrl: "https://example.com/audit",
            reviewStatus: "pending",
        });
    });
    it("rejects malformed URLs, unsupported protocols, and local/private targets", async () => {
        const executor = vi.fn(async () => [axeResult]);
        const app = createTestApp(executor);
        const targets = [
            "not-a-url",
            "file:///C:/private/page.html",
            "http://localhost/",
            "http://127.0.0.1/",
            "http://192.168.1.4/",
            "ftp://example.com/resource",
        ];
        for (const url of targets) {
            const response = await request(app).post("/api/scans").send({ url });
            expect(response.status, url).toBe(400);
        }
        expect(executor).not.toHaveBeenCalled();
        expect(database.prepare("SELECT COUNT(*) AS count FROM scans").get()).toMatchObject({ count: 0 });
    });
    it("rejects a hostname that resolves to a private address", async () => {
        const app = createTestApp(async () => [axeResult], async () => [
            { address: "10.1.2.3", family: 4 },
        ]);
        const response = await request(app)
            .post("/api/scans")
            .send({ url: "https://internal.example.com" });
        expect(response.status).toBe(400);
        expect(response.body.error).toContain("private or reserved");
    });
    it("rejects a public host outside the configured allowlist", async () => {
        const executor = vi.fn(async () => [axeResult]);
        const app = createTestApp(executor);
        const response = await request(app)
            .post("/api/scans")
            .send({ url: "https://not-allowed.example.org" });
        expect(response.status).toBe(400);
        expect(response.body.error).toContain("allowlist");
        expect(executor).not.toHaveBeenCalled();
    });
    it("persists failed scan status and a safe error message", async () => {
        const app = createTestApp(async () => {
            throw new Error("Navigation failed at https://example.com/private?token=secret");
        });
        const created = await request(app)
            .post("/api/scans")
            .send({ url: "https://example.com" });
        expect(created.status).toBe(202);
        const failedScan = await waitForScan(app, created.body.scan.id);
        expect(failedScan.status).toBe("failed");
        expect(failedScan.errorMessage).toContain("[target URL]");
        expect(failedScan.errorMessage).not.toContain("secret");
    });
    it("imports a selected result once and preserves axe evidence", async () => {
        const app = createTestApp();
        const created = await request(app)
            .post("/api/scans")
            .send({ url: "https://example.com" });
        await waitForScan(app, created.body.scan.id);
        const scanId = created.body.scan.id;
        const resultId = (await request(app).get(`/api/scans/${scanId}/results`))
            .body.items[0].id;
        const selected = await request(app)
            .patch(`/api/scans/${scanId}/results/${resultId}`)
            .send({ selected: true });
        expect(selected.body.item.reviewStatus).toBe("selected");
        const firstImport = await request(app).post(`/api/scans/${scanId}/import`);
        const repeatedImport = await request(app).post(`/api/scans/${scanId}/import`);
        expect(firstImport.body).toMatchObject({ importedCount: 1, errors: [] });
        expect(repeatedImport.body).toMatchObject({ importedCount: 0, alreadyImportedCount: 1 });
        const findings = await request(app).get("/api/issues");
        expect(findings.body.total).toBe(1);
        expect(findings.body.items[0]).toMatchObject({
            source: "axe",
            axeRuleId: "color-contrast",
            pageUrl: "https://example.com/",
            severity: "high",
            wcagCriterion: "WCAG 1.4.3",
        });
        expect(findings.body.items[0].description).toContain("#continue");
        expect(findings.body.items[0].description).toContain("<button id=\"continue\">");
    });
});
