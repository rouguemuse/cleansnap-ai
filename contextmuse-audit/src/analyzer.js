/**
 * ContextMuse Website Audit — Multi-Pillar Analyzer, Prioritization Engine,
 * Editorial Review Studio Generator, and Evidence Boundary Manifest.
 *
 * Principles:
 * - Search visibility lives alongside Accessibility, Usability, and Performance.
 * - Groups related findings across pages with cited URLs and observed DOM/HTTP evidence.
 * - Separates deterministic technical facts from heuristics requiring human verification.
 * - Never invents metrics, never claims a heuristic proves an accessibility failure,
 *   and never treats every missing meta description as urgent.
 */

const PRIORITY_META = {
  P1: {
    rank: 1,
    code: 'P1',
    label: 'Priority 1 — Structural Blockers & Broken Journeys',
    shortLabel: 'P1 · Structural First',
    description:
      'Broken pathways, unreachable pages, blocked assistive controls, or parser errors that actively prevent visitors or search crawlers from using the site.'
  },
  P2: {
    rank: 2,
    code: 'P2',
    label: 'Priority 2 — High-Leverage Craft & Structural Polish',
    shortLabel: 'P2 · High-Leverage Craft',
    description:
      'Meaningful technical and structural improvements that strengthen image narrative, layout stability, first-paint speed, and canonical clarity while preserving visual design.'
  },
  P3: {
    rank: 3,
    code: 'P3',
    label: 'Priority 3 — Contextual Refinements & Search Enrichment',
    shortLabel: 'P3 · Contextual / Editorial',
    description:
      'Nuanced metadata, typographic hierarchy, and snippet opportunities where editorial judgment decides whether a change serves the page or whether the current treatment is intentional.'
  }
};

function isUtilityOrArchivalPath(urlStr) {
  try {
    const pathname = new URL(urlStr).pathname.toLowerCase();
    return /\/(archive|colophon|imprint|legal|privacy|terms|credits|notes|changelog|draft)(\/|$)/i.test(
      pathname
    );
  } catch {
    return false;
  }
}

