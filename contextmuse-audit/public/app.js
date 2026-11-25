/**
 * ContextMuse Website Audit — Browser Client Controller.
 * Renders prioritized grouped findings, the Design & Editorial Review Studio,
 * the Crawl Coverage & Robots Ledger, the Rerun & Compare Diff view,
 * and the Unavailable Evidence & Optional Integration Slots.
 */

(function () {
  let activeRun = null;
  let savedRunsList = [];
  let demoFixtureInfo = { origin: 'http://127.0.0.1:4174', mode: 'before' };

  const statusBanner = document.getElementById('status-banner');
  const statusText = document.getElementById('status-text');
  const btnRerunQuick = document.getElementById('btn-rerun-compare-quick');
  const demoStatusDisplay = document.getElementById('demo-status-display');
  const selectSavedRun = document.getElementById('select-saved-run');
  const compareBaselineSelect = document.getElementById('compare-baseline-select');
  const compareCurrentSelect = document.getElementById('compare-current-select');

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setStatus(message, tone = 'neutral') {
    statusText.textContent = message;
    if (tone === 'neutral') {
      statusBanner.removeAttribute('data-tone');
    } else {
      statusBanner.setAttribute('data-tone', tone);
    }
  }

  // Tab Navigation
  const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
  const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));

  function switchTab(tabBtnId) {
    for (const btn of tabButtons) {
      const selected = btn.id === tabBtnId;
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
    }
    const targetPanelId = document.getElementById(tabBtnId)?.getAttribute('aria-controls');
    for (const panel of tabPanels) {
      panel.classList.toggle('active', panel.id === targetPanelId);
    }
  }

  for (const btn of tabButtons) {
    btn.addEventListener('click', () => switchTab(btn.id));
  }

  function updateDemoStatusBanner() {
    const modeLabel =
      demoFixtureInfo.mode === 'after'
        ? 'AFTER REPAIR (Repaired State)'
        : 'BEFORE REPAIR (Baseline Issues Active)';
    demoStatusDisplay.textContent = `Offline Fixture: ${demoFixtureInfo.origin}/ · Active State: ${modeLabel}`;
    const urlInput = document.getElementById('input-start-url');
    if (!urlInput.value) {
      urlInput.value = `${demoFixtureInfo.origin}/`;
    }
  }

  function populateRunSelectors() {
    selectSavedRun.innerHTML =
      savedRunsList.length === 0
        ? '<option value="">— No saved snapshots yet —</option>'
        : savedRunsList
            .map(
              (r) =>
                `<option value="${escapeHtml(r.runId)}" ${
                  activeRun && activeRun.runId === r.runId ? 'selected' : ''
                }>${escapeHtml(r.label)} — ${r.totalGroupedFindings} finding(s) [${r.inspectedCount} pg]</option>`
            )
            .join('');

    const compareOptions = savedRunsList
      .map(
        (r) =>
          `<option value="${escapeHtml(r.runId)}">${escapeHtml(r.label)} (${r.totalGroupedFindings} findings)</option>`
      )
      .join('');

    compareBaselineSelect.innerHTML = compareOptions || '<option value="">— None —</option>';
    compareCurrentSelect.innerHTML = compareOptions || '<option value="">— None —</option>';

    if (savedRunsList.length >= 2) {
      compareCurrentSelect.value = savedRunsList[0].runId;
      compareBaselineSelect.value = savedRunsList[1].runId;
    }
  }

  async function refreshStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.demoFixture) {
        demoFixtureInfo = data.demoFixture;
        updateDemoStatusBanner();
      }
      if (Array.isArray(data.runs)) {
        savedRunsList = data.runs;
        populateRunSelectors();
      }
    } catch (err) {
      setStatus(`Could not load local server status: ${err.message}`, 'error');
    }
  }

  function renderSummaryStrip(run) {
    const strip = document.getElementById('summary-strip');
    strip.style.display = 'grid';

    const cov = run.crawl.coverage;
    const sum = run.analysis.summary;

    document.getElementById('stat-inspected').textContent = cov.inspectedCount;
    document.getElementById('stat-inspected-note').textContent = `Max limit: ${run.crawl.limits.maxPages} pages (depth ${run.crawl.limits.maxDepth})`;

    document.getElementById('stat-robots').textContent = cov.excludedByRobotsCount;
    document.getElementById('stat-robots-note').textContent = `${cov.skippedByLimitCount} skipped by limit · ${cov.failedRequestsCount} 4xx/5xx`;

    document.getElementById('stat-p1').textContent = sum.byPriority.P1;
    document.getElementById('stat-p2').textContent = sum.byPriority.P2;
    document.getElementById('stat-p3').textContent = sum.byPriority.P3;
    document.getElementById('stat-evidence').textContent = `${sum.byEvidenceType.deterministic} / ${sum.byEvidenceType.heuristic}`;

    btnRerunQuick.style.display = 'inline-block';
  }

  // =========================================================================
  // TAB 1: Prioritized Findings & Repair Guide
  // =========================================================================
  function renderFindingsTab(run) {
    const container = document.getElementById('findings-container');
    if (!run || !run.analysis) return;

    const priFilter = document.getElementById('filter-priority').value;
    const pillarFilter = document.getElementById('filter-pillar').value;
    const evFilter = document.getElementById('filter-evidence').value;

    const dispositions =
      run.analysis.editorialStudio?.humanReview?.findingDispositions || {};

    const filtered = (run.analysis.findings || []).filter((f) => {
      if (priFilter !== 'ALL' && f.priority !== priFilter) return false;
      if (pillarFilter !== 'ALL' && f.pillar !== pillarFilter) return false;
      if (evFilter === 'Deterministic' && !f.evidenceType.startsWith('Deterministic')) return false;
      if (evFilter === 'Heuristic' && !f.evidenceType.startsWith('Heuristic')) return false;
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="panel">
          <h3 class="panel-heading">No findings match the current filter</h3>
          <p class="panel-desc" style="margin:0;">
            ${
              run.analysis.findings.length === 0
                ? 'All checked rules across Accessibility, Usability, Performance, and Search Visibility passed on the inspected pages.'
                : 'Try broadening the Priority, Pillar, or Evidence Class filter above.'
            }
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered
      .map((f) => {
        const badgeClass =
          f.priority === 'P1' ? 'badge-p1' : f.priority === 'P2' ? 'badge-p2' : 'badge-p3';
        const isDeterministic = f.evidenceType.startsWith('Deterministic');
        const evBadgeClass = isDeterministic ? 'badge-deterministic' : 'badge-heuristic';
        const disp = dispositions[f.id]?.status || 'queued';

        return `
          <article class="finding-card" data-priority="${escapeHtml(f.priority)}">
            <div class="finding-header">
              <div class="badge-row">
                <span class="badge ${badgeClass}">${escapeHtml(f.priorityLabel)}</span>
                <span class="badge badge-pillar">${escapeHtml(f.pillar)}</span>
                <span class="badge ${evBadgeClass}">${escapeHtml(f.evidenceType)}</span>
                <span class="badge badge-pillar">${f.affectedUrls.length} Affected URL${f.affectedUrls.length === 1 ? '' : 's'}</span>
              </div>
              <span class="code-chip">${escapeHtml(f.id)}</span>
            </div>

            <h3 class="finding-title">${escapeHtml(f.title)}</h3>

            <p style="margin: 0 0 0.75rem; color: var(--ink-secondary); font-size: 0.91rem;">
              <strong>Why this matters:</strong> ${escapeHtml(f.whyItMatters)}
            </p>

            <div class="finding-box" style="margin-bottom: 0.75rem; background: #FCFBF9;">
              <span class="finding-box-label">Preserving Studio Voice &amp; Visual Intent</span>
              <div style="font-size: 0.87rem;">${escapeHtml(f.voiceAndIntentNote)}</div>
            </div>

            <div class="finding-grid">
              <div class="finding-box">
                <span class="finding-box-label">Concrete Repair</span>
                <div style="font-size: 0.87rem;">${escapeHtml(f.concreteRepair)}</div>
              </div>
              <div class="finding-box">
                <span class="finding-box-label">How to Verify</span>
                <div style="font-size: 0.87rem;">${escapeHtml(f.howToVerify)}</div>
              </div>
            </div>

            <details open>
              <summary style="cursor: pointer; font-weight: 600; font-size: 0.85rem; color: var(--ink-secondary);">
                Cited URLs &amp; Observed Evidence (${f.affectedUrls.length})
              </summary>
              <ul class="evidence-list">
                ${f.affectedUrls
                  .map(
                    (u) => `
                  <li>
                    <strong><a href="${escapeHtml(u.url)}" target="_blank" rel="noopener">${escapeHtml(u.url)}</a></strong>
                    <br>
                    <span class="code-chip">${escapeHtml(u.evidence)}</span>
                  </li>
                `
                  )
                  .join('')}
              </ul>
            </details>

            <div class="disposition-bar">
              <span><strong>Studio Review Decision:</strong> Classify how the design &amp; content team wants to treat this finding:</span>
              <div class="field-group" style="flex-direction: row; align-items: center; gap: 0.5rem;">
                <label for="disp-${escapeHtml(f.id)}">Disposition:</label>
                <select
                  id="disp-${escapeHtml(f.id)}"
                  class="disposition-select"
                  data-rule-id="${escapeHtml(f.id)}"
                >
                  <option value="queued" ${disp === 'queued' ? 'selected' : ''}>Queued for Repair</option>
                  <option value="intentional" ${disp === 'intentional' ? 'selected' : ''}>Intentional Expressive Choice (Documented)</option>
                  <option value="verified" ${disp === 'verified' ? 'selected' : ''}>Verified with Assistive Tech / Visual Check</option>
                </select>
              </div>
            </div>
          </article>
        `;
      })
      .join('');

    // Attach listeners to disposition selects
    for (const sel of container.querySelectorAll('.disposition-select')) {
      sel.addEventListener('change', async (e) => {
        const ruleId = e.target.getAttribute('data-rule-id');
        const status = e.target.value;
        await saveEditorialDisposition(ruleId, status);
      });
    }
  }

  async function saveEditorialDisposition(ruleId, status) {
    if (!activeRun) return;
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(activeRun.runId)}/editorial`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findingDispositions: {
            [ruleId]: { status, updatedAt: new Date().toISOString() }
          }
        })
      });
      if (res.ok) {
        activeRun = await res.json();
        setStatus(`Saved studio disposition for ${ruleId}: "${status}".`, 'success');
      }
    } catch (err) {
      setStatus(`Failed to save disposition: ${err.message}`, 'error');
    }
  }

  // =========================================================================
  // TAB 2: Design, Voice & Editorial Review Studio
  // =========================================================================
  function renderEditorialTab(run) {
    const container = document.getElementById('editorial-container');
    const studio = run?.analysis?.editorialStudio;
    if (!studio) return;

    const hr = studio.humanReview || {};
    const checklistStates = hr.checklistStates || {};

    container.innerHTML = `
      <div class="panel" style="margin-bottom: 1.25rem;">
        <h2 class="panel-heading">Design, Voice &amp; Editorial Review Worksheet</h2>
        <p class="panel-desc">${escapeHtml(studio.purpose)}</p>

        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.25rem;">
          <div>
            <h3 style="font-size: 0.95rem; margin: 0 0 0.65rem;">Human Review Checkpoints</h3>
            ${studio.reviewPrompts
              .map(
                (p) => `
              <div class="finding-box" style="margin-bottom: 0.65rem;">
                <label style="display: flex; align-items: flex-start; gap: 0.6rem; cursor: pointer;">
                  <input
                    type="checkbox"
                    class="editorial-checkpoint-cb"
                    data-prompt-id="${escapeHtml(p.id)}"
                    ${checklistStates[p.id] ? 'checked' : ''}
                    style="margin-top: 0.25rem;"
                  >
                  <span>
                    <strong style="display: block; font-size: 0.88rem;">[${escapeHtml(p.category)}] ${escapeHtml(p.question)}</strong>
                    <span style="font-size: 0.81rem; color: var(--ink-secondary);">${escapeHtml(p.guidance)}</span>
                  </span>
                </label>
              </div>
            `
              )
              .join('')}
          </div>

          <div>
            <h3 style="font-size: 0.95rem; margin: 0 0 0.65rem;">Studio Curatorial &amp; Editorial Notes</h3>
            <div class="field-group" style="margin-bottom: 0.75rem;">
              <label for="editorial-reviewer-name">Design / Editorial Reviewer</label>
              <input
                id="editorial-reviewer-name"
                type="text"
                value="${escapeHtml(hr.reviewerName || '')}"
                placeholder="e.g., Clara Vance, Design Director"
              >
            </div>
            <div class="field-group" style="margin-bottom: 0.75rem;">
              <label for="editorial-studio-notes">Voice Preservation &amp; Repair Notes (Saved with Snapshot)</label>
              <textarea
                id="editorial-studio-notes"
                rows="6"
                placeholder="Document intentional typographic choices (e.g., minimalist colophon without meta description) or copy direction for missing artwork alt text…"
              >${escapeHtml(hr.studioNotes || '')}</textarea>
            </div>
            <button id="btn-save-editorial-notes" type="button" class="btn btn-primary">
              Save Design &amp; Editorial Review
            </button>
          </div>
        </div>
      </div>

      <!-- Search & Social Snippet Previews -->
      <div class="panel" style="margin-bottom: 1.25rem;">
        <h2 class="panel-heading">Search &amp; Social Snippet Previews (Voice &amp; Metadata Check)</h2>
        <p class="panel-desc">
          Compares authored <code>&lt;meta name="description"&gt;</code> tags against organic body prose fallbacks so editors only write descriptions where they genuinely improve the snippet.
        </p>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Page Path</th>
                <th>Search Snippet Preview (Title, Breadcrumb &amp; Effective Summary)</th>
                <th>Snippet Source</th>
                <th>OpenGraph &amp; JSON-LD Schema</th>
              </tr>
            </thead>
            <tbody>
              ${studio.snippetPreviews
                .map(
                  (s) => `
                <tr>
                  <td>
                    <strong><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.pathname)}</a></strong>
                    <div style="font-size: 0.76rem; color: var(--ink-muted); margin-top: 0.25rem;">
                      Canonical: <code>${escapeHtml(s.canonical)}</code>
                    </div>
                  </td>
                  <td>
                    <div class="serp-preview">
                      <div class="serp-url">${escapeHtml(s.url)}</div>
                      <div class="serp-title">${escapeHtml(s.title)}</div>
                      <div class="serp-desc">${escapeHtml(s.snippetText)}</div>
                    </div>
                  </td>
                  <td>
                    <span class="badge ${s.hasAuthoredDescription ? 'badge-p3' : 'badge-p2'}">
                      ${escapeHtml(s.descriptionSource)}
                    </span>
                    <div style="font-size: 0.77rem; color: var(--ink-muted); margin-top: 0.3rem;">
                      Title: ${s.titleLength} chars ${s.hasAuthoredDescription ? `· Desc: ${s.descriptionLength} chars` : ''}
                    </div>
                  </td>
                  <td>
                    <div>
                      OpenGraph: <strong>${s.ogReady ? 'Complete (Title, Desc, Image)' : 'Incomplete'}</strong>
                    </div>
                    <div style="margin-top: 0.25rem;">
                      JSON-LD Schema:
                      ${
                        s.schemaTypes.length > 0
                          ? s.schemaTypes.map((t) => `<span class="code-chip">${escapeHtml(t)}</span>`).join(' ')
                          : '<span style="color: var(--ink-muted);">None declared</span>'
                      }
                    </div>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Heading Cadence & Typographic Architecture -->
      <div class="panel" style="margin-bottom: 1.25rem;">
        <h2 class="panel-heading">Heading Cadence &amp; Typographic Architecture</h2>
        <p class="panel-desc">
          Inspect the semantic H1–H6 outline alongside extracted CSS font families and word counts per page.
        </p>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Detected Font Stacks &amp; Word Count</th>
                <th>Document Heading Outline (H1–H6)</th>
              </tr>
            </thead>
            <tbody>
              ${studio.typographyAndHierarchy
                .map(
                  (t) => `
                <tr>
                  <td><strong>${escapeHtml(t.pathname)}</strong></td>
                  <td>
                    <div><strong>${t.wordCount}</strong> words</div>
                    <div style="margin-top: 0.3rem; font-size: 0.78rem; color: var(--ink-secondary);">
                      ${
                        t.fontFamilies.length > 0
                          ? t.fontFamilies.map((f) => `<span class="code-chip">${escapeHtml(f)}</span>`).join('<br>')
                          : 'Inherited / external stylesheet'
                      }
                    </div>
                  </td>
                  <td>
                    ${
                      t.headings.length > 0
                        ? `<ul class="heading-tree">
                            ${t.headings
                              .map(
                                (h) =>
                                  `<li class="h-indent-${h.level}"><span class="code-chip">&lt;${escapeHtml(h.tag)}&gt;</span> ${escapeHtml(h.text)}</li>`
                              )
                              .join('')}
                          </ul>`
                        : '<em>No headings detected</em>'
                    }
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Artwork & Photography Alt-Text Ledger -->
      <div class="panel">
        <h2 class="panel-heading">Artwork &amp; Photography Alt-Text Ledger</h2>
        <p class="panel-desc">
          Review every image discovered across inspected pages to verify curatorial descriptions and intrinsic dimensions.
        </p>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>Image Asset (src)</th>
                <th>Alt Status</th>
                <th>Authored Description (alt)</th>
                <th>Intrinsic Dimensions</th>
              </tr>
            </thead>
            <tbody>
              ${
                studio.artworkAltLedger.length === 0
                  ? '<tr><td colspan="5">No &lt;img&gt; elements found on inspected pages.</td></tr>'
                  : studio.artworkAltLedger
                      .map(
                        (img) => `
                    <tr>
                      <td><strong>${escapeHtml(img.pathname)}</strong></td>
                      <td><span class="code-chip">${escapeHtml(img.src)}</span></td>
                      <td>
                        <span class="badge ${img.status.startsWith('Missing') ? 'badge-p1' : 'badge-p3'}">
                          ${escapeHtml(img.status)}
                        </span>
                      </td>
                      <td>${img.altText !== null ? escapeHtml(img.altText || '(Empty string — decorative)') : '<em style="color: var(--p1-ink);">Omitted</em>'}</td>
                      <td><span class="code-chip">${escapeHtml(img.dimensions)}</span></td>
                    </tr>
                  `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    const btnSaveNotes = document.getElementById('btn-save-editorial-notes');
    if (btnSaveNotes) {
      btnSaveNotes.addEventListener('click', async () => {
        const reviewerName = document.getElementById('editorial-reviewer-name').value;
        const studioNotes = document.getElementById('editorial-studio-notes').value;
        const states = {};
        for (const cb of container.querySelectorAll('.editorial-checkpoint-cb')) {
          states[cb.getAttribute('data-prompt-id')] = cb.checked;
        }
        try {
          const res = await fetch(`/api/runs/${encodeURIComponent(activeRun.runId)}/editorial`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reviewerName,
              studioNotes,
              checklistStates: states
            })
          });
          if (res.ok) {
            activeRun = await res.json();
            setStatus('Saved Design, Voice & Editorial Review notes to audit snapshot.', 'success');
          }
        } catch (err) {
          setStatus(`Could not save editorial review: ${err.message}`, 'error');
        }
      });
    }
  }

  // =========================================================================
  // TAB 3: Crawl Coverage, Robots.txt & Sitemap Ledger
  // =========================================================================
  function renderCoverageTab(run) {
    const container = document.getElementById('coverage-container');
    if (!run || !run.crawl) return;
    const c = run.crawl;

    container.innerHTML = `
      <div class="finding-grid" style="margin-top: 0; margin-bottom: 1.25rem;">
        <div class="panel">
          <h2 class="panel-heading">robots.txt &amp; Exclusion Policy</h2>
          <p class="panel-desc">
            Fetched <a href="${escapeHtml(c.robots.url)}" target="_blank" rel="noopener">${escapeHtml(c.robots.url)}</a> (HTTP ${c.robots.status || 'ERR'}) · User-Agent: <code>${escapeHtml(c.limits.userAgent)}</code>
          </p>
          ${
            c.robots.found
              ? `<pre class="demo-status-line" style="white-space: pre-wrap; margin: 0 0 0.75rem;">${escapeHtml(c.robots.rawText)}</pre>`
              : '<p style="font-size: 0.86rem; color: var(--ink-secondary);">No robots.txt file found on origin; all same-origin public links eligible within crawl limits.</p>'
          }
          <h3 style="font-size: 0.88rem; margin: 0.5rem 0;">URLs Excluded by robots.txt (${c.excludedByRobots.length})</h3>
          ${
            c.excludedByRobots.length === 0
              ? '<p style="font-size: 0.84rem; color: var(--ink-muted); margin: 0;">0 discovered URLs were disallowed by robots.txt.</p>'
              : `<ul class="evidence-list">
                  ${c.excludedByRobots
                    .map(
                      (ex) =>
                        `<li><strong>${escapeHtml(ex.url)}</strong> — matched rule <span class="code-chip">${escapeHtml(ex.matchedRule)}</span> (discovered from ${escapeHtml(ex.discoveredFrom || 'seed')})</li>`
                    )
                    .join('')}
                </ul>`
          }
        </div>

        <div class="panel">
          <h2 class="panel-heading">sitemap.xml Alignment</h2>
          <p class="panel-desc">
            Fetched <a href="${escapeHtml(c.sitemap.url)}" target="_blank" rel="noopener">${escapeHtml(c.sitemap.url)}</a> (HTTP ${c.sitemap.status || 'ERR'})
          </p>
          ${
            c.sitemap.found
              ? `
                <ul class="evidence-list" style="margin-top: 0;">
                  <li><strong>Total URLs listed in sitemap:</strong> ${c.sitemap.totalListed}</li>
                  <li><strong>Covered in this crawl:</strong> ${c.sitemap.coveredInCrawlCount}</li>
                  <li><strong>Uncrawled sitemap URLs:</strong> ${c.sitemap.uncrawledUrls.length}</li>
                  <li><strong>Contradictory (Listed in sitemap but blocked by robots.txt):</strong> ${c.sitemap.blockedByRobotsUrls.length}</li>
                </ul>
              `
              : '<p style="font-size: 0.86rem; color: var(--ink-secondary);">No XML sitemap found at /sitemap.xml or declared in robots.txt.</p>'
          }
        </div>
      </div>

      <!-- Inspected Pages Table -->
      <div class="panel" style="margin-bottom: 1.25rem;">
        <h2 class="panel-heading">Inspected Same-Origin Pages (${c.inspectedPages.length} of max ${c.limits.maxPages})</h2>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>URL</th>
                <th>HTTP Status</th>
                <th>Depth</th>
                <th>Response Time</th>
                <th>HTML Payload</th>
                <th>Language</th>
                <th>Images / Links</th>
              </tr>
            </thead>
            <tbody>
              ${c.inspectedPages
                .map(
                  (p) => `
                <tr>
                  <td>
                    <strong><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(p.url)}</a></strong>
                    ${p.discoveredFrom ? `<div style="font-size: 0.75rem; color: var(--ink-muted);">From: ${escapeHtml(p.discoveredFrom)}</div>` : '<div style="font-size: 0.75rem; color: var(--ink-muted);">Seed URL</div>'}
                  </td>
                  <td><span class="badge badge-p3">HTTP ${p.status}</span></td>
                  <td>Depth ${p.depth}</td>
                  <td>${p.elapsedMs} ms</td>
                  <td>${(p.byteLength / 1024).toFixed(1)} KB</td>
                  <td><code>${escapeHtml(p.signals.htmlLang || '(missing)')}</code></td>
                  <td>${p.signals.images.length} img · ${p.signals.links.length} links</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Failed Requests & Skipped by Limits -->
      <div class="finding-grid">
        <div class="panel">
          <h3 class="panel-heading">Failed Requests / Broken Internal Links (${c.failedRequests.length})</h3>
          ${
            c.failedRequests.length === 0
              ? '<p style="font-size: 0.85rem; color: var(--ink-muted); margin: 0;">0 failed requests or broken internal links.</p>'
              : `<ul class="evidence-list">
                  ${c.failedRequests
                    .map(
                      (f) =>
                        `<li><strong>${escapeHtml(f.url)}</strong> — <span class="badge badge-p1">HTTP ${f.status || 'ERR'}</span> (Referred from ${escapeHtml(f.discoveredFrom || 'seed')})</li>`
                    )
                    .join('')}
                </ul>`
          }
        </div>

        <div class="panel">
          <h3 class="panel-heading">Skipped by Crawl Limits (${c.skippedByLimit.length}) &amp; External Links (${c.externalLinks.length})</h3>
          ${
            c.skippedByLimit.length === 0
              ? '<p style="font-size: 0.85rem; color: var(--ink-muted); margin-top: 0;">All discovered allowed same-origin pages fit within maxPages/maxDepth limits.</p>'
              : `<ul class="evidence-list">
                  ${c.skippedByLimit
                    .map((s) => `<li><strong>${escapeHtml(s.url)}</strong> — ${escapeHtml(s.reason)}</li>`)
                    .join('')}
                </ul>`
          }
          <h4 style="font-size: 0.84rem; margin: 0.75rem 0 0.35rem;">Off-Origin External Links Discovered (Not Crawled: ${c.externalLinks.length})</h4>
          ${
            c.externalLinks.length === 0
              ? '<p style="font-size: 0.84rem; color: var(--ink-muted); margin: 0;">None discovered.</p>'
              : `<ul class="evidence-list">
                  ${c.externalLinks
                    .slice(0, 12)
                    .map((e) => `<li><code>${escapeHtml(e.url)}</code> (on ${escapeHtml(e.discoveredFrom)})</li>`)
                    .join('')}
                </ul>`
          }
        </div>
      </div>
    `;
  }

  // =========================================================================
  // TAB 4: Rerun & Compare (Before / After Diff)
  // =========================================================================
  function renderComparisonResult(diff) {
    const container = document.getElementById('compare-results-container');
    if (!diff) return;

    container.innerHTML = `
      <div class="panel" style="margin-bottom: 1.25rem;">
        <h3 class="panel-heading">Comparison Summary: ${escapeHtml(diff.baseline.label)} → ${escapeHtml(diff.current.label)}</h3>
        <p class="panel-desc">
          Grouped findings moved from <strong>${diff.baseline.totalGroupedFindings}</strong> (${diff.baseline.totalOccurrences} URL occurrences) to <strong>${diff.current.totalGroupedFindings}</strong> (${diff.current.totalOccurrences} URL occurrences).
          Pages inspected: ${diff.coverageDelta.inspectedPages.before} → ${diff.coverageDelta.inspectedPages.after} · Broken internal requests: ${diff.coverageDelta.failedRequests.before} → ${diff.coverageDelta.failedRequests.after}.
        </p>

        <div class="ledger-strip" style="margin-bottom: 0; grid-template-columns: repeat(4, 1fr);">
          <div class="ledger-card" style="background: var(--resolved-bg); border-color: var(--resolved-border);">
            <span class="ledger-label" style="color: var(--resolved-ink);">Completely Resolved</span>
            <strong class="ledger-value" style="color: var(--resolved-ink);">${diff.counts.resolvedCount}</strong>
            <span class="ledger-note">0 remaining occurrences</span>
          </div>
          <div class="ledger-card">
            <span class="ledger-label">Reduced Scope</span>
            <strong class="ledger-value">${diff.counts.improvedCount}</strong>
            <span class="ledger-note">Fewer affected URLs</span>
          </div>
          <div class="ledger-card">
            <span class="ledger-label">New or Regressed</span>
            <strong class="ledger-value" style="color: var(--p1-ink);">${diff.counts.newCount + diff.counts.regressedCount}</strong>
            <span class="ledger-note">Introduced or expanded</span>
          </div>
          <div class="ledger-card">
            <span class="ledger-label">Unchanged / Intentional</span>
            <strong class="ledger-value">${diff.counts.unchangedCount}</strong>
            <span class="ledger-note">Persisting across runs</span>
          </div>
        </div>
      </div>

      <!-- Resolved Findings List -->
      <div class="panel" style="margin-bottom: 1.25rem;">
        <h3 class="panel-heading" style="color: var(--resolved-ink);">Verified Resolved Findings (${diff.resolved.length})</h3>
        ${
          diff.resolved.length === 0
            ? '<p style="font-size: 0.86rem; color: var(--ink-muted); margin: 0;">No findings were completely eliminated between these two snapshots.</p>'
            : `<div class="data-table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Priority &amp; Pillar</th>
                      <th>Rule &amp; Finding Title</th>
                      <th>Verified Repaired URLs</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${diff.resolved
                      .map(
                        (r) => `
                      <tr>
                        <td><span class="badge" style="background: var(--resolved-bg); border: 1px solid var(--resolved-border); color: var(--resolved-ink);">RESOLVED (${r.beforeCount} → 0)</span></td>
                        <td><span class="badge badge-${r.priority.toLowerCase()}">${escapeHtml(r.priority)}</span> <span class="badge badge-pillar">${escapeHtml(r.pillar)}</span></td>
                        <td>
                          <strong>${escapeHtml(r.title)}</strong>
                          <div><span class="code-chip">${escapeHtml(r.id)}</span></div>
                        </td>
                        <td>${r.resolvedUrls.map((u) => `<div><code>${escapeHtml(u)}</code></div>`).join('')}</td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>`
        }
      </div>

      <!-- Unchanged / Intentional Refinements -->
      <div class="panel">
        <h3 class="panel-heading">Unchanged &amp; Remaining Findings (${diff.unchanged.length + diff.improved.length + diff.newFindings.length + diff.regressed.length})</h3>
        ${
          diff.unchanged.length === 0 && diff.improved.length === 0 && diff.newFindings.length === 0 && diff.regressed.length === 0
            ? '<p style="font-size: 0.86rem; color: var(--ink-muted); margin: 0;">0 remaining findings.</p>'
            : `<ul class="evidence-list">
                ${diff.improved
                  .map(
                    (i) =>
                      `<li><strong>[REDUCED: ${i.beforeCount} → ${i.afterCount} URL(s)] [${escapeHtml(i.priority)}] ${escapeHtml(i.id)}</strong> — ${escapeHtml(i.title)}</li>`
                  )
                  .join('')}
                ${diff.unchanged
                  .map(
                    (u) =>
                      `<li><strong>[UNCHANGED: ${u.afterCount} URL(s)] [${escapeHtml(u.priority)}] ${escapeHtml(u.id)}</strong> — ${escapeHtml(u.title)} (${u.remainingUrls.join(', ')})</li>`
                  )
                  .join('')}
                ${diff.newFindings
                  .map(
                    (n) =>
                      `<li><strong>[NEW: 0 → ${n.afterCount} URL(s)] [${escapeHtml(n.priority)}] ${escapeHtml(n.id)}</strong> — ${escapeHtml(n.title)}</li>`
                  )
                  .join('')}
              </ul>`
        }
      </div>
    `;
  }

  // =========================================================================
  // TAB 5: Unavailable Evidence & Optional Telemetry Slots
  // =========================================================================
  function renderBoundariesTab(run) {
    const container = document.getElementById('boundaries-container');
    const b = run?.analysis?.evidenceBoundaries;
    if (!b) return;

    const sc = b.optionalIntegrations.searchConsole;
    const mp = b.optionalIntegrations.measuredPerformance;

    container.innerHTML = `
      <div class="finding-grid" style="margin-top: 0; margin-bottom: 1.25rem;">
        <div class="panel">
          <h2 class="panel-heading">Directly Observed in Zero-Credential Crawl</h2>
          <p class="panel-desc">Every finding in Tab 1 cites deterministic HTTP or DOM evidence from this list:</p>
          <ul class="evidence-list">
            ${b.observedDirectly.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>

        <div class="panel">
          <h2 class="panel-heading">Unavailable Evidence (Explicitly Labeled — Never Invented)</h2>
          <p class="panel-desc">ContextMuse refuses to fabricate synthetic scores or claim heuristics prove WCAG conformance:</p>
          ${b.unavailableInZeroCredentialCrawl
            .map(
              (u) => `
            <div class="finding-box" style="margin-bottom: 0.65rem;">
              <strong style="display: block; font-size: 0.86rem;">${escapeHtml(u.category)}</strong>
              <span style="font-size: 0.82rem; color: var(--ink-secondary);">${escapeHtml(u.reason)}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <!-- Optional External Data Slots (Search Console & Measured Performance) -->
      <div class="panel">
        <h2 class="panel-heading">Optional Telemetry Slots (Search Console &amp; Measured Lab/Field Performance)</h2>
        <p class="panel-desc">
          While the core audit works 100% locally without accounts or API keys, you can attach an exported Search Console JSON payload or a measured Web Vitals / Lighthouse JSON snapshot to enrich this run record.
        </p>

        <div class="finding-grid">
          <div class="finding-box">
            <span class="finding-box-label">Slot 1 · Search Console Query &amp; Indexing Export</span>
            <p style="font-size: 0.83rem; margin: 0.25rem 0 0.65rem;">
              Status: <strong>${escapeHtml(sc.status.toUpperCase())}</strong>
            </p>
            ${
              sc.data
                ? `<pre class="demo-status-line" style="white-space: pre-wrap; max-height: 160px; overflow: auto;">${escapeHtml(JSON.stringify(sc.data, null, 2))}</pre>`
                : ''
            }
            <div class="field-group" style="margin-top: 0.5rem;">
              <label for="input-sc-json">Paste Search Console JSON Summary (Optional)</label>
              <textarea id="input-sc-json" rows="3" placeholder='{"topQueries":[{"query":"atelier nocturne monographs","clicks":142,"impressions":1890}],"indexedPages":4}'></textarea>
            </div>
            <button id="btn-attach-sc" type="button" class="btn btn-secondary" style="margin-top: 0.5rem;">
              Attach Search Console Data
            </button>
          </div>

          <div class="finding-box">
            <span class="finding-box-label">Slot 2 · Measured Performance / Core Web Vitals JSON</span>
            <p style="font-size: 0.83rem; margin: 0.25rem 0 0.65rem;">
              Status: <strong>${escapeHtml(mp.status.toUpperCase())}</strong>
            </p>
            ${
              mp.data
                ? `<pre class="demo-status-line" style="white-space: pre-wrap; max-height: 160px; overflow: auto;">${escapeHtml(JSON.stringify(mp.data, null, 2))}</pre>`
                : ''
            }
            <div class="field-group" style="margin-top: 0.5rem;">
              <label for="input-mp-json">Paste Measured Lab/Field Web Vitals JSON (Optional)</label>
              <textarea id="input-mp-json" rows="3" placeholder='{"source":"Chrome DevTools Lab Trace","LCP_ms":1180,"CLS":0.01,"INP_ms":48}'></textarea>
            </div>
            <button id="btn-attach-mp" type="button" class="btn btn-secondary" style="margin-top: 0.5rem;">
              Attach Measured Performance Data
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-attach-sc')?.addEventListener('click', () =>
      attachIntegrationJson('searchConsole', document.getElementById('input-sc-json').value)
    );
    document.getElementById('btn-attach-mp')?.addEventListener('click', () =>
      attachIntegrationJson('measuredPerformance', document.getElementById('input-mp-json').value)
    );
  }

  async function attachIntegrationJson(slotType, rawText) {
    if (!activeRun) return;
    let parsed;
    try {
      parsed = rawText.trim()
        ? JSON.parse(rawText)
        : slotType === 'searchConsole'
        ? {
            source: 'Manual Search Console Sample Import',
            topQueries: [{ query: 'atelier nocturne spatial monographs', clicks: 142, impressions: 1890 }],
            indexedCanonicalPages: 4
          }
        : {
            source: 'Measured Browser Trace Import',
            LCP_ms: 1180,
            CLS: 0.01,
            INP_ms: 48
          };
    } catch (err) {
      setStatus(`Invalid JSON for ${slotType}: ${err.message}`, 'error');
      return;
    }

    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(activeRun.runId)}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotType, data: parsed })
      });
      if (res.ok) {
        activeRun = await res.json();
        renderBoundariesTab(activeRun);
        setStatus(`Attached optional ${slotType} data to snapshot ${activeRun.runId}.`, 'success');
      }
    } catch (err) {
      setStatus(`Failed to attach integration data: ${err.message}`, 'error');
    }
  }

  function renderActiveRun(run) {
    activeRun = run;
    renderSummaryStrip(run);
    renderFindingsTab(run);
    renderEditorialTab(run);
    renderCoverageTab(run);
    renderBoundariesTab(run);
  }

  // Event Listeners
  document.getElementById('filter-priority').addEventListener('change', () => renderFindingsTab(activeRun));
  document.getElementById('filter-pillar').addEventListener('change', () => renderFindingsTab(activeRun));
  document.getElementById('filter-evidence').addEventListener('change', () => renderFindingsTab(activeRun));

  // Submit Audit Form
  document.getElementById('audit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const startUrl = document.getElementById('input-start-url').value.trim();
    const maxPages = parseInt(document.getElementById('input-max-pages').value, 10) || 10;
    const maxDepth = parseInt(document.getElementById('input-max-depth').value, 10) || 3;
    const timeoutMs = parseInt(document.getElementById('input-timeout').value, 10) || 8000;
    const label = document.getElementById('input-run-label').value.trim();

    const btn = document.getElementById('btn-run-audit');
    btn.disabled = true;
    setStatus(`Crawling same-origin pages starting from ${startUrl} (respecting robots.txt)…`);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startUrl, maxPages, maxDepth, timeoutMs, label })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Audit failed.');

      await refreshStatus();
      renderActiveRun(data);
      switchTab('tabbtn-findings');
      setStatus(
        `Completed audit of ${data.crawl.startUrl}: ${data.crawl.coverage.inspectedCount} page(s) inspected, ${data.analysis.summary.totalGroupedFindings} grouped finding(s).`,
        'success'
      );
    } catch (err) {
      setStatus(`Audit error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Load saved run
  selectSavedRun.addEventListener('change', async (e) => {
    const runId = e.target.value;
    if (!runId) return;
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(runId)}`);
      if (res.ok) {
        const run = await res.json();
        renderActiveRun(run);
        setStatus(`Loaded saved snapshot: ${run.label}`, 'neutral');
      }
    } catch (err) {
      setStatus(`Failed to load snapshot: ${err.message}`, 'error');
    }
  });

  // Toggle offline demo fixture state ('before' <-> 'after')
  document.getElementById('btn-toggle-demo-mode').addEventListener('click', async () => {
    const nextMode = demoFixtureInfo.mode === 'before' ? 'after' : 'before';
    try {
      const res = await fetch('/api/demo/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: nextMode })
      });
      if (res.ok) {
        demoFixtureInfo = await res.json();
        updateDemoStatusBanner();
        setStatus(
          `Switched offline Atelier Nocturne demo site (${demoFixtureInfo.origin}/) to "${nextMode.toUpperCase()}" state.`,
          'neutral'
        );
      }
    } catch (err) {
      setStatus(`Failed to switch demo mode: ${err.message}`, 'error');
    }
  });

  // One-click Reproducible Offline Demo: Before -> Repair -> Compare After
  document.getElementById('btn-demo-before-after').addEventListener('click', async () => {
    const btn = document.getElementById('btn-demo-before-after');
    btn.disabled = true;
    setStatus('Running offline reproducible audit on Atelier Nocturne (Baseline Before Repair → Repaired After Repair → Diff)…');
    try {
      const res = await fetch('/api/demo/before-after', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Demo execution failed');

      if (data.demoFixture) {
        demoFixtureInfo = data.demoFixture;
        updateDemoStatusBanner();
      }
      await refreshStatus();

      // Display the Baseline run in findings first, and populate the Comparison tab with the Before->After diff
      renderActiveRun(data.baselineRun);
      compareBaselineSelect.value = data.baselineRun.runId;
      compareCurrentSelect.value = data.repairedRun.runId;
      renderComparisonResult(data.comparison);

      setStatus(
        `Offline Before/After Demo ready: Baseline found ${data.baselineRun.analysis.summary.totalGroupedFindings} grouped issues (${data.baselineRun.crawl.coverage.excludedByRobotsCount} robots.txt exclusion). Repaired state resolved ${data.comparison.counts.resolvedCount} issues while preserving the intentional P3 colophon note. Inspect Tab 1 & Tab 4!`,
        'success'
      );
    } catch (err) {
      setStatus(`Demo error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Compare two selected runs
  document.getElementById('btn-run-compare').addEventListener('click', async () => {
    const baselineRunId = compareBaselineSelect.value;
    const currentRunId = compareCurrentSelect.value;
    if (!baselineRunId || !currentRunId) {
      setStatus('Select both a Baseline run and a Comparison run.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baselineRunId, currentRunId })
      });
      const diff = await res.json();
      if (!res.ok) throw new Error(diff.error || 'Comparison failed');
      renderComparisonResult(diff);
      switchTab('tabbtn-compare');
      setStatus(`Compared ${diff.baseline.label} against ${diff.current.label}.`, 'success');
    } catch (err) {
      setStatus(`Comparison error: ${err.message}`, 'error');
    }
  });

  // Quick Rerun Current URL & Compare button
  btnRerunQuick.addEventListener('click', async () => {
    if (!activeRun) return;
    const previousRunId = activeRun.runId;
    const startUrl = activeRun.crawl.startUrl;
    btnRerunQuick.disabled = true;
    setStatus(`Rerunning audit on ${startUrl} and comparing against snapshot ${previousRunId}…`);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrl,
          maxPages: activeRun.crawl.limits.maxPages,
          maxDepth: activeRun.crawl.limits.maxDepth,
          timeoutMs: activeRun.crawl.limits.timeoutMs,
          label: `Rerun: ${new URL(startUrl).host} (${new Date().toLocaleTimeString()})`
        })
      });
      const newRun = await res.json();
      if (!res.ok) throw new Error(newRun.error || 'Rerun failed');

      await refreshStatus();
      renderActiveRun(newRun);

      const compRes = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baselineRunId: previousRunId, currentRunId: newRun.runId })
      });
      if (compRes.ok) {
        const diff = await compRes.json();
        compareBaselineSelect.value = previousRunId;
        compareCurrentSelect.value = newRun.runId;
        renderComparisonResult(diff);
        switchTab('tabbtn-compare');
        setStatus(
          `Rerun complete: ${diff.counts.resolvedCount} resolved, ${diff.counts.improvedCount} reduced, ${diff.counts.unchangedCount} unchanged.`,
          'success'
        );
      }
    } catch (err) {
      setStatus(`Rerun error: ${err.message}`, 'error');
    } finally {
      btnRerunQuick.disabled = false;
    }
  });

  refreshStatus();
})();
