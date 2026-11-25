/**
 * Local File Store for ContextMuse Audit Runs.
 * Saves audit snapshots, editorial review annotations, and optional attached
 * telemetry (Search Console / Lighthouse JSON) under data/runs/.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data', 'runs');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function generateRunId() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = crypto.randomBytes(3).toString('hex');
  return `run-${ts}-${rand}`;
}

function saveRun(runRecord) {
  ensureDataDir();
  const runId = runRecord.runId || generateRunId();
  const record = {
    ...runRecord,
    runId,
    createdAt: runRecord.createdAt || new Date().toISOString()
  };
  const filePath = path.join(DATA_DIR, `${runId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
  return record;
}

function getRun(runId) {
  ensureDataDir();
  const safeId = path.basename(String(runId || ''));
  const filePath = path.join(DATA_DIR, `${safeId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function listRuns() {
  ensureDataDir();
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse();

  const summaries = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
      summaries.push({
        runId: data.runId,
        label: data.label || data.crawl?.startUrl || data.runId,
        startUrl: data.crawl?.startUrl || '',
        origin: data.crawl?.origin || '',
        createdAt: data.createdAt,
        inspectedCount: data.crawl?.coverage?.inspectedCount || 0,
        excludedByRobotsCount: data.crawl?.coverage?.excludedByRobotsCount || 0,
        failedRequestsCount: data.crawl?.coverage?.failedRequestsCount || 0,
        totalGroupedFindings: data.analysis?.summary?.totalGroupedFindings || 0,
        byPriority: data.analysis?.summary?.byPriority || { P1: 0, P2: 0, P3: 0 }
      });
    } catch {
      // skip malformed file
    }
  }
  return summaries;
}

function updateRunEditorialReview(runId, reviewUpdate) {
  const run = getRun(runId);
  if (!run) return null;

  const existing = run.analysis?.editorialStudio?.humanReview || {
    reviewerName: '',
    updatedAt: null,
    studioNotes: '',
    checklistStates: {},
    findingDispositions: {}
  };

  const updated = {
    reviewerName:
      reviewUpdate.reviewerName !== undefined ? reviewUpdate.reviewerName : existing.reviewerName,
    updatedAt: new Date().toISOString(),
    studioNotes:
      reviewUpdate.studioNotes !== undefined ? reviewUpdate.studioNotes : existing.studioNotes,
    checklistStates: {
      ...(existing.checklistStates || {}),
      ...(reviewUpdate.checklistStates || {})
    },
    findingDispositions: {
      ...(existing.findingDispositions || {}),
      ...(reviewUpdate.findingDispositions || {})
    }
  };

  if (run.analysis && run.analysis.editorialStudio) {
    run.analysis.editorialStudio.humanReview = updated;
  }
  return saveRun(run);
}

function attachOptionalIntegration(runId, slotType, payload) {
  const run = getRun(runId);
  if (!run) return null;

  const boundaries = run.analysis?.evidenceBoundaries;
  if (!boundaries || !boundaries.optionalIntegrations) return null;

  if (slotType === 'searchConsole') {
    boundaries.optionalIntegrations.searchConsole = {
      status: 'attached',
      label: 'Attached Search Console Export',
      attachedAt: new Date().toISOString(),
      data: payload
    };
  } else if (slotType === 'measuredPerformance') {
    boundaries.optionalIntegrations.measuredPerformance = {
      status: 'attached',
      label: 'Attached Measured Performance / Lab Trace',
      attachedAt: new Date().toISOString(),
      data: payload
    };
  } else {
    throw new Error(`Unsupported optional integration slot: ${slotType}`);
  }

  return saveRun(run);
}

module.exports = {
  saveRun,
  getRun,
  listRuns,
  updateRunEditorialReview,
  attachOptionalIntegration,
  DATA_DIR
};