function analyzeCrawlResult(crawlResult, options = {}) {
  const pages = crawlResult.inspectedPages || [];
  const findingsMap = new Map();

  function addFindingOccurrence(ruleDef, affectedEntry) {
    if (!findingsMap.has(ruleDef.id)) {
      findingsMap.set(ruleDef.id, {
        id: ruleDef.id,
        title: ruleDef.title,
        pillar: ruleDef.pillar,
        priority: ruleDef.priority,
        priorityLabel: PRIORITY_META[ruleDef.priority].shortLabel,
        evidenceType: ruleDef.evidenceType, // 'Deterministic Technical Observation' | 'Heuristic Signal — Requires Human Review'
        whyItMatters: ruleDef.whyItMatters,
        voiceAndIntentNote: ruleDef.voiceAndIntentNote,
        concreteRepair: ruleDef.concreteRepair,
        howToVerify: ruleDef.howToVerify,
        affectedUrls: []
      });
    }
    const group = findingsMap.get(ruleDef.id);
    group.affectedUrls.push(affectedEntry);
  }

  // =========================================================================
  // 1. USABILITY: Broken Internal Links (HTTP 4xx/5xx or connection error)
  // =========================================================================
  for (const failed of crawlResult.failedRequests || []) {
    const refList =
      failed.referrers && failed.referrers.length > 0
        ? failed.referrers
            .map((r) => `Linked from ${r.fromUrl} via ${r.rawTag}`)
            .join(' | ')
        : failed.discoveredFrom
        ? `Linked from ${failed.discoveredFrom}`
        : 'Seed URL request';

    addFindingOccurrence(
      {
        id: 'USABILITY_BROKEN_INTERNAL_LINK',
        title: 'Broken internal link returns an HTTP error or unreachable response',
        pillar: 'Usability',
        priority: 'P1',
        evidenceType: 'Deterministic Technical Observation',
        whyItMatters:
          'Dead internal links interrupt reader flow across monographs, exhibitions, and essays, and waste crawl budget on non-existent routes.',
        voiceAndIntentNote:
          'If an exhibition or essay has been retired, redirect or link to its archival note rather than dropping the reader onto a generic 404 screen.',
        concreteRepair:
          'Update the <a href="..."> attribute on the referring page(s) to point to the live canonical destination path, or restore the missing route.',
        howToVerify:
          'Click the repaired link in a browser or rerun this audit and confirm the target URL appears under Inspected Pages with HTTP 200 and 0 occurrences under Failed Requests.'
      },
      {
        url: failed.url,
        referrerUrl: failed.discoveredFrom || (failed.referrers?.[0]?.fromUrl ?? null),
        evidence: `HTTP ${failed.status || 'ERR'} (${failed.error || failed.statusText || 'Not Found'}) — ${refList}`
      }
    );
  }

  // Track duplicate titles and meta descriptions across indexable pages
  const titleMap = new Map();
  const descriptionMap = new Map();

  for (const page of pages) {
    const { url, byteLength, signals, xRobotsTag } = page;
    const combinedRobots = `${signals.metaRobots || ''} ${xRobotsTag || ''}`.toLowerCase();
    const isNoindex = combinedRobots.includes('noindex');

    if (!isNoindex) {
      if (signals.title) {
        const normTitle = signals.title.trim();
        if (!titleMap.has(normTitle)) titleMap.set(normTitle, []);
        titleMap.get(normTitle).push({ url, title: signals.title });
      }
      if (signals.metaDescription) {
        const normDesc = signals.metaDescription.trim();
        if (!descriptionMap.has(normDesc)) descriptionMap.set(normDesc, []);
        descriptionMap.get(normDesc).push({ url, description: signals.metaDescription });
      }
    }

    // =========================================================================
    // 2. SEARCH VISIBILITY & USABILITY: Missing <title>
    // =========================================================================
    if (!signals.title) {
      addFindingOccurrence(
        {
          id: 'SEARCH_MISSING_DOCUMENT_TITLE',
          title: 'Document is missing a <title> element',
          pillar: 'Search Visibility',
          priority: 'P1',
          evidenceType: 'Deterministic Technical Observation',
          whyItMatters:
            'The <title> element is the primary label announced by screen readers on page load, displayed in browser tabs, and shown as the clickable headline in search results.',
          voiceAndIntentNote:
            'Use a restrained editorial format such as "Piece or Section Title — Studio Name" without keyword stuffing.',
          concreteRepair:
            'Add a concise, distinctive <title>Page Name — Studio Title</title> inside the document <head>.',
          howToVerify:
            'View page source or rerun the audit to confirm a unique non-empty <title> is extracted in the Search Snippet Preview.'
        },
        {
          url,
          evidence: 'No <title> tag or only whitespace found in <head>.'
        }
      );
    }

    // =========================================================================
    // 3. ACCESSIBILITY: Viewport disables pinch-to-zoom
    // =========================================================================
    if (
      signals.metaViewport &&
      (/user-scalable\s*=\s*(no|0)/i.test(signals.metaViewport) ||
        /maximum-scale\s*=\s*1(\.0)?(\s|,|;|$)/i.test(signals.metaViewport))
    ) {
      addFindingOccurrence(
        {
          id: 'A11Y_VIEWPORT_ZOOM_DISABLED',
          title: 'Viewport meta tag restricts pinch-to-zoom scaling',
          pillar: 'Accessibility',
          priority: 'P1',
          evidenceType: 'Deterministic Technical Observation',
          whyItMatters:
            'Disabling user zoom prevents low-vision readers from enlarging delicate serif or caption typography on mobile and tablet screens.',
          voiceAndIntentNote:
            'Allowing zoom does not alter your default art direction at 1x scale.',
          concreteRepair:
            'Remove user-scalable=no and maximum-scale=1 from <meta name="viewport">, keeping content="width=device-width, initial-scale=1".',
          howToVerify:
            'Inspect <meta name="viewport"> in the page head and verify pinch-to-zoom works on mobile emulation.'
        },
        {
          url,
          evidence: `<meta name="viewport" content="${signals.metaViewport}">`
        }
      );
    }

    // =========================================================================
    // 4. ACCESSIBILITY: Form controls without programmatic label
    // =========================================================================
    const unlabeledControls = (signals.formControls || []).filter((c) => !c.isLabeled);
    if (unlabeledControls.length > 0) {
      addFindingOccurrence(
        {
          id: 'A11Y_UNLABELED_FORM_CONTROL',
          title: 'Interactive form control lacks a programmatic label association',
          pillar: 'Accessibility',
          priority: 'P1',
          evidenceType: 'Heuristic Signal — Verify with Assistive Tech',
          whyItMatters:
            'Inputs without an associated <label>, aria-label, or aria-labelledby leave screen-reader and voice-control users guessing what information to enter. Placeholder text disappears as soon as typing begins.',
          voiceAndIntentNote:
            'If a minimalist newsletter or search bar omits a visible label above the field by design, either style a visually subtle label or add an explicit aria-label="Subscribe with your email address" while keeping the visual layout intact.',
          concreteRepair:
            'Add a <label for="field-id"> matching the input id, wrap the control in a <label>, or provide a descriptive aria-label attribute on the control.',
          howToVerify:
            'Click the label text to confirm it focuses the input, inspect the Accessibility Tree in DevTools to verify the Computed Name is non-empty, and rerun the audit.'
        },
        {
          url,
          evidence: unlabeledControls
            .map(
              (c) =>
                `${c.raw}${c.onlyHasPlaceholder ? ` (relies only on placeholder="${c.placeholder}")` : ''}`
            )
            .join(' ; ')
        }
      );
    }

    // =========================================================================
    // 5. SEARCH VISIBILITY: Invalid JSON-LD Structured Data Syntax
    // =========================================================================
    const invalidJsonLd = (signals.jsonLdBlocks || []).filter((b) => !b.valid);
    if (invalidJsonLd.length > 0) {
      addFindingOccurrence(
        {
          id: 'SEARCH_INVALID_JSON_LD',
          title: 'Malformed JSON-LD structured data block fails JSON parsing',
          pillar: 'Search Visibility',
          priority: 'P1',
          evidenceType: 'Deterministic Technical Observation',
          whyItMatters:
            'Search engines silently ignore <script type="application/ld+json"> blocks that contain trailing commas, unescaped quotes, or syntax errors.',
          voiceAndIntentNote:
            'Structured data lives invisibly in the HTML head or footer and enriches how exhibitions, organizations, and essays are indexed without changing a single visible pixel.',
          concreteRepair:
            'Fix the JSON syntax error inside <script type="application/ld+json"> (ensure strict double-quoted keys/strings and remove trailing commas).',
          howToVerify:
            'Rerun this audit and check the Page Snippet & Schema table to confirm the JSON-LD block parses cleanly and lists its @type.'
        },
        {
          url,
          evidence: invalidJsonLd
            .map((b) => `JSON parse error (${b.error}): ${b.raw}`)
            .join(' | ')
        }
      );
    }

    // =========================================================================
    // 6. ACCESSIBILITY: Images missing alt attribute
    // =========================================================================
    const missingAltImages = (signals.images || []).filter((img) => !img.hasAltAttr);
    if (missingAltImages.length > 0) {
      addFindingOccurrence(
        {
          id: 'A11Y_IMAGE_MISSING_ALT',
          title: 'Image elements lack an alt attribute (heuristic signal)',
          pillar: 'Accessibility',
          priority: 'P2',
          evidenceType: 'Heuristic Signal — Requires Human Review',
          whyItMatters:
            'When an <img> omits the alt attribute entirely, screen readers often read out the raw image file path or hash. Note: An automated check can detect the missing attribute, but only a human editor can judge whether the image conveys curatorial meaning or is purely decorative.',
          voiceAndIntentNote:
            'Write alt text in the studio’s own descriptive voice (e.g., describing medium, composition, and light for artwork). If an image is purely atmospheric grain or a decorative divider, set alt="" so assistive technology skips it cleanly.',
          concreteRepair:
            'Add alt="Concise description of artwork or subject" for meaningful visual content, or alt="" for decorative visual flourishes.',
          howToVerify:
            'Review the updated alt text in the Design & Editorial Review Studio tab to ensure it reads naturally alongside surrounding prose, then rerun the audit.'
        },
        {
          url,
          evidence: `${missingAltImages.length} image(s) missing alt attribute: ${missingAltImages
            .slice(0, 4)
            .map((i) => i.raw)
            .join(' ; ')}`
        }
      );
    }

    // =========================================================================
    // 7. PERFORMANCE & USABILITY: Images missing intrinsic width and height
    // =========================================================================
    const unsizedImages = (signals.images || []).filter((img) => !img.hasDimensions);
    if (unsizedImages.length > 0) {
      addFindingOccurrence(
        {
          id: 'PERF_IMAGE_MISSING_DIMENSIONS',
          title: 'Images omit explicit width and height attributes (layout shift risk)',
          pillar: 'Performance',
          priority: 'P2',
          evidenceType: 'Deterministic Technical Observation',
          whyItMatters:
            'Without intrinsic width and height attributes on <img> elements, the browser cannot reserve the correct aspect-ratio box before the image downloads, causing paragraphs to jump while a visitor is reading.',
          voiceAndIntentNote:
            'HTML width and height attributes establish the natural aspect ratio while your CSS (e.g., width: 100%; height: auto;) continues to control fluid responsive layout.',
          concreteRepair:
            'Add the intrinsic pixel width="..." and height="..." attributes to each <img> element and ensure CSS sets height: auto.',
          howToVerify:
            'Rerun the audit to confirm 0 unsized images, and reload the page on a throttled connection to verify text does not jump when plates load.'
        },
        {
          url,
          evidence: `${unsizedImages.length} image(s) without width/height: ${unsizedImages
            .slice(0, 4)
            .map((i) => i.raw)
            .join(' ; ')}`
        }
      );
    }

    // =========================================================================
    // 8. PERFORMANCE: Render-blocking scripts in <head>
    // =========================================================================
    if (signals.renderBlockingScripts && signals.renderBlockingScripts.length > 0) {
      addFindingOccurrence(
        {
          id: 'PERF_RENDER_BLOCKING_HEAD_SCRIPT',
          title: 'Synchronous <script> in <head> blocks initial HTML parsing and paint',
          pillar: 'Performance',
          priority: 'P2',
          evidenceType: 'Deterministic Technical Observation',
          whyItMatters:
            'External scripts in <head> without defer, async, or type="module" force the browser to pause DOM construction and typography rendering until the script is fetched and executed.',
          voiceAndIntentNote:
            'Adding defer preserves execution order after the document is parsed, keeping interactive motion or gallery lightboxes intact while letting editorial typography paint immediately.',
          concreteRepair:
            'Add the defer attribute to <script src="..." defer></script> in <head>, or use type="module".',
          howToVerify:
            'Inspect the <head> markup and rerun the audit to verify no synchronous render-blocking scripts remain.'
        },
        {
          url,
          evidence: signals.renderBlockingScripts.map((s) => s.raw).join(' ; ')
        }
      );
    }

    // =========================================================================
    // 9. ACCESSIBILITY: Missing <html lang="...">
    // =========================================================================
    if (!signals.htmlLang) {
      addFindingOccurrence(
        {
          id: 'A11Y_MISSING_HTML_LANG',
          title: 'Root <html> element is missing a valid lang attribute',
          pillar: 'Accessibility',
          priority: 'P2',
          evidenceType: 'Deterministic Technical Observation',
          whyItMatters:
            'Screen readers rely on the root lang attribute (e.g., lang="en" or lang="fr") to load the correct phonetic pronunciation rules, and browsers use it for CSS hyphenation and quote styling.',
          voiceAndIntentNote:
            'If a page mixes languages (such as French exhibition titles inside English essays), set the primary language on <html lang="en"> and mark foreign phrases with <span lang="fr">.',
          concreteRepair:
            'Add lang="en" (or the appropriate BCP 47 language tag) to the opening <html lang="en"> tag.',
          howToVerify:
            'Inspect the opening <html> tag in page source and rerun the audit.'
        },
        {
          url,
          evidence: 'Opening <html> tag has no lang="..." attribute.'
        }
      );
    }

    // =========================================================================
    // 10. USABILITY: Broken in-page #fragment anchors
    // =========================================================================
    const pageIdSet = new Set(signals.elementIds || []);
    const brokenFragments = (signals.links || []).filter(
      (l) =>
        l.fragmentId &&
        l.fragmentId.length > 0 &&
        l.fragmentId.toLowerCase() !== 'top' &&
        !pageIdSet.has(l.fragmentId)
    );
    if (brokenFragments.length > 0) {
      addFindingOccurrence(
        {
          id: 'USABILITY_BROKEN_FRAGMENT_ANCHOR',
          title: 'In-page anchor link (#fragment) targets a non-existent element ID',
          pillar: 'Usability',
          priority: 'P2',
          evidenceType: 'Deterministic Technical Observation',
          whyItMatters:
            'Table-of-contents links, footnote jumps, or skip-links pointing to a missing id="#..." fail silently when clicked and fail to move keyboard focus.',
          voiceAndIntentNote:
            'Long-form research essays and monographs often rely on footnote and section jumps; keeping target IDs synchronized preserves scholarly usability.',
          concreteRepair:
            'Ensure the target element on the page carries an id="..." matching the link’s #fragment, or update the link href.',
          howToVerify:
            'Click the anchor link to verify the viewport and focus move to the target section, then rerun the audit.'
        },
        {
          url,
          evidence: brokenFragments
            .map((f) => `${f.raw} (target id="${f.fragmentId}" not found in DOM)`)
            .join(' ; ')
        }
      );
    }

    // =========================================================================
    // 11. ACCESSIBILITY: Missing <main> landmark
    // =========================================================================
    if (!signals.landmarks.hasMainLandmark) {
      addFindingOccurrence(
        {
          id: 'A11Y_MISSING_MAIN_LANDMARK',
          title: 'Document lacks a <main> landmark region (heuristic signal)',
          pillar: 'Accessibility',
          priority: 'P2',
          evidenceType: 'Heuristic Signal — Requires Human Review',
          whyItMatters:
            'A <main> landmark lets assistive technology users jump straight to the primary content of an essay or exhibition without stepping through repeated header navigation.',
          voiceAndIntentNote:
            'Wrapping the primary layout container in <main> is purely semantic and requires zero visual changes.',
          concreteRepair:
            'Wrap the primary page content container in a semantic <main id="main-content"> element.',
          howToVerify:
            'Inspect the DOM or Accessibility Tree to confirm a single main landmark is present.'
        },
        {
          url,
          evidence: 'No <main> tag or role="main" attribute detected in document body.'
        }
      );
    }

    // =========================================================================
    // 12. USABILITY: Missing responsive viewport meta tag
    // =========================================================================
    if (!signals.metaViewport) {
      addFindingOccurrence(
        {
          id: 'USABILITY_MISSING_VIEWPORT_META',
          title: 'Document omits <meta name="viewport"> for responsive layouts',
          pillar: 'Usability',
          priority: 'P2',
          evidenceType: 'Deterministic Technical Observation',
          whyItMatters:
            'Without a viewport meta tag, mobile browsers render the page at a simulated desktop width (~980px) and scale the typography down illegibly.',
          voiceAndIntentNote:
            'Ensure your responsive breakpoints preserve editorial margins and typographic measure on narrow viewports.',
          concreteRepair:
            'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to <head>.',
          howToVerify:
            'Inspect <head> and preview at a 375px mobile viewport width.'
        },
        {
          url,
          evidence: 'No <meta name="viewport"> tag found in <head>.'
        }
      );
    }

    // =========================================================================
    // 13. SEARCH VISIBILITY: Missing canonical link on indexable page
    // =========================================================================
    if (!isNoindex && !signals.canonical) {
      addFindingOccurrence(
        {
          id: 'SEARCH_MISSING_CANONICAL',
          title: 'Indexable page does not declare a canonical URL',
          pillar: 'Search Visibility',
          priority: 'P2',
          evidenceType: 'Deterministic Technical Observation',
          whyItMatters:
            'A self-referencing <link rel="canonical"> prevents duplicate indexing when tracking parameters, trailing slashes, or staging mirrors exist.',
          voiceAndIntentNote:
            'Invisible metadata hygiene that protects search attribution for original studio research and monographs.',
          concreteRepair:
            `Add <link rel="canonical" href="${url}"> inside the <head> of the page.`,
          howToVerify:
            'Rerun the audit and check the Search Visibility metadata ledger for the canonical URL.'
        },
        {
          url,
          evidence: 'No <link rel="canonical" href="..."> found in <head>.'
        }
      );
    }

    // =========================================================================
    // 14. SEARCH VISIBILITY: Missing Meta Description (Nuanced P3 — Never Urgent!)
    // =========================================================================
    if (!isNoindex && !signals.metaDescription) {
      const isUtility = isUtilityOrArchivalPath(url);
      addFindingOccurrence(
        {
          id: 'SEARCH_MISSING_META_DESCRIPTION',
          title: 'Meta description is omitted (contextual refinement — not an urgent defect)',
          pillar: 'Search Visibility',
          priority: 'P3',
          evidenceType: 'Deterministic Technical Observation',
          whyItMatters:
            'A <meta name="description"> gives you editorial control over the summary snippet invited in search results. However, an omitted description is never an emergency: search engines automatically synthesize a snippet from visible page prose matching the visitor’s query.',
          voiceAndIntentNote:
            'Prioritize writing bespoke 120–155 character descriptions for your homepage, flagship exhibitions, and primary research essays. For minimalist colophon, archival index, or utility pages, leaving the description unset or concise is often completely appropriate.',
          concreteRepair:
            'Where a curated summary adds value, add <meta name="description" content="A concise 1–2 sentence editorial summary in the site’s voice."> to <head>. Otherwise, mark as an Intentional Expressive Choice in the Editorial Review Studio.',
          howToVerify:
            'Preview the authored description vs. the auto-extracted body prose fallback in the Search Snippet Preview panel.'
        },
        {
          url,
          evidence: isUtility
            ? `No <meta name="description"> on archival/colophon path (${new URL(url).pathname}) — low urgency; body excerpt fallback: "${signals.editorialSignals.bodyExcerpt}"`
            : `No <meta name="description"> on primary path (${new URL(url).pathname}); search engines will fall back to body prose: "${signals.editorialSignals.bodyExcerpt}"`
        }
      );
    }

    // =========================================================================
    // 15. ACCESSIBILITY / TYPOGRAPHY: Heading Hierarchy Skips (P3 Heuristic)
    // =========================================================================
    const headings = signals.headings || [];
    const h1Count = headings.filter((h) => h.level === 1).length;
    const skippedTransitions = [];
    for (let i = 1; i < headings.length; i++) {
      const prev = headings[i - 1];
      const curr = headings[i];
      if (curr.level > prev.level + 1) {
        skippedTransitions.push(
          `<${prev.tag}> "${prev.text}" followed directly by <${curr.tag}> "${curr.text}"`
        );
      }
    }
    if (h1Count === 0 || skippedTransitions.length > 0) {
      const reasons = [];
      if (h1Count === 0) reasons.push('Page has no <h1> heading');
      if (skippedTransitions.length > 0) reasons.push(skippedTransitions.join(' ; '));
      addFindingOccurrence(
        {
          id: 'A11Y_HEADING_HIERARCHY_SKIP',
          title: 'Heading outline skips levels or omits a primary <h1> (heuristic signal)',
          pillar: 'Accessibility',
          priority: 'P3',
          evidenceType: 'Heuristic Signal — Requires Human Review',
          whyItMatters:
            'Screen-reader users frequently navigate long essays and portfolios by jumping through the heading rotor (H1 → H2 → H3). Skipped levels can make it unclear whether a section is a subsection or a sibling topic, though a skip does not automatically constitute a WCAG conformance failure if the structure remains clear.',
          voiceAndIntentNote:
            'Expressive design systems often pick <h4> or <h5> for small uppercase kickers or captions because of their default CSS size. Decouple semantic heading rank (<h1>–<h3>) from visual typography by using CSS utility classes (e.g., <h2 class="type-kicker">) so the visual contrast stays identical while the document outline becomes clean.',
          concreteRepair:
            'Use sequential semantic heading tags (<h1> → <h2> → <h3>) and apply visual font-size/weight through CSS classes rather than heading level numbers.',
          howToVerify:
            'Inspect the Heading Cadence outline in the Design & Editorial Review Studio to confirm the logical outline matches your visual hierarchy.'
        },
        {
          url,
          evidence: reasons.join(' | ')
        }
      );
    }

    // =========================================================================
    // 16. USABILITY / VOICE: Ambiguous standalone link microcopy (P3 Heuristic)
    // =========================================================================
    const vagueLinkRegex = /^(read more|more|click here|here|learn more|link|details|view)$/i;
    const vagueLinks = (signals.links || []).filter(
      (l) => vagueLinkRegex.test((l.accessibleName || '').trim())
    );
    if (vagueLinks.length > 0) {
      addFindingOccurrence(
        {
          id: 'USABILITY_AMBIGUOUS_LINK_TEXT',
          title: 'Links use generic standalone microcopy ("Read more", "Click here") without accessible context',
          pillar: 'Usability',
          priority: 'P3',
          evidenceType: 'Heuristic Signal — Requires Human Review',
          whyItMatters:
            'When assistive technology users list all links on a page—or when readers scan an index—repeated "Read more" links offer no clue about which monograph or exhibition each link opens. It also misses an opportunity to reinforce editorial specificity.',
          voiceAndIntentNote:
            'If a clean grid layout visually pairs a short CTA ("Read essay →") beneath a large card title, you can keep the terse visual text and add aria-label="Read essay: Light and Architectural Form" or include the title inside a visually-hidden span.',
          concreteRepair:
            'Either make the visible link phrasing specific to the destination or add an aria-label / aria-labelledby connecting the link to its card heading.',
          howToVerify:
            'Review the Link Microcopy Ledger in the Editorial Review Studio and rerun the audit.'
        },
        {
          url,
          evidence: vagueLinks.map((l) => l.raw).join(' ; ')
        }
      );
    }

    // =========================================================================
    // 17. SEARCH VISIBILITY: Missing OpenGraph social preview metadata (P3)
    // =========================================================================
    if (!isNoindex) {
      const missingOg = ['og:title', 'og:description', 'og:image'].filter(
        (k) => !signals.ogTags || !signals.ogTags[k]
      );
      if (missingOg.length > 0) {
        addFindingOccurrence(
          {
            id: 'SEARCH_MISSING_SOCIAL_CARD_TAGS',
            title: 'Incomplete OpenGraph social preview metadata for studio sharing',
            pillar: 'Search Visibility',
            priority: 'P3',
            evidenceType: 'Deterministic Technical Observation',
            whyItMatters:
              'Design and research work is frequently shared in client decks, Slack/Discord channels, and newsletters. Without og:title, og:description, and og:image, shared links render as bare URLs or pull an arbitrary thumbnail.',
            voiceAndIntentNote:
              'Curate a specific 1200×630 art-directed still for og:image on key pages so link previews reflect the studio’s visual standards.',
            concreteRepair:
              `Add the missing OpenGraph meta tags (${missingOg.join(', ')}) inside <head>.`,
            howToVerify:
              'Check the Social Card column in the Snippet Preview table after rerunning the audit.'
          },
          {
            url,
            evidence: `Missing OpenGraph properties: ${missingOg.join(', ')}`
          }
        );
      }
    }

    // =========================================================================
    // 18. PERFORMANCE: Large Raw HTML Payload (>150 KB)
    // =========================================================================
    if (byteLength > 150 * 1024) {
      addFindingOccurrence(
        {
          id: 'PERF_LARGE_HTML_PAYLOAD',
          title: 'HTML document transfer size exceeds 150 KB',
          pillar: 'Performance',
          priority: 'P3',
          evidenceType: 'Deterministic Technical Observation',
          whyItMatters:
            'Oversized initial HTML payloads (often caused by large inlined base64 images, unminified SVG paths, or serialized state blobs) delay initial document download and DOM parsing.',
          voiceAndIntentNote:
            'Externalize reusable SVG symbols or large artwork assets so they can be cached independently across page navigations.',
          concreteRepair:
            'Move large inline base64 assets or repetitive SVG blocks into cacheable external files.',
          howToVerify:
            'Rerun the audit and check the HTML Size column in the Coverage Ledger.'
        },
        {
          url,
          evidence: `HTML payload size is ${(byteLength / 1024).toFixed(1)} KB.`
        }
      );
    }
  }

  // =========================================================================
  // 19. Cross-Page Check: Duplicate <title> across distinct pages
  // =========================================================================
  for (const [dupTitle, entries] of titleMap.entries()) {
    if (entries.length > 1) {
      for (const entry of entries) {
        addFindingOccurrence(
          {
            id: 'SEARCH_DUPLICATE_TITLE',
            title: 'Multiple distinct pages share an identical <title>',
            pillar: 'Search Visibility',
            priority: 'P2',
            evidenceType: 'Deterministic Technical Observation',
            whyItMatters:
              'When several pages use the exact same <title> (for example, leaving the studio name on every subpage without the exhibition or essay name), visitors with multiple open tabs and search engines cannot tell the pages apart.',
            voiceAndIntentNote:
              'Lead with the specific work or section name followed by the studio signature: "<title>Exhibitions & Monographs — Atelier Nocturne</title>".',
            concreteRepair:
              'Give each indexable page a distinct <title> reflecting its specific subject while maintaining a consistent studio suffix.',
            howToVerify:
              'Rerun the audit and inspect the Search Snippet Preview table to verify every page title is unique.'
          },
          {
            url: entry.url,
            evidence: `Shares exact <title>${dupTitle}</title> across ${entries.length} pages (${entries.map((e) => new URL(e.url).pathname).join(', ')}).`
          }
        );
      }
    }
  }

  // =========================================================================
  // 20. Cross-Page Check: Sitemap lists URLs disallowed by robots.txt
  // =========================================================================
  if (
    crawlResult.sitemap &&
    crawlResult.sitemap.blockedByRobotsUrls &&
    crawlResult.sitemap.blockedByRobotsUrls.length > 0
  ) {
    for (const blockedUrl of crawlResult.sitemap.blockedByRobotsUrls) {
      addFindingOccurrence(
        {
          id: 'SEARCH_SITEMAP_LISTS_ROBOTS_BLOCKED_URL',
          title: 'Sitemap XML includes URLs that are disallowed by robots.txt',
          pillar: 'Search Visibility',
          priority: 'P1',
          evidenceType: 'Deterministic Technical Observation',
          whyItMatters:
            'Listing a URL in /sitemap.xml asks search engines to index it, while disallowing it in /robots.txt forbids them from crawling it. Search Console flags this contradiction as an indexing error.',
          voiceAndIntentNote:
            'Keep private client drafts or internal staging routes excluded in robots.txt and omitted from the public XML sitemap.',
          concreteRepair:
            'Remove the disallowed URL from /sitemap.xml (if it should stay private), or remove the Disallow rule from /robots.txt (if it is meant to be public).',
          howToVerify:
            'Rerun the audit and verify the Sitemap & Robots alignment summary reports 0 blocked sitemap URLs.'
        },
        {
          url: blockedUrl,
          evidence: `Listed in ${crawlResult.sitemap.url} (<loc>${blockedUrl}</loc>) while blocked by ${crawlResult.robots.url}.`
        }
      );
    }
  }

  // Sort findings by Priority (P1 -> P2 -> P3), then by number of affected URLs descending
  const findings = Array.from(findingsMap.values()).sort((a, b) => {
    const rankDiff = PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;
    if (rankDiff !== 0) return rankDiff;
    return b.affectedUrls.length - a.affectedUrls.length;
  });

  // Summary counts by priority and pillar
  const summary = {
    totalGroupedFindings: findings.length,
    totalOccurrences: findings.reduce((acc, f) => acc + f.affectedUrls.length, 0),
    byPriority: {
      P1: findings.filter((f) => f.priority === 'P1').length,
      P2: findings.filter((f) => f.priority === 'P2').length,
      P3: findings.filter((f) => f.priority === 'P3').length
    },
    byPillar: {
      Accessibility: findings.filter((f) => f.pillar === 'Accessibility').length,
      Usability: findings.filter((f) => f.pillar === 'Usability').length,
      Performance: findings.filter((f) => f.pillar === 'Performance').length,
      'Search Visibility': findings.filter((f) => f.pillar === 'Search Visibility').length
    },
    byEvidenceType: {
      deterministic: findings.filter((f) => f.evidenceType.startsWith('Deterministic')).length,
      heuristic: findings.filter((f) => f.evidenceType.startsWith('Heuristic')).length
    }
  };

  // =========================================================================
  // Design, Voice & Editorial Review Studio Workspace Data
  // =========================================================================
  const snippetPreviews = pages.map((p) => {
    const s = p.signals;
    const hasAuthoredDesc = Boolean(s.metaDescription && s.metaDescription.trim().length > 0);
    const effectiveSnippet = hasAuthoredDesc
      ? s.metaDescription
      : s.editorialSignals.bodyExcerpt || 'No body prose extracted.';
    return {
      url: p.url,
      pathname: new URL(p.url).pathname,
      title: s.title || '(Untitled Document)',
      titleLength: (s.title || '').length,
      hasAuthoredDescription: hasAuthoredDesc,
      descriptionSource: hasAuthoredDesc ? 'Authored <meta name="description">' : 'Organic Body Prose Fallback',
      snippetText: effectiveSnippet,
      descriptionLength: hasAuthoredDesc ? s.metaDescription.length : 0,
      canonical: s.canonical || '(None declared)',
      metaRobots: s.metaRobots || p.xRobotsTag || 'index, follow (default)',
      ogReady: Boolean(s.ogTags?.['og:title'] && s.ogTags?.['og:description'] && s.ogTags?.['og:image']),
      ogImage: s.ogTags?.['og:image'] || null,
      schemaTypes: (s.jsonLdBlocks || [])
        .map((b) => (b.valid ? b.schemaTypes.join(', ') : 'Invalid JSON-LD'))
        .filter(Boolean)
    };
  });

  const typographyAndHierarchy = pages.map((p) => ({
    url: p.url,
    pathname: new URL(p.url).pathname,
    fontFamilies: p.signals.editorialSignals.fontFamilies,
    wordCount: p.signals.editorialSignals.wordCount,
    headings: p.signals.headings
  }));

  const artworkAltLedger = [];
  for (const p of pages) {
    for (const img of p.signals.images || []) {
      artworkAltLedger.push({
        pageUrl: p.url,
        pathname: new URL(p.url).pathname,
        src: img.src,
        status: !img.hasAltAttr
          ? 'Missing alt attribute'
          : img.isDecorative
          ? 'Decorative (alt="")'
          : 'Authored alt text',
        altText: img.altText,
        dimensions: img.hasDimensions ? `${img.width}×${img.height}` : 'Missing width/height'
      });
    }
  }

  const editorialStudio = {
    purpose:
      'Automated rules surface markup signals, but preserving an expressive website’s voice and visual intent requires human design and editorial judgment. Use this workspace to inspect snippets, heading cadence, and image descriptions, and record which findings are intentional artistic choices versus repairs to schedule.',
    snippetPreviews,
    typographyAndHierarchy,
    artworkAltLedger,
    reviewPrompts: [
      {
        id: 'voice-titles-snippets',
        category: 'Voice & Search Presence',
        question:
          'Do the page titles and search snippets reflect the studio’s editorial voice without generic marketing boilerplate?',
        guidance:
          'Check whether pages relying on organic body prose fallback read well in the Snippet Preview table below, and craft custom meta descriptions only where the fallback feels fragmented.'
      },
      {
        id: 'visual-typographic-hierarchy',
        category: 'Typographic Intent vs. Semantic Outline',
        question:
          'Where heading levels skip (e.g., H1 to H3), is that a visual scale choice that should be decoupled via CSS classes?',
        guidance:
          'Keep the exact font sizes, tracking, and margins, but map structural section titles to sequential H1 → H2 → H3 tags for screen-reader wayfinding.'
      },
      {
        id: 'curatorial-image-descriptions',
        category: 'Artwork & Photography Narrative',
        question:
          'Do photography and exhibition plates carry alt text that conveys composition and subject, while atmospheric textures use alt=""?',
        guidance:
          'Avoid robotic SEO keyword lists in alt attributes; describe the visual work as you would to a colleague over the phone.'
      },
      {
        id: 'interactive-focus-and-contrast',
        category: 'Interactive Craft & Contrast Verification',
        question:
          'Have custom cursor states, delicate hairlines, and text over photography been checked with keyboard Tab navigation and visual contrast tools?',
        guidance:
          'Static HTML analysis cannot see rendered WebGL/canvas or photographic overlays—verify these directly in the live browser viewport.'
      }
    ],
    // Persisted human review state (can be updated via API/UI)
    humanReview: options.existingHumanReview || {
      reviewerName: '',
      updatedAt: null,
      studioNotes: '',
      checklistStates: {},
      findingDispositions: {} // ruleId -> { status: 'queued' | 'intentional' | 'verified', note: '' }
    }
  };

  // =========================================================================
  // Evidence Boundary & Optional External Telemetry Slots
  // =========================================================================
  const evidenceBoundaries = {
    observedDirectly: [
      'HTTP status codes, redirects, response headers (Content-Type, X-Robots-Tag, Cache-Control), and HTML transfer size',
      'robots.txt directives (Allow/Disallow/Sitemap) and sitemap.xml URL coverage alignment',
      'Static DOM structure: <title>, meta tags, canonicals, OpenGraph tags, heading outline (H1–H6), landmarks, and in-page #fragment targets',
      'JSON-LD structured data syntax validity and declared @type entities',
      'Presence of alt attributes and intrinsic width/height attributes on <img> elements, programmatic labels on form inputs, and synchronous <script> tags in <head>'
    ],
    unavailableInZeroCredentialCrawl: [
      {
        category: 'Rendered Visual Contrast & Complex Compositing',
        reason:
          'Static HTTP/HTML inspection does not execute full GPU layout or rasterize CSS blend-modes, background images, or WebGL canvases. Text-over-image contrast and hover/focus visibility must be verified in a rendered viewport.'
      },
      {
        category: 'Assistive Technology Interaction & Reading Flow',
        reason:
          'Heuristics detect missing alt or label attributes, but cannot prove WCAG conformance or evaluate whether alt prose is meaningful, whether custom JS widgets trap keyboard focus, or how VoiceOver/NVDA announces dynamic state changes.'
      },
      {
        category: 'Field Core Web Vitals (CrUX) & Lab Paint Timing (LCP / INP / CLS)',
        reason:
          'True Largest Contentful Paint, Interaction to Next Paint, and Cumulative Layout Shift require browser trace instrumentation or real-user telemetry. ContextMuse flags deterministic structural causes (unsized images, render-blocking head scripts) without inventing synthetic millisecond scores.'
      },
      {
        category: 'Search Engine Index State, Query Impressions & Competitor Rankings',
        reason:
          'A local crawl verifies technical indexability rules (robots.txt, meta noindex, canonicals, schema syntax) without paid rank-tracker APIs or Google/Bing account credentials.'
      }
    ],
    optionalIntegrations: {
      searchConsole: options.optionalIntegrations?.searchConsole || {
        status: 'not_attached',
        label: 'Optional Google Search Console / Bing Webmaster Export',
        description:
          'Attach a Search Console performance JSON/CSV export later to overlay real query impressions, clicks, and index coverage alongside technical findings.',
        data: null
      },
      measuredPerformance: options.optionalIntegrations?.measuredPerformance || {
        status: 'not_attached',
        label: 'Optional Lighthouse / Web Vitals Lab Trace JSON',
        description:
          'Attach a measured Lighthouse or Web Vitals JSON artifact later to display actual measured LCP, CLS, and INP alongside static asset findings.',
        data: null
      }
    }
  };

  return {
    priorityMeta: PRIORITY_META,
    summary,
    findings,
    editorialStudio,
    evidenceBoundaries
  };
}

module.exports = {
  analyzeCrawlResult,
  PRIORITY_META
};
