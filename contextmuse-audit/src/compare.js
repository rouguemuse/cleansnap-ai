/**
 * ContextMuse Website Audit — Rerun & Comparison Engine.
 * Compares a Baseline Audit Run against a Current Audit Run to verify repairs
 * and highlight resolved, reduced, new, or unchanged findings.
 */

function compareAuditRuns(baselineRun, currentRun) {
  if (!baselineRun || !currentRun) {
    throw new Error('Both baselineRun and currentRun are required for comparison.');
  }

  const baseFindings = baselineRun.analysis?.findings || [];
  const currFindings = currentRun.analysis?.findings || [];

  const baseMap = new Map(baseFindings.map((f) => [f.id, f]));
  const currMap = new Map(currFindings.map((f) => [f.id, f]));

  const resolved = [];
  const improved = [];
  const regressed = [];
  const unchanged = [];
  const newFindings = [];

  for (const [id, baseF] of baseMap.entries()) {
    const baseUrls = baseF.affectedUrls.map((u) => u.url);
    const currF = currMap.get(id);

    if (!currF) {
      resolved.push({
        id,
        title: baseF.title,
        pillar: baseF.pillar,
        priority: baseF.priority,
        beforeCount: baseUrls.length,
        afterCount: 0,
        resolvedUrls: baseUrls,
        remainingUrls: []
      });
      continue;
    }

    const currUrls = currF.affectedUrls.map((u) => u.url);
    const currUrlSet = new Set(currUrls);
    const baseUrlSet = new Set(baseUrls);

    const resolvedUrls = baseUrls.filter((u) => !currUrlSet.has(u));
    const addedUrls = currUrls.filter((u) => !baseUrlSet.has(u));

    if (currUrls.length < baseUrls.length) {
      improved.push({
        id,
        title: currF.title,
        pillar: currF.pillar,
        priority: currF.priority,
        beforeCount: baseUrls.length,
        afterCount: currUrls.length,
        resolvedUrls,
        remainingUrls: currUrls
      });
    } else if (currUrls.length > baseUrls.length) {
      regressed.push({
        id,
        title: currF.title,
        pillar: currF.pillar,
        priority: currF.priority,
        beforeCount: baseUrls.length,
        afterCount: currUrls.length,
        addedUrls,
        remainingUrls: currUrls
      });
    } else {
      unchanged.push({
        id,
        title: currF.title,
        pillar: currF.pillar,
        priority: currF.priority,
        beforeCount: baseUrls.length,
        afterCount: currUrls.length,
        remainingUrls: currUrls
      });
    }
  }

  for (const [id, currF] of currMap.entries()) {
    if (!baseMap.has(id)) {
      const currUrls = currF.affectedUrls.map((u) => u.url);
      newFindings.push({
        id,
        title: currF.title,
        pillar: currF.pillar,
        priority: currF.priority,
        beforeCount: 0,
        afterCount: currUrls.length,
        addedUrls: currUrls
      });
    }
  }

  const baseCov = baselineRun.crawl?.coverage || {};
  const currCov = currentRun.crawl?.coverage || {};

  return {
    comparedAt: new Date().toISOString(),
    baseline: {
      runId: baselineRun.runId,
      label: baselineRun.label || 'Baseline Run',
      startUrl: baselineRun.crawl?.startUrl,
      createdAt: baselineRun.createdAt,
      totalGroupedFindings: baselineRun.analysis?.summary?.totalGroupedFindings ?? baseFindings.length,
      totalOccurrences: baselineRun.analysis?.summary?.totalOccurrences ?? 0
    },
    current: {
      runId: currentRun.runId,
      label: currentRun.label || 'Current Run',
      startUrl: currentRun.crawl?.startUrl,
      createdAt: currentRun.createdAt,
      totalGroupedFindings: currentRun.analysis?.summary?.totalGroupedFindings ?? currFindings.length,
      totalOccurrences: currentRun.analysis?.summary?.totalOccurrences ?? 0
    },
    coverageDelta: {
      inspectedPages: {
        before: baseCov.inspectedCount || 0,
        after: currCov.inspectedCount || 0,
        delta: (currCov.inspectedCount || 0) - (baseCov.inspectedCount || 0)
      },
      failedRequests: {
        before: baseCov.failedRequestsCount || 0,
        after: currCov.failedRequestsCount || 0,
        delta: (currCov.failedRequestsCount || 0) - (baseCov.failedRequestsCount || 0)
      },
      excludedByRobots: {
        before: baseCov.excludedByRobotsCount || 0,
        after: currCov.excludedByRobotsCount || 0,
        delta: (currCov.excludedByRobotsCount || 0) - (baseCov.excludedByRobotsCount || 0)
      }
    },
    counts: {
      resolvedCount: resolved.length,
      improvedCount: improved.length,
      regressedCount: regressed.length,
      newCount: newFindings.length,
      unchangedCount: unchanged.length
    },
    resolved,
    improved,
    regressed,
    newFindings,
    unchanged
  };
}

module.exports = {
  compareAuditRuns
};
