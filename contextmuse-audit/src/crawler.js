/**
 * Bounded Same-Origin Crawler for ContextMuse Website Audit.
 * Enforces explicit crawl limits, respects robots.txt exclusions, and produces
 * a transparent coverage ledger with referrer and markup evidence.
 */

const { parseRobotsTxt, checkRobotsAllowance, parseSitemapXml } = require('./robots');
const { extractPageSignals } = require('./htmlParser');

const USER_AGENT = 'ContextMuseAudit/1.0 (+local-studio-audit; respects-robots)';

function normalizeCrawlUrl(rawUrl, baseOrigin) {
  try {
    const parsed = baseOrigin ? new URL(rawUrl, baseOrigin) : new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    parsed.hash = '';
    if (!parsed.pathname) {
      parsed.pathname = '/';
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'follow',
      signal: controller.signal
    });
    const elapsedMs = Date.now() - startedAt;
    const text = await response.text();
    const byteLength = Buffer.byteLength(text, 'utf8');
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      finalUrl: response.url || url,
      contentType: response.headers.get('content-type') || '',
      xRobotsTag: response.headers.get('x-robots-tag') || '',
      cacheControl: response.headers.get('cache-control') || '',
      elapsedMs,
      byteLength,
      body: text,
      error: null
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      statusText: 'Network or Timeout Error',
      finalUrl: url,
      contentType: '',
      xRobotsTag: '',
      cacheControl: '',
      elapsedMs: Date.now() - startedAt,
      byteLength: 0,
      body: '',
      error: err.name === 'AbortError' ? `Timed out after ${timeoutMs}ms` : err.message
    };
  } finally {
    clearTimeout(timer);
  }
}

