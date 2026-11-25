/**
 * robots.txt and sitemap.xml parser & evaluator for ContextMuse Website Audit.
 * Respects standard robots exclusion rules for User-agent: * and ContextMuseAudit.
 */

function parseRobotsTxt(rawText, botToken = 'contextmuseaudit') {
  const lines = String(rawText || '').split(/\r?\n/);
  const groups = [];
  let currentGroup = null;
  const sitemaps = [];

  for (const rawLine of lines) {
    const commentStripped = rawLine.replace(/#.*$/, '').trim();
    if (!commentStripped) {
      continue;
    }
    const colonIdx = commentStripped.indexOf(':');
    if (colonIdx === -1) continue;

    const directive = commentStripped.slice(0, colonIdx).trim().toLowerCase();
    const value = commentStripped.slice(colonIdx + 1).trim();

    if (directive === 'sitemap') {
      if (value) sitemaps.push(value);
      continue;
    }

    if (directive === 'user-agent') {
      const agent = value.toLowerCase();
      if (!currentGroup || currentGroup.rules.length > 0 || currentGroup.crawlDelay !== null) {
        currentGroup = { agents: [agent], rules: [], crawlDelay: null };
        groups.push(currentGroup);
      } else {
        currentGroup.agents.push(agent);
      }
      continue;
    }

    if (!currentGroup) {
      currentGroup = { agents: ['*'], rules: [], crawlDelay: null };
      groups.push(currentGroup);
    }

    if (directive === 'disallow' || directive === 'allow') {
      currentGroup.rules.push({
        type: directive,
        pattern: value,
        raw: `${directive === 'disallow' ? 'Disallow' : 'Allow'}: ${value}`
      });
    } else if (directive === 'crawl-delay') {
      const parsed = parseFloat(value);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        currentGroup.crawlDelay = parsed;
      }
    }
  }

  // Pick specific bot groups first; fallback to '*'
  const specificGroups = groups.filter((g) =>
    g.agents.some((a) => a === botToken || botToken.startsWith(a) && a !== '*')
  );
  const wildcardGroups = groups.filter((g) => g.agents.includes('*'));
  const activeGroups = specificGroups.length > 0 ? specificGroups : wildcardGroups;

  const activeRules = [];
  let crawlDelay = null;
  for (const g of activeGroups) {
    activeRules.push(...g.rules);
    if (g.crawlDelay !== null && crawlDelay === null) {
      crawlDelay = g.crawlDelay;
    }
  }

  return {
    found: Boolean(rawText && rawText.trim().length > 0),
    rules: activeRules,
    crawlDelay,
    sitemaps
  };
}

function patternMatchesPath(pattern, pathWithQuery) {
  if (!pattern) return false;
  // Convert robots.txt pattern (* and trailing $) into a safe RegExp
  let anchoredEnd = false;
  let cleanPattern = pattern;
  if (cleanPattern.endsWith('$')) {
    anchoredEnd = true;
    cleanPattern = cleanPattern.slice(0, -1);
  }
  const escaped = cleanPattern
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  const regexStr = `^${escaped}${anchoredEnd ? '$' : ''}`;
  try {
    const re = new RegExp(regexStr);
    return re.test(pathWithQuery);
  } catch {
    return pathWithQuery.startsWith(pattern);
  }
}

/**
 * Evaluates whether a URL path (e.g. "/private-drafts?preview=1") is allowed by parsed robots rules.
 * Uses longest-matching-pattern precedence (and Allow wins ties).
 */
function checkRobotsAllowance(parsedRobots, urlObj) {
  if (!parsedRobots || !Array.isArray(parsedRobots.rules) || parsedRobots.rules.length === 0) {
    return { allowed: true, matchedRule: null };
  }
  const pathWithQuery = (urlObj.pathname || '/') + (urlObj.search || '');
  let bestMatch = null;

  for (const rule of parsedRobots.rules) {
    if (!rule.pattern) {
      // Empty Disallow means allow all
      continue;
    }
    if (patternMatchesPath(rule.pattern, pathWithQuery)) {
      const len = rule.pattern.length;
      if (
        !bestMatch ||
        len > bestMatch.pattern.length ||
        (len === bestMatch.pattern.length && rule.type === 'allow')
      ) {
        bestMatch = rule;
      }
    }
  }

  if (!bestMatch) {
    return { allowed: true, matchedRule: null };
  }

  return {
    allowed: bestMatch.type !== 'disallow',
    matchedRule: bestMatch.raw
  };
}

function parseSitemapXml(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') {
    return { urls: [], isSitemapIndex: false };
  }
  const isSitemapIndex = /<\s*sitemapindex[\s>]/i.test(xmlText);
  const urls = [];
  const locRegex = /<\s*loc\s*>([\s\S]*?)<\s*\/\s*loc\s*>/gi;
  let match;
  while ((match = locRegex.exec(xmlText)) !== null) {
    const loc = match[1].trim()
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    if (loc) urls.push(loc);
  }
  return {
    urls,
    isSitemapIndex
  };
}

module.exports = {
  parseRobotsTxt,
  checkRobotsAllowance,
  parseSitemapXml
};
