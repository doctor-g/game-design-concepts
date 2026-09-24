import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';
import { createServer } from 'vite';
import astroConfig from './astro.config.mjs';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const DIST_DIR = path.join(process.cwd(), 'dist');
const BASE = astroConfig.base ?? '';

// -----------------------------------------------------------------------------
// Find all generated HTML files
// -----------------------------------------------------------------------------

function getHtmlFiles(dir, filesList = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const name = path.join(dir, file);

    if (fs.statSync(name).isDirectory()) {
      getHtmlFiles(name, filesList);
    } else if (file.endsWith('.html')) {
      filesList.push(name);
    }
  }

  return filesList;
}

// -----------------------------------------------------------------------------
// Convert a dist filename to the URL used by the Astro site.
//
//   dist/index.html
//       -> /game-design-concepts/
//
//   dist/about/index.html
//       -> /game-design-concepts/about/
//
//   dist/foo.html
//       -> /game-design-concepts/foo.html
// -----------------------------------------------------------------------------

function fileToUrlPath(file) {
  const relativePath = path.relative(DIST_DIR, file);
  let urlPath = relativePath.replace(/\\/g, '/');

  if (urlPath === 'index.html') {
    urlPath = '';
  } else {
    urlPath = urlPath.replace(/\/index\.html$/, '');
  }

  return `${BASE}/${urlPath}`.replace(/\/+$/, '/') || `${BASE}/`;
}

// -----------------------------------------------------------------------------
// Start a local server for the built site.
//
// Astro's generated HTML expects assets to live under BASE:
//
//   /game-design-concepts/_astro/foo.css
//
// But the contents of dist/ are rooted at:
//
//   dist/_astro/foo.css
//
// The middleware removes BASE before Vite looks for the file.
// -----------------------------------------------------------------------------

async function startServer() {
  const server = await createServer({
    root: DIST_DIR,
    server: {
      port: 0
    },
  });

  server.middlewares.use((req, _res, next) => {
    if (req.url?.startsWith(BASE)) {
      req.url = req.url.slice(BASE.length) || '/';
    }

    next();
  });

  await server.listen();

  const baseUrl = server.resolvedUrls?.local?.[0];

  if (!baseUrl) {
    throw new Error('Could not determine the local server URL.');
  }

  return {
    server,
    /* Strip off the final slash to prevent them doubling up with paths. */
    baseUrl: baseUrl.replace(/\/$/, ''),
  };
}

// -----------------------------------------------------------------------------
// Main audit
// -----------------------------------------------------------------------------

async function runAudit() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error(
      '❌ dist/ does not exist. Run "astro build" before running the audit.'
    );
    process.exit(1);
  }

  const htmlFiles = getHtmlFiles(DIST_DIR);

  if (htmlFiles.length === 0) {
    console.error(
      '❌ No HTML files found in dist/. Run "astro build" before running the audit.'
    );
    process.exit(1);
  }

  const { server, baseUrl }  = await startServer();

  console.log(`🚀 Serving ${DIST_DIR}`);
  console.log(`   ${baseUrl}`);

  console.log(
    `\n🔍 Starting WCAG 2.2 AA accessibility scan on ` +
    `${htmlFiles.length} pages...\n`
  );

  const browser = await chromium.launch();
  const context = await browser.newContext();

  let totalViolations = 0;
  let totalErrors = 0;

  try {
    for (const file of htmlFiles) {
      const relativePath = path.relative(DIST_DIR, file);
      const urlPath = fileToUrlPath(file);
      const targetUrl = `${baseUrl}${urlPath}`;

      console.log(`Testing: ${targetUrl}`);

      const page = await context.newPage();

      // -----------------------------------------------------------------------
      // Diagnostics
      //
      // These catch missing CSS, JavaScript, images, fonts, etc.
      // -----------------------------------------------------------------------

      const failedRequests = [];
      const httpErrors = [];

      page.on('requestfailed', request => {
        failedRequests.push({
          url: request.url(),
          error: request.failure()?.errorText,
        });
      });

      page.on('response', response => {
        if (response.status() >= 400) {
          httpErrors.push({
            status: response.status(),
            url: response.url(),
          });
        }
      });

      try {
        // This is a completely static site, so networkidle is sufficient.
        await page.goto(targetUrl, {
          waitUntil: 'networkidle',
        });

        // ---------------------------------------------------------------------
        // Check for failed network requests.
        // ---------------------------------------------------------------------

        if (failedRequests.length > 0 || httpErrors.length > 0) {
          console.error(`⚠️  Network problems on ${relativePath}`);

          for (const request of failedRequests) {
            console.error(
              `   REQUEST FAILED: ${request.url()} ` +
              `(${request.error ?? 'unknown error'})`
            );
          }

          for (const response of httpErrors) {
            console.error(
              `   HTTP ${response.status}: ${response.url}`
            );
          }

          totalErrors++;
        }

        // ---------------------------------------------------------------------
        // Verify that stylesheets actually loaded.
        // ---------------------------------------------------------------------

        const stylesheets = await page.locator(
          'link[rel="stylesheet"]'
        ).evaluateAll(links =>
          links.map(link => ({
            href: link.href,
            sheet: Boolean(link.sheet),
          }))
        );

        const unloadedStylesheets = stylesheets.filter(
          stylesheet => !stylesheet.sheet
        );

        if (unloadedStylesheets.length > 0) {
          console.error(
            `⚠️  ${unloadedStylesheets.length} stylesheet(s) failed to load:`
          );

          for (const stylesheet of unloadedStylesheets) {
            console.error(`   ${stylesheet.href}`);
          }

          totalErrors++;
        }

        // ---------------------------------------------------------------------
        // Run axe.
        // ---------------------------------------------------------------------

        const results = await new AxeBuilder({ page })
          .withTags([
            'wcag2a',
            'wcag2aa',
            'wcag21a',
            'wcag21aa',
            'wcag22aa',
          ])
          .analyze();

        if (results.violations.length > 0) {
          console.error(
            `❌ [FAIL] ${relativePath} has ` +
            `${results.violations.length} accessibility violation(s):`
          );

          for (const violation of results.violations) {
            totalViolations++;

            console.error(
              `  - [${violation.id}]: ${violation.description}`
            );
            console.error(
              `    Impact: ${violation.impact} | Help: ${violation.helpUrl}`
            );

            for (const node of violation.nodes) {
              console.error(`    Target: ${node.html}`);
            }
          }

          console.error('\n' + '='.repeat(60) + '\n');
        } else {
          console.log(`✅ [PASS] ${relativePath}\n`);
        }

      } catch (err) {
        console.error(
          `💥 Failed to test ${targetUrl}:`,
          err instanceof Error ? err.message : err
        );

        totalErrors++;
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  // ---------------------------------------------------------------------------
  // Final result
  // ---------------------------------------------------------------------------

  console.log('\n' + '='.repeat(60));

  if (totalViolations > 0 || totalErrors > 0) {
    console.error('❌ Accessibility audit failed:');
    console.error(`   Accessibility violations: ${totalViolations}`);
    console.error(`   Test/server errors:       ${totalErrors}`);
    console.error('='.repeat(60));

    process.exit(1);
  }

  console.log(
    '🎉 Accessibility audit passed: no WCAG 2.2 AA violations found.'
  );
  console.log('='.repeat(60));

  process.exit(0);
}

runAudit();
