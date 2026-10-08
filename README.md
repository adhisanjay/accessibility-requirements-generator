# A11y Audit Assistant

A local capstone application for accessibility consultants to manage WCAG findings and review automated accessibility scans.

## Current V1 slice

The initial vertical slice includes:

- React + Vite + TypeScript dashboard
- Express + TypeScript REST API
- Automatic SQLite database and table initialization
- Create, list, search, filter, and delete accessibility issues
- Accessible form labels, semantic issue table, keyboard focus styles, and status announcements
- Initial Vitest/Supertest API tests and Playwright page-load test

The scanner review workflow, edit flow, and import flow are intentionally reserved for the next implementation slice. The project structure and database tables are ready for those features.

## Requirements

- Node.js 22 LTS or newer
- npm 10 or newer
- Playwright browser binaries for end-to-end tests
- A scan allowlist configured with `SCAN_ALLOWED_HOSTS` (comma-separated hostnames)

## Install

```text
npm install
npx playwright install chromium
```

## Run locally

```text
npm run dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:3000` and creates `data/a11y-audit.sqlite` automatically on first start.

To enable scanning, configure `SCAN_ALLOWED_HOSTS` for the API process with the exact domains users may scan, for example `example.com,staging.example.org`. The scanner rejects hosts outside this allowlist, local/private/reserved addresses, nonstandard ports, and non-HTTP(S) URLs. Allowlisted subdomains are included.

## Commands

```text
npm run build
npm test
npm run lint
npm run format
```

## Project layout

- `web/` React frontend
- `api/` Express API, services, repositories, schemas, and database setup
- `tests/` Playwright browser tests
- `data/` generated local SQLite database
- `docs/` project notes and future SDLC artifacts
- `scripts/` future migration and seed utilities

## Assumptions

- V1 is a single-user local demo with no authentication.
- Issue deletion is immediate in this first slice.
- Public URL scanning will be restricted to HTTP/HTTPS, non-private targets, and bounded timeouts when the scanner slice is implemented.
- `better-sqlite3` 13.x is used for compatibility with current Node.js releases. Native dependency installation may require a supported Node LTS runtime or Windows C++ build tools.

## AI Accessibility Analysis

The AI Analysis Assistant analyzes persisted accessibility findings one at a time. The API reads findings from SQLite; client-supplied counts are retained only for request compatibility and are not used as analysis input. Findings with an existing analysis are skipped, so rerunning analysis does not replace reviewer edits or decisions.

The API uses an `AccessibilityAnalysisProvider` boundary with two implementations:

- `mock` (default): deterministic, local analysis for development and tests; it makes no external requests.
- `openai`: the OpenAI Responses API with strict structured JSON output. The response is validated with Zod and checked against the local WCAG 2.2 criterion/level reference before it is saved.

New analysis records always start as `Pending`. A reviewer may edit, approve, or reject them. Requirement generation remains blocked until an analysis is explicitly approved, and generated requirements start as `Pending Review`.

### Configuration

Copy `.env.example` to `.env` in the repository root for local configuration. `.env` is ignored by Git. The API loads these server-side variables:

| Variable | Purpose | Default |
|---|---|---|
| `AI_PROVIDER` | `mock` or `openai` | `mock` |
| `AI_API_KEY` | OpenAI API key; required only with `AI_PROVIDER=openai` | unset |
| `AI_MODEL` | OpenAI model name | `gpt-4.1-mini` |
| `AI_TIMEOUT_MS` | Per-finding request timeout, from 1000 to 120000 ms | `20000` |
| `AI_BASE_URL` | Optional OpenAI-compatible API base URL | OpenAI default |

For local mock mode, keep `AI_PROVIDER=mock`; no API key is required. For real analysis, set `AI_PROVIDER=openai` and provide `AI_API_KEY` through a local ignored `.env`, process environment, or deployment secret manager. Never set the key in a `VITE_` variable or commit it.

### Security and Reliability

The browser never receives the provider key. The API sends only relevant finding fields to the provider, limits simultaneous analyses to three, applies the configured timeout, and uses a single SDK retry for transient provider errors. Provider prompts, raw responses, and API keys are not logged. Each finding is handled independently; a failed or malformed response is reported for that finding and is not persisted. Valid outputs require a known WCAG 2.2 criterion and its matching level, and confidence must be between 0 and 1.

### Review Workflow

`Finding Register → Analyze Application → Pending analysis → human edit/approve/reject → generate requirement from approved analysis → Pending Review requirement`

AI output cannot change review status. The existing Requirement Assistant approval gate remains authoritative. Real Jira writes are not part of this feature.
