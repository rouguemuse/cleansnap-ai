/**
 * ContextMuse Website Audit — CLI Runner.
 * Supports auditing any live URL or running the offline reproducible Before/After demo.
 *
 * Usage:
 *   node src/cli.js --demo
 *   node src/cli.js --url https://example.com --max-pages 8 --max-depth 2
 */

const { crawlSite } = require('./crawler');
const { analyzeCrawlResult } = require('./analyzer');
const { compareAuditRuns } = require('./compare');
const { saveRun } = require('./store');
const { createDemoFixtureServer } = require('./demoFixture');

function printReportSummary(run) {
  const { crawl, analysis } = run;
  console.log('\n--------------------------------------------------------------------');
  console.log(` RUN: ${run.label} (${run.runId})`);
  console.log('--------------------------------------------------------------------');
  console.log(` Seed URL            : ${crawl.startUrl}`);
  console.log(` Crawl Limits        : maxPages=${crawl.limits.maxPages}, maxDepth=${crawl.limits.maxDepth}, timeout=${crawl.limits.timeoutMs}ms`);
  console.log(` robots.txt          : ${crawl.robots.found ? `Found (${crawl.robots.rules.length} rule(s))` : 'Not found'}`);
  console.log(` sitemap.xml         : ${crawl.sitemap.found ? `Found (${crawl.sitemap.totalListed} URL(s))` : 'Not found'}`);
  console.log(
    ` Coverage            : ${crawl.coverage.inspectedCount} inspected | ${crawl.coverage.excludedByRobotsCount} excluded by robots.txt | ${crawl.coverage.failedRequestsCount} failed (4xx/5xx) | ${crawl.coverage.skippedByLimitCount} skipped by limit`
  );
  console.log(
    ` Grouped Findings    : ${analysis.summary.totalGroupedFindings} total (${analysis.summary.byPriority.P1} P1, ${analysis.summary.byPriority.P2} P2, ${analysis.summary.byPriority.P3} P3)`
  );
  console.log(
    ` Evidence Breakdown  : ${analysis.summary.byEvidenceType.deterministic} Deterministic Technical Observation(s), ${analysis.summary.byEvidenceType.heuristic} Heuristic Signal(s)`
  );

  if (crawl.excludedByRobots.length > 0) {
    console.log('\n Excluded by robots.txt:');
    for (const ex of crawl.excludedByRobots) {
      console.log(`   - ${ex.url} (${ex.matchedRule})`);
    }
  }

  console.log('\n Prioritized Grouped Findings:');
  for (const f of analysis.findings) {
    console.log(`\n   [${f.priority}] [${f.pillar}] ${f.title}`);
    console.log(`       ID: ${f.id} | Evidence Class: ${f.evidenceType}`);
    console.log(`       Affected URLs (${f.affectedUrls.length}):`);
    for (const u of f.affectedUrls) {
      console.log(`         * ${u.url} -> ${u.evidence}`);
    }
    console.log(`       Concrete Repair: ${f.concreteRepair}`);
    console.log(`       How to Verify  : ${f.howToVerify}`);
  }
}

async function runCli() {
  const args = process.argv.slice(2);
  const isDemo = args.includes('--demo') || args.length === 0;

  if (isDemo) {
    console.log('====================================================================');
    console.log(' ContextMuse — Offline Reproducible Example (Before & After Repair)');
    console.log('====================================================================');
    const fixture = createDemoFixtureServer('before');
    const { origin } = await fixture.start(0);

    try {
      // 1. Audit BEFORE repair
      fixture.setMode('before');
      const crawlBefore = await crawlSite({ startUrl: `${origin}/`, maxPages: 10, maxDepth: 3 });
      const analysisBefore = analyzeCrawlResult(crawlBefore);
      const runBefore = saveRun({
        label: 'Atelier Nocturne — Baseline (Before Repair)',
        crawl: crawlBefore,
        analysis: analysisBefore
      });
      printReportSummary(runBefore);

      // 2. Audit AFTER repair
      fixture.setMode('after');
      const crawlAfter = await crawlSite({ startUrl: `${origin}/`, maxPages: 10, maxDepth: 3 });
      const analysisAfter = analyzeCrawlResult(crawlAfter);
      const runAfter = saveRun({
        label: 'Atelier Nocturne — Repaired (After Repair)',
        crawl: crawlAfter,
        analysis: analysisAfter
      });
      printReportSummary(runAfter);

      // 3. Compare Baseline vs Repaired
      const diff = compareAuditRuns(runBefore, runAfter);
      console.log('\n====================================================================');
      console.log(' RERUN & COMPARISON SUMMARY (Before vs. After Repair)');
      console.log('====================================================================');
      console.log(` Grouped Findings : ${diff.baseline.totalGroupedFindings} -> ${diff.current.totalGroupedFindings}`);
      console.log(` Resolved Issues  : ${diff.counts.resolvedCount}`);
      for (const r of diff.resolved) {
        console.log(`   [RESOLVED] [${r.priority}] ${r.id}: ${r.title} (${r.beforeCount} URL(s) -> 0)`);
      }
      if (diff.unchanged.length > 0) {
        console.log(` Intentional / Unchanged Context Refinements (${diff.unchanged.length}):`);
        for (const u of diff.unchanged) {
          console.log(`   [UNCHANGED] [${u.priority}] ${u.id}: ${u.title}`);
        }
      }
      console.log('====================================================================\n');
    } finally {
      await fixture.stop();
    }
    return;
  }

  // Custom URL audit mode
  const urlIdx = args.indexOf('--url');
  const startUrl = urlIdx !== -1 ? args[urlIdx + 1] : args[0];
  const maxPagesIdx = args.indexOf('--max-pages');
  const maxPages = maxPagesIdx !== -1 ? parseInt(args[maxPagesIdx + 1], 10) : 10;
  const maxDepthIdx = args.indexOf('--max-depth');
  const maxDepth = maxDepthIdx !== -1 ? parseInt(args[maxDepthIdx + 1], 10) : 3;

  const crawl = await crawlSite({ startUrl, maxPages, maxDepth });
  const analysis = analyzeCrawlResult(crawl);
  const run = saveRun({
    label: `CLI Audit: ${startUrl}`,
    crawl,
    analysis
  });
  printReportSummary(run);
}

if (require.main === module) {
  runCli().catch((err) => {
    console.error('CLI Audit Error:', err.message);
    process.exit(1);
  });
}

module.exports = { runCli };
