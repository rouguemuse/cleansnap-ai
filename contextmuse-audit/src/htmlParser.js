/**
 * Deterministic HTML & DOM Signal Extractor for ContextMuse Website Audit.
 * Extracts metadata, headings, landmarks, images, links, form controls, scripts,
 * JSON-LD structured data, and editorial/typographic signals from raw HTML.
 */

function decodeEntities(str) {
  if (!str) return '';
  return String(str)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function stripTags(htmlFragment) {
  if (!htmlFragment) return '';
  return decodeEntities(
    String(htmlFragment)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAttributes(attrString) {
  const attrs = {};
  if (!attrString) return attrs;
  const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = attrRegex.exec(attrString)) !== null) {
    const key = match[1].toLowerCase();
    const val =
      match[2] !== undefined
        ? match[2]
        : match[3] !== undefined
        ? match[3]
        : match[4] !== undefined
        ? match[4]
        : '';
    attrs[key] = decodeEntities(val);
    attrs[`__has_${key}`] = true;
  }
  return attrs;
}

function truncateEvidence(str, maxLen = 180) {
  const clean = String(str || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1) + '…';
}

function extractPageSignals(html, pageUrl) {
  const rawHtml = String(html || '');
  const htmlWithoutComments = rawHtml.replace(/<!--[\s\S]*?-->/g, '');

  // Split head and body
  const headMatch = htmlWithoutComments.match(/<head(?:\s[^>]*)?>([\s\S]*?)<\/head>/i);
  const headHtml = headMatch ? headMatch[1] : '';
  const bodyMatch = htmlWithoutComments.match(/<body(?:\s[^>]*)?>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : htmlWithoutComments;

  // 1. <html lang="...">
  const htmlTagMatch = htmlWithoutComments.match(/<html(\s[^>]*)?>/i);
  const htmlAttrs = htmlTagMatch ? parseAttributes(htmlTagMatch[1] || '') : {};
  const htmlLang = (htmlAttrs.lang || '').trim();

  // 2. <title>
  const titleMatch = htmlWithoutComments.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : '';

  // 3. <meta> tags
  const metaTags = [];
  const metaMap = {};
  const ogTags = {};
  const twitterTags = {};
  const metaRegex = /<meta\s+([^>]+?)\/?>/gi;
  let match;
  while ((match = metaRegex.exec(htmlWithoutComments)) !== null) {
    const attrs = parseAttributes(match[1]);
    const name = (attrs.name || attrs.property || attrs['http-equiv'] || '').toLowerCase().trim();
    const content = (attrs.content || '').trim();
    metaTags.push({ name, content, raw: truncateEvidence(match[0]) });
    if (name) {
      metaMap[name] = content;
      if (name.startsWith('og:')) ogTags[name] = content;
      if (name.startsWith('twitter:')) twitterTags[name] = content;
    }
  }

  const metaDescription = metaMap['description'] || '';
  const metaViewport = metaMap['viewport'] || '';
  const metaRobots = metaMap['robots'] || '';

  // 4. <link> tags (canonical, stylesheets, fonts)
  let canonical = '';
  const stylesheets = [];
  const linkRegex = /<link\s+([^>]+?)\/?>/gi;
  while ((match = linkRegex.exec(htmlWithoutComments)) !== null) {
    const attrs = parseAttributes(match[1]);
    const rel = (attrs.rel || '').toLowerCase();
    const href = (attrs.href || '').trim();
    if (rel.split(/\s+/).includes('canonical') && href) {
      canonical = href;
    }
    if (rel.split(/\s+/).includes('stylesheet') && href) {
      stylesheets.push(href);
    }
  }

  // 5. Collect all element IDs on the page for fragment link verification and label matching
  const elementIds = new Set();
  const idRegex = /\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'>]+))/gi;
  while ((match = idRegex.exec(htmlWithoutComments)) !== null) {
    const idVal = (match[1] || match[2] || match[3] || '').trim();
    if (idVal) elementIds.add(idVal);
  }

  // 6. Headings (h1 - h6) in document order
  const headings = [];
  const headingRegex = /<(h[1-6])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  while ((match = headingRegex.exec(htmlWithoutComments)) !== null) {
    const tag = match[1].toLowerCase();
    const level = parseInt(tag.slice(1), 10);
    const text = stripTags(match[3]);
    headings.push({
      tag,
      level,
      text,
      raw: truncateEvidence(match[0])
    });
  }

  // 7. Landmarks & Skip Links
  const hasMainLandmark =
    /<main[\s>]/i.test(htmlWithoutComments) || /role\s*=\s*["']main["']/i.test(htmlWithoutComments);
  const hasNavLandmark =
    /<nav[\s>]/i.test(htmlWithoutComments) || /role\s*=\s*["']navigation["']/i.test(htmlWithoutComments);
  const hasHeaderLandmark =
    /<header[\s>]/i.test(htmlWithoutComments) || /role\s*=\s*["']banner["']/i.test(htmlWithoutComments);
  const hasFooterLandmark =
    /<footer[\s>]/i.test(htmlWithoutComments) || /role\s*=\s*["']contentinfo["']/i.test(htmlWithoutComments);

  // 8. Images
  const images = [];
  const imgRegex = /<img\s+([^>]*?)\/?>/gi;
  while ((match = imgRegex.exec(htmlWithoutComments)) !== null) {
    const attrs = parseAttributes(match[1]);
    const hasAltAttr = Boolean(attrs.__has_alt);
    const altText = hasAltAttr ? attrs.alt : null;
    const width = (attrs.width || '').trim();
    const height = (attrs.height || '').trim();
    const loading = (attrs.loading || '').toLowerCase().trim();
    const role = (attrs.role || '').toLowerCase().trim();
    const ariaHidden = (attrs['aria-hidden'] || '').toLowerCase().trim() === 'true';

    images.push({
      src: (attrs.src || '').trim(),
      hasAltAttr,
      altText,
      isDecorative: (hasAltAttr && altText === '') || role === 'presentation' || role === 'none' || ariaHidden,
      hasDimensions: Boolean(width && height),
      width,
      height,
      loading,
      raw: truncateEvidence(match[0])
    });
  }

  // 9. Links (<a>)
  const links = [];
  const linkTagRegex = /<a(\s[^>]*)?>([\s\S]*?)<\/a>/gi;
  while ((match = linkTagRegex.exec(htmlWithoutComments)) !== null) {
    const attrs = parseAttributes(match[1] || '');
    const rawHref = (attrs.href || '').trim();
    const innerHtml = match[2] || '';
    let text = stripTags(innerHtml);
    // Also check if link wraps an image with alt text
    if (!text && /<img\s/i.test(innerHtml)) {
      const innerImgMatch = innerHtml.match(/<img\s+([^>]*?)\/?>/i);
      if (innerImgMatch) {
        const imgAttrs = parseAttributes(innerImgMatch[1]);
        if (imgAttrs.alt) text = `[Image: ${imgAttrs.alt.trim()}]`;
      }
    }
    const ariaLabel = (attrs['aria-label'] || '').trim();
    const accessibleName = ariaLabel || text || (attrs.title || '').trim();
    const target = (attrs.target || '').trim();
    const rel = (attrs.rel || '').toLowerCase().trim();

    let resolvedUrl = null;
    let isSameOrigin = false;
    let isFragmentOnly = false;
    let fragmentId = null;

    if (rawHref.startsWith('#')) {
      isFragmentOnly = true;
      fragmentId = rawHref.slice(1);
      isSameOrigin = true;
    } else if (
      rawHref &&
      !rawHref.toLowerCase().startsWith('mailto:') &&
      !rawHref.toLowerCase().startsWith('tel:') &&
      !rawHref.toLowerCase().startsWith('javascript:')
    ) {
      try {
        const parsed = new URL(rawHref, pageUrl);
        const pageParsed = new URL(pageUrl);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          isSameOrigin = parsed.origin === pageParsed.origin;
          if (parsed.hash && parsed.pathname === pageParsed.pathname && isSameOrigin) {
            fragmentId = parsed.hash.slice(1);
          }
          parsed.hash = '';
          resolvedUrl = parsed.toString();
        }
      } catch {
        // Invalid URL syntax
      }
    }

    links.push({
      rawHref,
      resolvedUrl,
      isSameOrigin,
      isFragmentOnly,
      fragmentId,
      text,
      ariaLabel,
      accessibleName,
      target,
      rel,
      raw: truncateEvidence(match[0])
    });
  }

  const hasSkipLink = links.some(
    (l) =>
      l.isFragmentOnly &&
      l.fragmentId &&
      /skip|main|content/i.test(l.accessibleName || l.fragmentId)
  );

  // 10. Form controls and labels
  const labelForIds = new Set();
  const labelForRegex = /<label\s+[^>]*?\bfor\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'>]+))[^>]*>/gi;
  while ((match = labelForRegex.exec(htmlWithoutComments)) !== null) {
    const targetId = (match[1] || match[2] || match[3] || '').trim();
    if (targetId) labelForIds.add(targetId);
  }

  // Strip content inside wrapping <label>...</label> that actually contains label text
  // to detect controls wrapped by a label
  const wrappedControlSnippets = new Set();
  const labelBlockRegex = /<label(?:\s[^>]*)?>([\s\S]*?)<\/label>/gi;
  while ((match = labelBlockRegex.exec(htmlWithoutComments)) !== null) {
    const labelText = stripTags(match[1]);
    if (labelText.length > 0) {
      const innerControlRegex = /<(input|select|textarea)\b[^>]*>/gi;
      let innerMatch;
      while ((innerMatch = innerControlRegex.exec(match[1])) !== null) {
        wrappedControlSnippets.add(truncateEvidence(innerMatch[0]));
      }
    }
  }

  const formControls = [];
  const controlRegex = /<(input|select|textarea)(\s[^>]*)?\/?>/gi;
  while ((match = controlRegex.exec(htmlWithoutComments)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = parseAttributes(match[2] || '');
    const type = (attrs.type || (tag === 'input' ? 'text' : tag)).toLowerCase().trim();
    if (['hidden', 'submit', 'reset', 'button', 'image'].includes(type)) {
      continue;
    }
    const id = (attrs.id || '').trim();
    const ariaLabel = (attrs['aria-label'] || '').trim();
    const ariaLabelledBy = (attrs['aria-labelledby'] || '').trim();
    const placeholder = (attrs.placeholder || '').trim();
    const titleAttr = (attrs.title || '').trim();
    const rawSnippet = truncateEvidence(match[0]);

    const hasExplicitLabel = Boolean(id && labelForIds.has(id));
    const hasWrappingLabel = wrappedControlSnippets.has(rawSnippet);
    const hasAriaLabel = Boolean(ariaLabel || (ariaLabelledBy && elementIds.has(ariaLabelledBy)));
    const isLabeled = hasExplicitLabel || hasWrappingLabel || hasAriaLabel;

    formControls.push({
      tag,
      type,
      id,
      name: (attrs.name || '').trim(),
      placeholder,
      titleAttr,
      isLabeled,
      onlyHasPlaceholder: !isLabeled && Boolean(placeholder),
      raw: rawSnippet
    });
  }

  // 11. Scripts (render-blocking head scripts & JSON-LD structured data)
  const renderBlockingScripts = [];
  const headScriptRegex = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  while ((match = headScriptRegex.exec(headHtml)) !== null) {
    const attrs = parseAttributes(match[1] || '');
    const src = (attrs.src || '').trim();
    const type = (attrs.type || '').toLowerCase().trim();
    const isAsync = Boolean(attrs.__has_async);
    const isDefer = Boolean(attrs.__has_defer);
    const isModule = type === 'module';
    const isJsonLd = type === 'application/ld+json';

    if (src && !isAsync && !isDefer && !isModule && !isJsonLd) {
      renderBlockingScripts.push({
        src,
        raw: truncateEvidence(match[0])
      });
    }
  }

  const jsonLdBlocks = [];
  const allScriptRegex = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  while ((match = allScriptRegex.exec(htmlWithoutComments)) !== null) {
    const attrs = parseAttributes(match[1] || '');
    const type = (attrs.type || '').toLowerCase().trim();
    if (type === 'application/ld+json') {
      const rawJson = (match[2] || '').trim();
      try {
        const parsed = JSON.parse(rawJson);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        const schemaTypes = [];
        for (const item of items) {
          if (item && typeof item === 'object') {
            if (item['@type']) {
              schemaTypes.push(
                Array.isArray(item['@type']) ? item['@type'].join(', ') : String(item['@type'])
              );
            }
            if (Array.isArray(item['@graph'])) {
              for (const g of item['@graph']) {
                if (g && g['@type']) schemaTypes.push(String(g['@type']));
              }
            }
          }
        }
        jsonLdBlocks.push({
          valid: true,
          schemaTypes: schemaTypes.length > 0 ? schemaTypes : ['Unspecified @type'],
          raw: truncateEvidence(rawJson, 200)
        });
      } catch (err) {
        jsonLdBlocks.push({
          valid: false,
          error: err.message,
          schemaTypes: [],
          raw: truncateEvidence(rawJson, 200)
        });
      }
    }
  }

  // 12. Editorial & Design Voice Signals (Typography families, word count, body excerpt)
  const fontFamilies = new Set();
  const fontRegex = /font-family\s*:\s*([^;}"']+)/gi;
  while ((match = fontRegex.exec(htmlWithoutComments)) !== null) {
    const family = match[1].trim();
    if (family) fontFamilies.add(family);
  }

  const mainMatch = bodyHtml.match(/<main(?:\s[^>]*)?>([\s\S]*?)<\/main>/i);
  const proseSourceHtml = mainMatch
    ? mainMatch[1]
    : bodyHtml
        .replace(/<header[\s\S]*?<\/header>/gi, ' ')
        .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
  const bodyText = stripTags(proseSourceHtml);
  const words = bodyText ? bodyText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  const bodyExcerpt = words.slice(0, 38).join(' ') + (words.length > 38 ? '…' : '');

  // Approximate DOM element count
  const allElementMatches = htmlWithoutComments.match(/<[a-zA-Z][a-zA-Z0-9-]*(?:\s|>|\/)/g);
  const domElementCount = allElementMatches ? allElementMatches.length : 0;

  return {
    htmlLang,
    title,
    metaDescription,
    metaViewport,
    metaRobots,
    canonical,
    ogTags,
    twitterTags,
    stylesheets,
    headings,
    landmarks: {
      hasMainLandmark,
      hasNavLandmark,
      hasHeaderLandmark,
      hasFooterLandmark,
      hasSkipLink
    },
    images,
    links,
    elementIds: Array.from(elementIds),
    formControls,
    renderBlockingScripts,
    jsonLdBlocks,
    editorialSignals: {
      fontFamilies: Array.from(fontFamilies),
      wordCount,
      bodyExcerpt,
      domElementCount
    }
  };
}

module.exports = {
  extractPageSignals,
  stripTags,
  decodeEntities
};