async function crawlSite(options = {}) {
  const rawStartUrl = String(options.startUrl || '').trim();
  const normalizedStart = normalizeCrawlUrl(rawStartUrl);
  if (!normalizedStart) {
    throw new Error(`Invalid starting URL: "${rawStartUrl}". Please provide an http:// or https:// URL.`);
  }

  const startUrlObj = new URL(normalizedStart);
  const origin = startUrlObj.origin;

  const maxPages = Math.min(Math.max(parseInt(options.maxPages, 10) || 10, 1), 50);
  const maxDepth = Math.min(Math.max(parseInt(options.maxDepth, 10) || 3, 0), 6);
  const timeoutMs = Math.min(Math.max(parseInt(options.timeoutMs, 10) || 8000, 1000), 30000);

  const startedAtIso = new Date().toISOString();

  // 1. Fetch and parse /robots.txt
  const robotsUrl = `${origin}/robots.txt`;
  const robotsRes = await fetchWithTimeout(robotsUrl, timeoutMs);
  let robotsInfo = {
    url: robotsUrl,
    status: robotsRes.status,
    found: false,
    rawText: '',
    rules: [],
    crawlDelay: null,
    sitemaps: []
  };

  if (robotsRes.status >= 200 && robotsRes.status < 300 && !/text\/html/i.test(robotsRes.contentType)) {
    const parsed = parseRobotsTxt(robotsRes.body);
    robotsInfo = {
      url: robotsUrl,
      status: robotsRes.status,
      found: true,
      rawText: robotsRes.body.slice(0, 4000),
      rules: parsed.rules,
      crawlDelay: parsed.crawlDelay,
      sitemaps: parsed.sitemaps
    };
  }

  // 2. Fetch and parse /sitemap.xml (or first Sitemap declared in robots.txt)
  const sitemapUrl = robotsInfo.sitemaps[0] || `${origin}/sitemap.xml`;
  const sitemapRes = await fetchWithTimeout(sitemapUrl, timeoutMs);
  let sitemapInfo = {
    url: sitemapUrl,
    status: sitemapRes.status,
    found: false,
    urls: [],
    isSitemapIndex: false
  };
  if (sitemapRes.status >= 200 && sitemapRes.status < 300 && /xml|text\/plain/i.test(sitemapRes.contentType || 'xml')) {
    const parsedSm = parseSitemapXml(sitemapRes.body);
    if (parsedSm.urls.length > 0 || /<\s*(urlset|sitemapindex)/i.test(sitemapRes.body)) {
      sitemapInfo = {
        url: sitemapUrl,
        status: sitemapRes.status,
        found: true,
        urls: parsedSm.urls,
        isSitemapIndex: parsedSm.isSitemapIndex
      };
    }
  }

  // 3. BFS Crawl Queue
  const queue = [{ url: normalizedStart, depth: 0, discoveredFrom: null }];
  const seenUrls = new Set([normalizedStart]);
  const linkReferrers = new Map();

  function addReferrer(targetUrl, fromUrl, rawTag, anchorText) {
    if (!linkReferrers.has(targetUrl)) {
      linkReferrers.set(targetUrl, []);
    }
    const list = linkReferrers.get(targetUrl);
    if (list.length < 10 && !list.some((r) => r.fromUrl === fromUrl && r.rawTag === rawTag)) {
      list.push({ fromUrl, rawTag, anchorText });
    }
  }

  const inspectedPages = [];
  const excludedByRobots = [];
  const skippedByLimit = [];
  const failedRequests = [];
  const nonHtmlSkipped = [];
  const externalLinksMap = new Map();

  while (queue.length > 0) {
    const current = queue.shift();
    const currentUrlObj = new URL(current.url);

    // Check robots.txt exclusion first
    const robotsCheck = checkRobotsAllowance(robotsInfo, currentUrlObj);
    if (!robotsCheck.allowed) {
      excludedByRobots.push({
        url: current.url,
        depth: current.depth,
        discoveredFrom: current.discoveredFrom,
        matchedRule: robotsCheck.matchedRule,
        referrers: linkReferrers.get(current.url) || []
      });
      continue;
    }

    // Check maxPages limit
    if (inspectedPages.length >= maxPages) {
      skippedByLimit.push({
        url: current.url,
        depth: current.depth,
        discoveredFrom: current.discoveredFrom,
        reason: `Reached maxPages limit (${maxPages})`
      });
      continue;
    }

    // Fetch the page
    const res = await fetchWithTimeout(current.url, timeoutMs);

    // Verify if final redirected URL left origin
    try {
      const finalObj = new URL(res.finalUrl);
      if (finalObj.origin !== origin) {
        externalLinksMap.set(res.finalUrl, {
          url: res.finalUrl,
          discoveredFrom: current.discoveredFrom || current.url
        });
        continue;
      }
    } catch {
      // ignore
    }

    if (res.error || res.status >= 400 || res.status === 0) {
      failedRequests.push({
        url: current.url,
        status: res.status,
        statusText: res.statusText,
        error: res.error,
        depth: current.depth,
        discoveredFrom: current.discoveredFrom,
        referrers: linkReferrers.get(current.url) || [],
        elapsedMs: res.elapsedMs
      });
      continue;
    }

    const isHtml =
      /text\/html|application\/xhtml\+xml/i.test(res.contentType) ||
      (!res.contentType && /^\s*<!doctype html|^\s*<html/i.test(res.body));

    if (!isHtml) {
      nonHtmlSkipped.push({
        url: current.url,
        contentType: res.contentType || 'unknown',
        status: res.status,
        byteLength: res.byteLength,
        discoveredFrom: current.discoveredFrom
      });
      continue;
    }

    // Extract page signals
    const signals = extractPageSignals(res.body, current.url);

    inspectedPages.push({
      url: current.url,
      finalUrl: res.finalUrl,
      depth: current.depth,
      discoveredFrom: current.discoveredFrom,
      status: res.status,
      contentType: res.contentType,
      xRobotsTag: res.xRobotsTag,
      cacheControl: res.cacheControl,
      elapsedMs: res.elapsedMs,
      byteLength: res.byteLength,
      signals
    });

    // Respect meta robots nofollow if present
    const combinedRobotsDirectives = `${signals.metaRobots} ${res.xRobotsTag}`.toLowerCase();
    const isNofollow = combinedRobotsDirectives.includes('nofollow');

    if (!isNofollow) {
      for (const link of signals.links) {
        if (!link.resolvedUrl || link.isFragmentOnly) continue;

        if (!link.isSameOrigin) {
          if (!externalLinksMap.has(link.resolvedUrl)) {
            externalLinksMap.set(link.resolvedUrl, {
              url: link.resolvedUrl,
              discoveredFrom: current.url,
              anchorText: link.accessibleName || link.rawHref
            });
          }
          continue;
        }

        const normTarget = normalizeCrawlUrl(link.resolvedUrl, origin);
        if (!normTarget) continue;

        addReferrer(normTarget, current.url, link.raw, link.accessibleName || link.rawHref);

        if (seenUrls.has(normTarget)) continue;
        seenUrls.add(normTarget);

        if (/\.(png|jpe?g|gif|webp|avif|svg|pdf|zip|css|js|woff2?|ttf|mp4|mp3)$/i.test(new URL(normTarget).pathname)) {
          continue;
        }

        if (current.depth + 1 > maxDepth) {
          skippedByLimit.push({
            url: normTarget,
            depth: current.depth + 1,
            discoveredFrom: current.url,
            reason: `Exceeded maxDepth limit (${maxDepth})`
          });
          continue;
        }

        queue.push({
          url: normTarget,
          depth: current.depth + 1,
          discoveredFrom: current.url
        });
      }
    }
  }

  // Attach full referrers to any excluded or failed requests discovered multiple times
  for (const item of excludedByRobots) {
    item.referrers = linkReferrers.get(item.url) || [];
  }
  for (const item of failedRequests) {
    item.referrers = linkReferrers.get(item.url) || [];
  }

  // Compute Sitemap coverage cross-check
  const inspectedUrlSet = new Set(inspectedPages.map((p) => p.url));
  const excludedUrlSet = new Set(excludedByRobots.map((e) => e.url));
  const normalizedSitemapUrls = sitemapInfo.urls
    .map((u) => normalizeCrawlUrl(u, origin))
    .filter(Boolean);
  const sitemapCovered = normalizedSitemapUrls.filter((u) => inspectedUrlSet.has(u));
  const sitemapUncrawled = normalizedSitemapUrls.filter((u) => !inspectedUrlSet.has(u));
  const sitemapBlockedByRobots = normalizedSitemapUrls.filter((u) => {
    try {
      return !checkRobotsAllowance(robotsInfo, new URL(u)).allowed || excludedUrlSet.has(u);
    } catch {
      return false;
    }
  });

  const finishedAtIso = new Date().toISOString();

  return {
    startUrl: normalizedStart,
    origin,
    startedAt: startedAtIso,
    finishedAt: finishedAtIso,
    limits: {
      maxPages,
      maxDepth,
      timeoutMs,
      userAgent: USER_AGENT
    },
    robots: robotsInfo,
    sitemap: {
      ...sitemapInfo,
      totalListed: normalizedSitemapUrls.length,
      coveredInCrawlCount: sitemapCovered.length,
      uncrawledUrls: sitemapUncrawled.slice(0, 25),
      blockedByRobotsUrls: sitemapBlockedByRobots
    },
    coverage: {
      inspectedCount: inspectedPages.length,
      excludedByRobotsCount: excludedByRobots.length,
      skippedByLimitCount: skippedByLimit.length,
      failedRequestsCount: failedRequests.length,
      nonHtmlSkippedCount: nonHtmlSkipped.length,
      externalLinksCount: externalLinksMap.size,
      totalDiscoveredSameOrigin: seenUrls.size
    },
    inspectedPages,
    excludedByRobots,
    skippedByLimit,
    failedRequests,
    nonHtmlSkipped,
    externalLinks: Array.from(externalLinksMap.values())
  };
}

module.exports = {
  crawlSite,
  normalizeCrawlUrl
};
