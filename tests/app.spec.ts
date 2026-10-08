import { expect, test } from '@playwright/test';

test('dashboard loads with accessible primary content', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Issues dashboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New issue' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Accessibility issues' })).toBeVisible();
});

test('user scans, selects, and imports a finding into the Finding Register', async ({ page }) => {
  let selected = false;
  let imported = false;
  const fixtureScan = {
    id: 41,
    url: 'https://example.com/',
    status: 'completed',
    totalViolations: 1,
    startedAt: '2026-10-06T00:00:00.000Z',
    completedAt: '2026-10-06T00:00:02.000Z',
    errorMessage: null,
  };
  const fixtureResult = {
    id: 9,
    scanId: 41,
    ruleId: 'color-contrast',
    impact: 'serious',
    description: 'Elements must have sufficient color contrast.',
    helpText: 'Ensure the contrast ratio is sufficient.',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
    htmlSnippets: ['<button>Continue</button>'],
    targets: ['#continue'],
    wcagTags: ['wcag143'],
    pageUrl: 'https://example.com/',
    reviewStatus: 'pending',
    importedIssueId: null,
  };
  const fixtureIssue = {
    id: 501,
    title: 'color-contrast: Ensure the contrast ratio is sufficient.',
    description: fixtureResult.description,
    wcagCriterion: 'WCAG 1.4.3',
    severity: 'high',
    status: 'open',
    recommendation: fixtureResult.helpText,
    source: 'axe',
    axeRuleId: 'color-contrast',
    pageUrl: 'https://example.com/',
    createdAt: '2026-10-06T00:00:03.000Z',
    updatedAt: '2026-10-06T00:00:03.000Z',
  };

  await page.route('**/api/scans**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/scans' && request.method() === 'POST') {
      await route.fulfill({ status: 201, json: { scan: fixtureScan } });
      return;
    }
    if (pathname === '/api/scans/41/results' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        json: {
          scan: fixtureScan,
          summary: { violations: 1, critical: 0, serious: 1, moderate: 0, minor: 0 },
          items: [{ ...fixtureResult, reviewStatus: selected ? 'selected' : imported ? 'imported' : 'pending', importedIssueId: imported ? 501 : null }],
        },
      });
      return;
    }
    if (pathname === '/api/scans/41/results/9' && request.method() === 'PATCH') {
      selected = request.postDataJSON().selected;
      await route.fulfill({
        status: 200,
        json: { item: { ...fixtureResult, reviewStatus: selected ? 'selected' : 'pending' } },
      });
      return;
    }
    if (pathname === '/api/scans/41/import' && request.method() === 'POST') {
      imported = selected;
      await route.fulfill({
        status: 200,
        json: { importedCount: imported ? 1 : 0, alreadyImportedCount: 0, errors: [] },
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/issues**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/issues/summary') {
      await route.fulfill({
        status: 200,
        json: {
          total: imported ? 1 : 0,
          byStatus: imported ? [{ status: 'open', count: 1 }] : [],
          bySeverity: imported ? [{ severity: 'high', count: 1 }] : [],
        },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      json: {
        items: imported ? [fixtureIssue] : [],
        total: imported ? 1 : 0,
        page: 1,
        pageSize: 20,
      },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Scanner' }).click();
  await page.getByLabel('Target URL').fill('https://example.com');
  await page.getByRole('button', { name: 'Run accessibility scan' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Scan complete. 1 violation found.' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Accessibility violations for https://example.com/' })).toBeVisible();
  const checkbox = page.getByRole('checkbox', { name: 'Select color-contrast finding for import' });
  await checkbox.check();
  await expect(page.getByText('1 selected for import')).toBeVisible();
  await page.getByRole('button', { name: 'Import selected findings' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Imported 1 finding.' })).toBeVisible();

  await page.getByRole('button', { name: 'Dashboard' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'color-contrast: Ensure the contrast ratio is sufficient.' })).toBeVisible();
});
