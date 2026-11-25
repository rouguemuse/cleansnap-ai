/**
 * Automated Test Suite for ContextMuse Website Audit MVP.
 * Tests:
 *  1. Same-origin bounded crawling, robots.txt exclusion enforcement, and explicit coverage ledger.
 *  2. Unified 4-pillar analysis (Accessibility, Usability, Performance, Search Visibility),
 *     grouped findings, deterministic vs. heuristic labeling, and non-urgent meta description handling.
 *  3. Real issue detection Before Repair and verified resolution After Repair via the comparison engine.
 *  4. Editorial Review Studio persistence and optional telemetry integration slots via the local HTTP API.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDemoFixtureServer } = require('../src/demoFixture');
const { crawlSite } = require('../src/crawler');
const { analyzeCrawlResult } = require('../src/analyzer');
const { compareAuditRuns } = require('../src/compare');
const { createAuditApp } = require('../src/server');

test('ContextMuse Audit Engine: Before & After Repair Reproducible Example and Verification Diff', async (t) => {
  const fixture = createDemoFixtureServer('before');
  const { origin } = await fixture.start(0);

  t.after(async () => {
    await fixture.stop();
  });

  // -------------------------------------------------------------------------
  // PHASE 1: Audit Baseline ("before" repair state)
  // -------------------------------------------------------------------------
  fixture.setMode('before');
  const crawlBefore = await crawlSite({
    startUrl: `${origin}/`,
    maxPages: 10,
    maxDepth: 3,
    timeoutMs: 5000
  });

  // Verify coverage and robots.txt exclusion
  assert.equal(crawlBefore.coverage.inspectedCount, 4, 'Should inspect exactly 4 allowed public HTML pages');
  assert.equal(crawlBefore.coverage.excludedByRobotsCount, 1, 'Should exclude /private-drafts via robots.txt');
  assert.equal(crawlBefore.excludedByRobots[0].url, `${origin}/private-drafts`);
  assert.match(crawlBefore.excludedByRobots[0].matchedRule, /Disallow:\s*\/private-drafts/i);

  // Verify external links are recorded but never crawled
  assert.equal(crawlBefore.coverage.externalLinksCount, 1, 'Should record off-origin external link without crawling it');
  assert.equal(crawlBefore.externalLinks[0].url, 'https://example.org/architectural-index');

  // Verify broken internal link is captured in failedRequests
  assert.equal(crawlBefore.coverage.failedRequestsCount, 1);
  assert.equal(crawlBefore.failedRequests[0].url, `${origin}/essays/missing-monograph`);
  assert.equal(crawlBefore.failedRequests[0].status, 404);

  const analysisBefore = analyzeCrawlResult(crawlBefore);
  const findingsBeforeMap = new Map(analysisBefore.findings.map((f) => [f.id, f]));

  // Verify real issues across all 4 pillars are detected and grouped
  assert.ok(findingsBeforeMap.has('USABILITY_BROKEN_INTERNAL_LINK'), 'Detects broken internal 404 link');
  assert.ok(findingsBeforeMap.has('A11Y_UNLABELED_FORM_CONTROL'), 'Detects unlabeled email input');
  assert.ok(findingsBeforeMap.has('SEARCH_INVALID_JSON_LD'), 'Detects malformed JSON-LD syntax');
  assert.ok(findingsBeforeMap.has('SEARCH_SITEMAP_LISTS_ROBOTS_BLOCKED_URL'), 'Detects robots-blocked URL in sitemap.xml');
  assert.ok(findingsBeforeMap.has('A11Y_IMAGE_MISSING_ALT'), 'Detects hero artwork missing alt attribute');
  assert.ok(findingsBeforeMap.has('PERF_IMAGE_MISSING_DIMENSIONS'), 'Detects hero artwork missing intrinsic width/height');
  assert.ok(findingsBeforeMap.has('PERF_RENDER_BLOCKING_HEAD_SCRIPT'), 'Detects synchronous script in <head>');
  assert.ok(findingsBeforeMap.has('A11Y_MISSING_HTML_LANG'), 'Detects missing <html lang> on essay page');
  assert.ok(findingsBeforeMap.has('USABILITY_BROKEN_FRAGMENT_ANCHOR'), 'Detects broken #curator-notes anchor target');
  assert.ok(findingsBeforeMap.has('SEARCH_DUPLICATE_TITLE'), 'Detects duplicate <title> grouped across 2 pages');
  assert.equal(
    findingsBeforeMap.get('SEARCH_DUPLICATE_TITLE').affectedUrls.length,
    2,
    'Groups duplicate title across / and /exhibitions into a single finding'
  );
  assert.ok(findingsBeforeMap.has('A11Y_HEADING_HIERARCHY_SKIP'), 'Detects H1 -> H4 heading skip heuristic');

  // Verify methodological constraints:
  // 1) Heuristics are explicitly distinguished from deterministic facts
  assert.match(
    findingsBeforeMap.get('A11Y_IMAGE_MISSING_ALT').evidenceType,
    /^Heuristic Signal/,
    'Missing alt is labeled as a heuristic signal requiring editorial review'
  );
  assert.match(
    findingsBeforeMap.get('USABILITY_BROKEN_INTERNAL_LINK').evidenceType,
    /^Deterministic Technical Observation/,
    'HTTP 404 broken link is labeled as a deterministic technical observation'
  );

  // 2) Missing meta description is treated as non-urgent P3 contextual refinement
  const missingDescFinding = findingsBeforeMap.get('SEARCH_MISSING_META_DESCRIPTION');
  assert.ok(missingDescFinding, 'Detects missing meta description on colophon');
  assert.equal(
    missingDescFinding.priority,
    'P3',
    'Missing meta description must be P3 (Contextual Refinement), never P1 urgent'
  );

  // 3) Unavailable evidence is explicitly labeled and optional slots start unattached
  assert.ok(analysisBefore.evidenceBoundaries.unavailableInZeroCredentialCrawl.length >= 4);
  assert.equal(
    analysisBefore.evidenceBoundaries.optionalIntegrations.searchConsole.status,
    'not_attached'
  );

  // -------------------------------------------------------------------------
  // PHASE 2: Apply Repairs ("after" repair state) and Rerun Audit
  // -------------------------------------------------------------------------
  fixture.setMode('after');
  const crawlAfter = await crawlSite({
    startUrl: `${origin}/`,
    maxPages: 10,
    maxDepth: 3,
    timeoutMs: 5000
  });
  const analysisAfter = analyzeCrawlResult(crawlAfter);
  const findingsAfterMap = new Map(analysisAfter.findings.map((f) => [f.id, f]));

  // Verify broken link is gone and all 4 pages still inspected while /private-drafts remains excluded
  assert.equal(crawlAfter.coverage.inspectedCount, 4);
  assert.equal(crawlAfter.coverage.excludedByRobotsCount, 1);
  assert.equal(crawlAfter.coverage.failedRequestsCount, 0, '0 broken internal links after repair');

  // Verify repaired issues no longer appear in findingsAfterMap
  const expectedResolvedIds = [
    'USABILITY_BROKEN_INTERNAL_LINK',
    'A11Y_UNLABELED_FORM_CONTROL',
    'SEARCH_INVALID_JSON_LD',
    'SEARCH_SITEMAP_LISTS_ROBOTS_BLOCKED_URL',
    'A11Y_IMAGE_MISSING_ALT',
    'PERF_IMAGE_MISSING_DIMENSIONS',
    'PERF_RENDER_BLOCKING_HEAD_SCRIPT',
    'A11Y_MISSING_HTML_LANG',
    'USABILITY_BROKEN_FRAGMENT_ANCHOR',
    'SEARCH_DUPLICATE_TITLE',
    'A11Y_HEADING_HIERARCHY_SKIP'
  ];

  for (const resolvedId of expectedResolvedIds) {
    assert.equal(
      findingsAfterMap.has(resolvedId),
      false,
      `Expected finding ${resolvedId} to be resolved after repair`
    );
  }

  // -------------------------------------------------------------------------
  // PHASE 3: Compare Baseline vs. Repaired Run
  // -------------------------------------------------------------------------
  const baselineRun = {
    runId: 'test-run-before',
    label: 'Baseline Before Repair',
    createdAt: new Date().toISOString(),
    crawl: crawlBefore,
    analysis: analysisBefore
  };
  const repairedRun = {
    runId: 'test-run-after',
    label: 'Repaired After Repair',
    createdAt: new Date().toISOString(),
    crawl: crawlAfter,
    analysis: analysisAfter
  };

  const diff = compareAuditRuns(baselineRun, repairedRun);
  assert.equal(diff.counts.resolvedCount, 11, 'All 11 repaired issues should be marked RESOLVED');
  assert.equal(diff.counts.unchangedCount, 1, 'Intentional P3 colophon meta description note remains unchanged');
  assert.equal(diff.unchanged[0].id, 'SEARCH_MISSING_META_DESCRIPTION');
});

test('ContextMuse Crawl Limits: Enforces maxPages boundary and records skippedByLimit', async (t) => {
  const fixture = createDemoFixtureServer('after');
  const { origin } = await fixture.start(0);

  t.after(async () => {
    await fixture.stop();
  });

  const limitedCrawl = await crawlSite({
    startUrl: `${origin}/`,
    maxPages: 2,
    maxDepth: 3
  });

  assert.equal(limitedCrawl.coverage.inspectedCount, 2, 'Must stop inspecting HTML pages at maxPages=2');
  assert.ok(
    limitedCrawl.coverage.skippedByLimitCount >= 2,
    'Remaining discovered same-origin pages must be recorded in skippedByLimit'
  );
});

test('ContextMuse HTTP Server API: Editorial Review Persistence & Optional Telemetry Attachment', async (t) => {
  const app = await createAuditApp({ demoPort: 0 });
  const info = await app.start(0);

  t.after(async () => {
    await app.stop();
  });

  // 1. Trigger the full before-after reproducible endpoint
  const demoRes = await fetch(`${info.url}/api/demo/before-after`, { method: 'POST' });
  assert.equal(demoRes.status, 200);
  const demoPayload = await demoRes.json();
  assert.equal(demoPayload.comparison.counts.resolvedCount, 11);

  const repairedRunId = demoPayload.repairedRun.runId;

  // 2. Save an editorial review disposition marking the P3 colophon meta description as 'intentional'
  const editRes = await fetch(`${info.url}/api/runs/${encodeURIComponent(repairedRunId)}/editorial`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reviewerName: 'Clara Vance',
      studioNotes: 'Colophon relies intentionally on organic letterpress body excerpt.',
      findingDispositions: {
        SEARCH_MISSING_META_DESCRIPTION: { status: 'intentional' }
      }
    })
  });
  assert.equal(editRes.status, 200);
  const updatedRun = await editRes.json();
  assert.equal(
    updatedRun.analysis.editorialStudio.humanReview.reviewerName,
    'Clara Vance'
  );
  assert.equal(
    updatedRun.analysis.editorialStudio.humanReview.findingDispositions.SEARCH_MISSING_META_DESCRIPTION.status,
    'intentional'
  );

  // 3. Attach optional Search Console data slot
  const intRes = await fetch(`${info.url}/api/runs/${encodeURIComponent(repairedRunId)}/integrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slotType: 'searchConsole',
      data: { topQuery: 'atelier nocturne monographs', clicks: 95 }
    })
  });
  assert.equal(intRes.status, 200);
  const withScRun = await intRes.json();
  assert.equal(
    withScRun.analysis.evidenceBoundaries.optionalIntegrations.searchConsole.status,
    'attached'
  );
  assert.equal(
    withScRun.analysis.evidenceBoundaries.optionalIntegrations.searchConsole.data.clicks,
    95
  );

  // 4. Self-audit the ContextMuse Web UI itself to ensure our own editorial presentation has 0 P1/P2 findings
  const selfAuditRes = await fetch(`${info.url}/api/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startUrl: `${info.url}/`,
      maxPages: 5,
      maxDepth: 1,
      label: 'Self-Audit of ContextMuse UI'
    })
  });
  assert.equal(selfAuditRes.status, 200);
  const selfAudit = await selfAuditRes.json();
  assert.equal(selfAudit.analysis.summary.byPriority.P1, 0, 'ContextMuse UI itself must have 0 P1 issues');
  assert.equal(selfAudit.analysis.summary.byPriority.P2, 0, 'ContextMuse UI itself must have 0 P2 issues');
});
