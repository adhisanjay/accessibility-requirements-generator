import { createRequire } from "node:module";
import { chromium } from "playwright";
import { normalizeAndValidateScanUrl } from "./scanTarget.js";
const require = createRequire(import.meta.url);
const axeScriptPath = require.resolve("axe-core");
const navigationTimeoutMs = 20_000;
const actionTimeoutMs = 10_000;
const maximumRequests = 100;
export async function runAxeScan(url) {
    const browser = await chromium.launch({
        headless: true,
        timeout: actionTimeoutMs,
    });
    try {
        const context = await browser.newContext({ serviceWorkers: "block" });
        const page = await context.newPage();
        page.setDefaultTimeout(actionTimeoutMs);
        page.setDefaultNavigationTimeout(navigationTimeoutMs);
        let requestCount = 0;
        await page.route("**/*", async (route) => {
            requestCount += 1;
            if (requestCount > maximumRequests) {
                await route.abort("blockedbyclient");
                return;
            }
            try {
                await normalizeAndValidateScanUrl(route.request().url());
                await route.continue();
            }
            catch {
                await route.abort("blockedbyclient");
            }
        });
        const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: navigationTimeoutMs,
        });
        if (response && response.status() >= 400) {
            throw new Error(`The target returned HTTP ${response.status()}.`);
        }
        await page.addScriptTag({ path: axeScriptPath });
        const violations = await page.evaluate(async () => {
            const result = await window.axe.run(document, {
                timeout: actionTimeoutMs,
            });
            return result.violations.map((violation) => ({
                id: violation.id,
                impact: violation.impact,
                description: violation.description,
                help: violation.help,
                helpUrl: violation.helpUrl,
                tags: violation.tags,
                nodes: violation.nodes.slice(0, 100).map((node) => ({
                    target: node.target,
                    html: node.html,
                })),
            }));
        });
        return violations.map((violation) => ({
            ruleId: violation.id,
            impact: violation.impact,
            description: violation.description,
            helpText: violation.help,
            helpUrl: violation.helpUrl,
            htmlSnippets: violation.nodes.map((node) => node.html.slice(0, 2000)),
            targets: [...new Set(violation.nodes.flatMap((node) => node.target))],
            wcagTags: violation.tags,
        }));
    }
    finally {
        await browser.close();
    }
}
