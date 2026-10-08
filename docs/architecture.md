# Architecture Notes

The application is a local monorepo with a React frontend and Express backend. The API owns validation, persistence, and scanner orchestration. SQLite is initialized on API startup. Repository classes isolate SQL from route handlers, while Zod schemas define request contracts.

The intended scanner flow is URL validation, bounded Playwright navigation, axe-core evaluation, review of normalized scan results, and selective import into `accessibility_issues`. No authentication, crawling, external integrations, or AI remediation are included in the initial slice.
