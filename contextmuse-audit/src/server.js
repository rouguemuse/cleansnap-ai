/**
 * ContextMuse Website Audit — Local HTTP Server & API.
 * Serves the editorial audit workspace UI and local REST API, and hosts
 * the offline reproducible demo fixture server on a companion local port.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { crawlSite } = require('./crawler');
const { analyzeCrawlResult } = require('./analyzer');
const { compareAuditRuns } = require('./compare');
const {
  saveRun,
  getRun,
  listRuns,
  updateRunEditorialReview,
  attachOptionalIntegration
} = require('./store');
const { createDemoFixtureServer } = require('./demoFixture');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon'
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) {
        reject(new Error('Request payload exceeds 5 MB limit.'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error(`Invalid JSON body: ${err.message}`));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload, null, 2));
}

async function createAuditApp(options = {}) {
  const demoFixture = createDemoFixtureServer('before');
  const demoInfo = await demoFixture.start(options.demoPort ?? 4174).catch(async () => {
    // Fallback to ephemeral port if 4174 is occupied
    return demoFixture.start(0);
  });

  async function executeAuditRun({ startUrl, maxPages, maxDepth, timeoutMs, label }) {
    const crawl = await crawlSite({
      startUrl,
      maxPages: maxPages || 10,
      maxDepth: maxDepth ?? 3,
      timeoutMs: timeoutMs || 8000
    });
    const analysis = analyzeCrawlResult(crawl);
    const saved = saveRun({
      label: label || `${new URL(crawl.startUrl).host} (${new Date().toLocaleTimeString()})`,
      crawl,
      analysis
    });
    return saved;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url, 'http://127.0.0.1');
      const pathname = parsedUrl.pathname;

      // 1. GET /api/status
      if (req.method === 'GET' && pathname === '/api/status') {
        return sendJson(res, 200, {
          ok: true,
          demoFixture: {
            origin: demoFixture.getOrigin(),
            mode: demoFixture.getMode()
          },
          runs: listRuns()
        });
      }

      // 2. GET /api/runs
      if (req.method === 'GET' && pathname === '/api/runs') {
        return sendJson(res, 200, { runs: listRuns() });
      }

      // 3. GET /api/runs/:runId
      const runMatch = pathname.match(/^\/api\/runs\/([^/]+)$/);
      if (req.method === 'GET' && runMatch) {
        const run = getRun(decodeURIComponent(runMatch[1]));
        if (!run) return sendJson(res, 404, { error: 'Audit run not found.' });
        return sendJson(res, 200, run);
      }

      // 4. PATCH /api/runs/:runId/editorial
      const editorialMatch = pathname.match(/^\/api\/runs\/([^/]+)\/editorial$/);
      if (req.method === 'PATCH' && editorialMatch) {
        const body = await readJsonBody(req);
        const updated = updateRunEditorialReview(decodeURIComponent(editorialMatch[1]), body);
        if (!updated) return sendJson(res, 404, { error: 'Audit run not found.' });
        return sendJson(res, 200, updated);
      }

      // 5. POST /api/runs/:runId/integrations
      const integrationMatch = pathname.match(/^\/api\/runs\/([^/]+)\/integrations$/);
      if (req.method === 'POST' && integrationMatch) {
        const body = await readJsonBody(req);
        const updated = attachOptionalIntegration(
          decodeURIComponent(integrationMatch[1]),
          body.slotType,
          body.data
        );
        if (!updated) return sendJson(res, 404, { error: 'Audit run not found.' });
        return sendJson(res, 200, updated);
      }

      // 6. POST /api/audit
      if (req.method === 'POST' && pathname === '/api/audit') {
        const body = await readJsonBody(req);
        if (!body.startUrl) {
          return sendJson(res, 400, { error: 'Please provide a starting URL (startUrl).' });
        }
        const saved = await executeAuditRun({
          startUrl: body.startUrl,
          maxPages: body.maxPages,
          maxDepth: body.maxDepth,
          timeoutMs: body.timeoutMs,
          label: body.label
        });
        return sendJson(res, 200, saved);
      }

      // 7. POST /api/compare
      if (req.method === 'POST' && pathname === '/api/compare') {
        const body = await readJsonBody(req);
        const baselineRun = getRun(body.baselineRunId);
        const currentRun = getRun(body.currentRunId);
        if (!baselineRun || !currentRun) {
          return sendJson(res, 404, {
            error: 'Both baselineRunId and currentRunId must point to saved audit runs.'
          });
        }
        const comparison = compareAuditRuns(baselineRun, currentRun);
        return sendJson(res, 200, comparison);
      }

      // 8. POST /api/demo/mode
      if (req.method === 'POST' && pathname === '/api/demo/mode') {
        const body = await readJsonBody(req);
        const newMode = demoFixture.setMode(body.mode);
        return sendJson(res, 200, {
          origin: demoFixture.getOrigin(),
          mode: newMode
        });
      }

      // 9. POST /api/demo/before-after
      // Runs the offline reproducible example before repair and after repair, then compares them
      if (req.method === 'POST' && pathname === '/api/demo/before-after') {
        const origin = demoFixture.getOrigin();

        demoFixture.setMode('before');
        const baselineRun = await executeAuditRun({
          startUrl: `${origin}/`,
          maxPages: 10,
          maxDepth: 3,
          label: 'Atelier Nocturne — Baseline (Before Repair)'
        });

        demoFixture.setMode('after');
        const repairedRun = await executeAuditRun({
          startUrl: `${origin}/`,
          maxPages: 10,
          maxDepth: 3,
          label: 'Atelier Nocturne — Repaired (After Repair)'
        });

        const comparison = compareAuditRuns(baselineRun, repairedRun);
        return sendJson(res, 200, {
          baselineRun,
          repairedRun,
          comparison,
          demoFixture: {
            origin,
            mode: demoFixture.getMode()
          }
        });
      }

      // 10. Static file serving from public/
      let safePath = pathname === '/' ? '/index.html' : pathname;
      safePath = path.normalize(safePath).replace(/^(\.\.[/\\])+/, '');
      const fullPath = path.join(PUBLIC_DIR, safePath);

      if (fullPath.startsWith(PUBLIC_DIR) && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'no-cache'
        });
        fs.createReadStream(fullPath).pipe(res);
        return;
      }

      sendJson(res, 404, { error: `Not found: ${pathname}` });
    } catch (err) {
      sendJson(res, 500, { error: err.message || 'Internal server error' });
    }
  });

  return {
    server,
    demoFixture,
    demoInfo,
    start(port = 4173) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          const actualPort = server.address().port;
          resolve({
            port: actualPort,
            url: `http://127.0.0.1:${actualPort}`,
            demoOrigin: demoFixture.getOrigin()
          });
        });
      });
    },
    async stop() {
      await demoFixture.stop();
      return new Promise((resolve) => {
        if (!server.listening) return resolve();
        server.close(() => resolve());
      });
    }
  };
}

if (require.main === module) {
  const desiredPort = parseInt(process.env.PORT, 10) || 4173;
  createAuditApp()
    .then((app) => app.start(desiredPort))
    .then((info) => {
      console.log('====================================================================');
      console.log(' ContextMuse — Expressive Website Audit Studio (Local MVP)');
      console.log('====================================================================');
      console.log(` Audit Workspace UI : ${info.url}`);
      console.log(` Offline Demo Site  : ${info.demoOrigin}/ (Atelier Nocturne fixture)`);
      console.log(' Press Ctrl+C to stop.');
      console.log('====================================================================');
    })
    .catch((err) => {
      console.error('Failed to start ContextMuse server:', err);
      process.exit(1);
    });
}

module.exports = {
  createAuditApp
};
