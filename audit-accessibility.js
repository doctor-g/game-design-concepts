import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';
import { createServer } from 'vite';

// Configuration
const DIST_DIR = path.join(process.cwd(), 'dist');
const PORT = 4321;

// Helper to recursively find all HTML files in the dist folder
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

async function runAudit() {
  // 1. Start a local preview server of your static dist folder
  const server = await createServer({
    root: DIST_DIR,
    server: { port: PORT }
  });
  await server.listen();

  // 2. Discover all built HTML pages
  const htmlFiles = getHtmlFiles(DIST_DIR);
  if (htmlFiles.length === 0) {
    console.error('❌ No HTML files found in dist/. Run "astro build" first.');
    process.exit(1);
  }

  // 3. Launch Playwright headless browser
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  let totalViolations = 0;

  console.log(`\n🔍 Starting WCAG 2.2 AA Accessibility Scan on ${htmlFiles.length} pages...\n`);

  for (const file of htmlFiles) {
    // Convert system path to local server URL path
    const relativePath = path.relative(DIST_DIR, file);
    const urlPath = relativePath.replace(/index\.html\$/, '').replace(/\\/g, '/');
    const targetUrl = `http://localhost:${PORT}/${urlPath}`;

    console.log(`Testing: ${targetUrl}`);

    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle' });

      // Configure Axe to enforce WCAG 2.2 AA rules
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      if (results.violations.length > 0) {
        console.error(`❌ [FAIL] ${relativePath} has ${results.violations.length} accessibility violation(s):`);

        results.violations.forEach((violation) => {
          totalViolations++;
          console.error(`  - [${violation.id}]: ${violation.description}`);
          console.error(`    Impact: ${violation.impact} | Help: ${violation.helpUrl}`);
          violation.nodes.forEach((node) => {
            console.error(`    Target HTML Element: ${node.html}`);
          });
        });
        console.error('\n' + '='.repeat(50) + '\n');
      } else {
        console.log(`✅ [PASS] ${relativePath}\n`);
      }
    } catch (err) {
      console.error(`💥 Failed to test ${targetUrl}:`, err.message);
      totalViolations++;
    }
  }

  // Cleanup
  await browser.close();
  await server.close();

  // 4. Force build failure if rules are broken
  if (totalViolations > 0) {
    console.error(`❌ Build failed: Found ${totalViolations} total accessibility violations.`);
    process.exit(1);
  } else {
    console.log('🎉 Excellent work! All pages passed WCAG 2.2 AA requirements.');
    process.exit(0);
  }
}

runAudit();
