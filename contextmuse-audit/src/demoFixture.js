/**
 * Offline Reproducible Fixture Server for ContextMuse Website Audit.
 * Serves "Atelier Nocturne — Spatial Monographs & Exhibition Archive" locally.
 * Supports switching live between:
 *   - "before": Baseline state with real accessibility, usability, performance, and search issues
 *   - "after":  Repaired state preserving the site's expressive voice and visual intent
 */

const http = require('http');

function createDemoFixtureServer(initialMode = 'before') {
  let mode = initialMode === 'after' ? 'after' : 'before';
  let port = null;

  function getOrigin() {
    return `http://127.0.0.1:${port}`;
  }

  function renderSharedStyles() {
    return `
      <style>
        :root {
          --paper: #f7f4ef;
          --ink: #191817;
          --muted: #5c5852;
          --accent: #7c3f2c;
        }
        body {
          font-family: 'Cormorant Garamond', 'Georgia', serif;
          background: var(--paper);
          color: var(--ink);
          margin: 0;
          padding: 2.5rem 4rem;
          line-height: 1.65;
        }
        header, nav, main, footer { max-width: 760px; margin: 0 auto; }
        nav a { margin-right: 1.5rem; color: var(--ink); text-decoration: underline; }
        .kicker-scale { font-family: 'Inter', sans-serif; font-size: 0.78rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
        figure { margin: 2rem 0; }
        img { max-width: 100%; height: auto; display: block; background: #e5dfd5; }
      </style>
    `;
  }

  function renderNav() {
    return `
      <header>
        <nav aria-label="Primary Studio Navigation">
          <a href="/">Atelier Index</a>
          <a href="/exhibitions">Exhibitions</a>
          <a href="/essays/light-and-form">Essay: Light &amp; Form</a>
          <a href="/archive/colophon">Colophon</a>
        </nav>
      </header>
    `;
  }

  function renderFooter() {
    return `
      <footer>
        <p>Atelier Nocturne — Paris &amp; Kyoto · <a href="/private-drafts">Studio Working Drafts (Internal)</a> · <a href="https://example.org/architectural-index" rel="noopener">External Archive Reference</a></p>
      </footer>
    `;
  }

  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://127.0.0.1:${port || 4174}`);
    const pathname = parsedUrl.pathname;
    const origin = getOrigin();
    const isAfter = mode === 'after';

    // 1. /robots.txt
    if (pathname === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(
        [
          '# robots.txt for Atelier Nocturne',
          'User-agent: *',
          'Disallow: /private-drafts',
          'Allow: /',
          `Sitemap: ${origin}/sitemap.xml`
        ].join('\n')
      );
      return;
    }

    // 2. /sitemap.xml
    if (pathname === '/sitemap.xml') {
      const urls = [
        `${origin}/`,
        `${origin}/exhibitions`,
        `${origin}/essays/light-and-form`,
        `${origin}/archive/colophon`
      ];
      // In 'before' mode, sitemap erroneously includes the robots-disallowed /private-drafts URL
      if (!isAfter) {
        urls.push(`${origin}/private-drafts`);
      }
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>`;
      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
      res.end(xml);
      return;
    }

    // 3. Static JS & SVG assets
    if (pathname === '/assets/gallery-motion.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end('console.log("Atelier Nocturne subtle plate transition ready.");');
      return;
    }

    if (pathname === '/assets/monolith-study.svg') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8' });
      res.end(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750"><rect width="1200" height="750" fill="#232220"/><path d="M240,0 L760,0 L520,750 L120,750 Z" fill="#dfd9ce" opacity="0.22"/></svg>'
      );
      return;
    }

    // 4. Homepage: /
    if (pathname === '/') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${isAfter ? 'Atelier Nocturne — Spatial Monographs &amp; Research' : 'Atelier Nocturne — Spatial Monographs'}</title>
  <meta name="description" content="Atelier Nocturne is an architectural research and book-design studio studying shadow, masonry acoustics, and quiet exhibition spaces.">
  <link rel="canonical" href="${origin}/">
  <meta property="og:title" content="Atelier Nocturne — Spatial Monographs &amp; Research">
  <meta property="og:description" content="Architectural research and book-design studio studying shadow, masonry acoustics, and quiet exhibition spaces.">
  <meta property="og:image" content="${origin}/assets/monolith-study.svg">
  ${renderSharedStyles()}
  <script src="/assets/gallery-motion.js"${isAfter ? ' defer' : ''}></script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "DesignAgency",
    "name": "Atelier Nocturne",
    "url": "${origin}/"
  }
  </script>
</head>
<body>
  ${renderNav()}
  <main id="main-content">
    <h1>Spatial Monographs &amp; Material Studies</h1>
    <p>We collaborate with curators, timber craftspeople, and architectural archives to document spaces defined by natural twilight and acoustic stillness.</p>
    <figure>
      ${
        isAfter
          ? '<img src="/assets/monolith-study.svg" alt="Charcoal study of the North Pavilion skylight casting a diagonal beam across board-formed concrete" width="1200" height="750">'
          : '<img src="/assets/monolith-study.svg">'
      }
      <figcaption>Plate I — North Pavilion Skylight Study, Autumn Equinox.</figcaption>
    </figure>
    <section aria-labelledby="dispatch-heading">
      <h2 id="dispatch-heading">Seasonal Salon Dispatches</h2>
      <p>Occasional notes when a new monograph goes to press.</p>
      <form action="/" method="get">
        ${
          isAfter
            ? '<label for="salon-email" class="sr-only">Email address for seasonal salon dispatches</label><input id="salon-email" type="email" name="email" placeholder="Your email for salon dispatches">'
            : '<input type="email" name="email" placeholder="Your email for salon dispatches">'
        }
        <button type="submit">Request Dispatch</button>
      </form>
    </section>
  </main>
  ${renderFooter()}
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // 5. Exhibitions page: /exhibitions
    if (pathname === '/exhibitions') {
      const jsonLdBlock = isAfter
        ? `{
    "@context": "https://schema.org",
    "@type": "ExhibitionEvent",
    "name": "Weight of Shadow: Monographs 2021–2026",
    "location": "Pavillon de l'Arsenal, Paris"
  }`
        : `{
    "@context": "https://schema.org",
    "@type": "ExhibitionEvent",
    "name": "Weight of Shadow: Monographs 2021–2026",
    "location": "Pavillon de l'Arsenal, Paris",
  }`;

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${isAfter ? 'Exhibitions &amp; Installations — Atelier Nocturne' : 'Atelier Nocturne — Spatial Monographs'}</title>
  <meta name="description" content="Selected architectural installations, tactile book tables, and lighting studies exhibited by Atelier Nocturne between 2021 and 2026.">
  <link rel="canonical" href="${origin}/exhibitions">
  <meta property="og:title" content="Exhibitions &amp; Installations — Atelier Nocturne">
  <meta property="og:description" content="Selected architectural installations, tactile book tables, and lighting studies.">
  <meta property="og:image" content="${origin}/assets/monolith-study.svg">
  ${renderSharedStyles()}
  <script type="application/ld+json">
  ${jsonLdBlock}
  </script>
</head>
<body>
  ${renderNav()}
  <main id="main-content">
    <h1>Exhibitions &amp; Tactile Archives</h1>
    <p>Each installation pairs unbound letterpress signatures with scaled timber models. <a href="#curator-notes">Jump to Curator Notes</a>.</p>
    <article>
      <h2>Weight of Shadow (Kyoto &amp; Paris)</h2>
      <p>An exploration of basalt thresholds and overcast daylight inside subterranean reading rooms.</p>
      <p>
        ${
          isAfter
            ? '<a href="/essays/light-and-form">Read the accompanying essay: Light and Architectural Form</a>'
            : '<a href="/essays/missing-monograph">Read the 2024 Venice Pavilion Monograph</a>'
        }
      </p>
    </article>
    <section id="${isAfter ? 'curator-notes' : 'curatorial-notes-legacy'}">
      <h2>Curator Notes on Lighting</h2>
      <p>All exhibition rooms are lit at 45 lux so paper grain and ink impression remain perceptible without glare.</p>
    </section>
  </main>
  ${renderFooter()}
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // 6. Essay page: /essays/light-and-form
    if (pathname === '/essays/light-and-form') {
      const html = `<!DOCTYPE html>
<html${isAfter ? ' lang="en"' : ''}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>On Light and Architectural Form — Atelier Nocturne</title>
  <meta name="description" content="An essay examining how north-facing clerestory apertures and lime plaster diffuse daylight across long reading tables.">
  <link rel="canonical" href="${origin}/essays/light-and-form">
  <meta property="og:title" content="On Light and Architectural Form — Atelier Nocturne">
  <meta property="og:description" content="An essay examining how north-facing clerestory apertures and lime plaster diffuse daylight.">
  <meta property="og:image" content="${origin}/assets/monolith-study.svg">
  ${renderSharedStyles()}
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    "headline": "On Light and Architectural Form",
    "author": "Atelier Nocturne Research Group"
  }
  </script>
</head>
<body>
  ${renderNav()}
  <main id="main-content">
    <h1>On Light and Architectural Form</h1>
    ${
      isAfter
        ? '<h2 class="kicker-scale">Monograph Essay No. 14 · Autumn Series</h2>'
        : '<h4 class="kicker-scale">Monograph Essay No. 14 · Autumn Series</h4>'
    }
    <p>When daylight grazes hand-troweled lime plaster at an acute angle, the wall ceases to act as a flat boundary and becomes an index of time and weather.</p>
    <h2>Acoustic Stillness in Masonry Rooms</h2>
    <p>Thick perimeter walls absorb street cadence, allowing visitors to engage with archival folios at an unhurried pace.</p>
  </main>
  ${renderFooter()}
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // 7. Minimalist Colophon page: /archive/colophon
    // Note: Intentionally omits <meta name="description"> in both states to illustrate
    // non-urgent P3 Contextual Refinement and organic body prose fallback.
    if (pathname === '/archive/colophon') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Colophon &amp; Printing Specifications — Atelier Nocturne</title>
  <link rel="canonical" href="${origin}/archive/colophon">
  <meta property="og:title" content="Colophon &amp; Printing Specifications — Atelier Nocturne">
  <meta property="og:description" content="Typesetting, paper stock, and archival binding specifications for Atelier Nocturne.">
  <meta property="og:image" content="${origin}/assets/monolith-study.svg">
  ${renderSharedStyles()}
</head>
<body>
  ${renderNav()}
  <main id="main-content">
    <h1>Colophon &amp; Edition Notes</h1>
    <p>Set in Cormorant Garamond and Inter. Printed on 135 gsm Cotton Rag at Imprimerie du Marais. Bound in exposed linen thread so every spread opens flat on the reading table.</p>
  </main>
  ${renderFooter()}
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // 8. Private Drafts page: /private-drafts (Disallowed in robots.txt)
    if (pathname === '/private-drafts') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html lang="en"><head><title>Internal Drafts</title></head><body><h1>Private Client Draft</h1></body></html>`);
      return;
    }

    // 9. Any other route (e.g. /essays/missing-monograph) -> 404
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html lang="en"><head><title>404 — Folio Not Found</title></head><body><main><h1>404 — Folio Not Found</h1><p>The requested archival folio does not exist at this path.</p></main></body></html>`);
  });

  return {
    start(desiredPort = 0) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(desiredPort, '127.0.0.1', () => {
          port = server.address().port;
          resolve({ port, origin: getOrigin(), mode });
        });
      });
    },
    stop() {
      return new Promise((resolve) => {
        if (!server.listening) return resolve();
        server.close(() => resolve());
      });
    },
    getMode() {
      return mode;
    },
    setMode(newMode) {
      mode = newMode === 'after' ? 'after' : 'before';
      return mode;
    },
    getOrigin
  };
}

module.exports = {
  createDemoFixtureServer
};
