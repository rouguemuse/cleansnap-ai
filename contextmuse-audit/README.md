# ContextMuse — Expressive Website Audit & Editorial Review Studio (Local MVP)

A zero-credential, local website audit workspace built for **ContextMuse**, a design and research studio managing expressive client and monograph websites.

ContextMuse helps studio teams decide **which repairs to make first** across **Accessibility, Usability, Performance, and Search Visibility** while preserving each site's typographic craft, editorial voice, and visual intent.

---

## Quick Launch on Windows

Requires **Node.js 18+** (tested with Node.js v24.14.1 on Windows). Zero third-party `npm` install steps or external API credentials are required.

### Option 1 — Double-Click or Run the Windows Launcher
From File Explorer or PowerShell:
```powershell
cd c:\Users\rougu\Documents\antigravity\bold-oppenheimer\contextmuse-audit
.\start-contextmuse.bat
```
Or start the server directly with Node.js:
```powershell
cd c:\Users\rougu\Documents\antigravity\bold-oppenheimer\contextmuse-audit
npm start
```
Then open **`http://127.0.0.1:4173`** in your browser.
- The main ContextMuse Audit Studio UI runs at **`http://127.0.0.1:4173`**.
- The companion offline reproducible sample website (*Atelier Nocturne — Spatial Monographs & Exhibition Archive*) automatically runs at **`http://127.0.0.1:4174/`**.

### Option 2 — Run the Reproducible Before/After Demo via CLI
```powershell
cd c:\Users\rougu\Documents\antigravity\bold-oppenheimer\contextmuse-audit
npm run demo
```

### Option 3 — Audit Any Live Website via CLI
```powershell
node src/cli.js --url https://example.com --max-pages 10 --max-depth 3
```

### Option 4 — Run the Automated Verification Test Suite
```powershell
cd c:\Users\rougu\Documents\antigravity\bold-oppenheimer\contextmuse-audit
npm test
```

---

## Core Architecture & Design Principles

1. **Bounded, Robots-Respecting Same-Origin Crawler (`src/crawler.js`, `src/robots.js`)**:
   - Inspects `/robots.txt` and `/sitemap.xml` on the origin first.
   - Enforces explicit user-configurable limits (`maxPages`, `maxDepth`, `timeoutMs`).
   - Honors `Disallow` / `Allow` rules for `User-agent: *` and `ContextMuseAudit`, recording every excluded URL and its matched rule in the **Coverage Ledger**.
   - Never crawls off-origin external domains (records them for reference only).
2. **Unified 4-Pillar Prioritized Report (`src/analyzer.js`)**:
   - Evaluates **Accessibility**, **Usability**, **Performance**, and **Search Visibility** in one cohesive report.
   - **Groups related findings** across all inspected pages so site-wide issues appear once with every affected URL and exact DOM/HTTP evidence snippet cited.
   - **Priority Tiers**:
     - `P1 — Structural Blockers & Broken Journeys` (broken internal links returning 4xx/5xx, unlabeled form inputs, disabled viewport zoom, missing `<title>`, malformed JSON-LD, robots-blocked URLs listed in `sitemap.xml`).
     - `P2 — High-Leverage Craft & Structural Polish` (images missing `alt`, images missing intrinsic `width`/`height`, synchronous render-blocking `<script>` in `<head>`, missing `<html lang>`, broken in-page `#fragment` targets, duplicate `<title>` across pages, missing canonicals).
     - `P3 — Contextual Refinements & Search Enrichment` (missing `<meta name="description">` treated with editorial nuance rather than false urgency, heading hierarchy skips that may reflect visual scale choices, generic link microcopy, incomplete OpenGraph social tags).
3. **Facts vs. Heuristics & Unavailable Evidence (`src/analyzer.js`)**:
   - Every finding is explicitly tagged as either a **`Deterministic Technical Observation`** or a **`Heuristic Signal — Requires Human Review`**.
   - Never invents synthetic 0–100 scores or unmeasured LCP/CLS milliseconds.
   - Provides clean optional JSON attachment slots for **Search Console Exports** and **Measured Lab/Field Performance Traces**.
4. **Design, Voice & Editorial Review Studio (Tab 2)**:
   - Displays **SERP & Social Snippet Previews** comparing authored meta descriptions against organic body prose fallbacks.
   - Shows **Heading Cadence & Typographic Architecture** (`font-family` stacks, word counts, and `H1`–`H6` outlines).
   - Provides an **Artwork & Photography Alt-Text Ledger** and allows reviewers to mark findings as **`Queued for Repair`**, **`Intentional Expressive Choice (Documented)`**, or **`Verified with Assistive Tech`**.
5. **Rerun & Compare Engine (`src/compare.js`)**:
   - Compares any two audit snapshots to verify which findings were **Completely Resolved**, **Reduced in Scope**, **New/Regressed**, or **Unchanged**.
