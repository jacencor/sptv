#!/usr/bin/env node
'use strict';

/**
 * SPTV Automated Accessibility Audit Runner
 *
 * Runs Pa11y with the Axe-core runner evaluating WCAG 2.1 Level AA rules
 * across multiple interactive scenarios:
 *   - Scenario 1: Initial Default View (Video player and overlay controls)
 *   - Scenario 2: Interactive Sidebar View (Offcanvas channel drawer)
 *
 * Starts a built-in static HTTP server on an ephemeral port (port 0)
 * to bypass browser file:// CORS restrictions and prevent port collisions.
 *
 * Exits with code 0 ONLY when total violations across all scenarios === 0.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Dynamic resolver supporting local node_modules, npm-cache, and global installs
function resolvePa11y() {
  try {
    return require('pa11y');
  } catch (err) {
    // Check Windows npx cache
    const npxCacheBase = path.join(os.homedir(), 'AppData', 'Local', 'npm-cache', '_npx');
    if (fs.existsSync(npxCacheBase)) {
      try {
        const subdirs = fs.readdirSync(npxCacheBase);
        for (const dir of subdirs) {
          const candidate = path.join(npxCacheBase, dir, 'node_modules', 'pa11y');
          if (fs.existsSync(candidate)) {
            return require(candidate);
          }
        }
      } catch (scanErr) {
        // Fall through to global candidate
      }
    }
    // Check user global node_modules
    const globalCandidate = path.join(os.homedir(), 'node_modules', 'pa11y');
    if (fs.existsSync(globalCandidate)) {
      return require(globalCandidate);
    }
    throw new Error(
      'Could not locate "pa11y" package.\n' +
      'Please install dependencies via: npm install\n' +
      'Or run via npx: npx pa11y --runner axe http://127.0.0.1:<port>/index.html'
    );
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.vtt': 'text/vtt; charset=utf-8',
  '.m3u': 'text/plain; charset=utf-8',
  '.m3u8': 'application/vnd.apple.mpegurl'
};

function createStaticServer(rootDir) {
  return http.createServer((req, res) => {
    try {
      let reqPath = decodeURI(req.url.split('?')[0]);
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
      const resolvedRoot = path.resolve(rootDir);
      const safePath = path.normalize(path.join(resolvedRoot, reqPath));

      // Prevent directory traversal
      if (!safePath.startsWith(resolvedRoot)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('403 Forbidden');
      }

      if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end(`404 Not Found: ${reqPath}`);
      }

      const ext = path.extname(safePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      fs.createReadStream(safePath).pipe(res);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`500 Internal Server Error: ${err.message}`);
    }
  });
}

async function runAudit() {
  console.log('================================================================');
  console.log('       SPTV AUTOMATED ACCESSIBILITY AUDIT (WCAG 2.1 AA)         ');
  console.log('================================================================');

  let pa11y;
  try {
    pa11y = resolvePa11y();
  } catch (err) {
    console.error(`\n[FATAL] ${err.message}\n`);
    process.exit(1);
  }

  const rootDir = process.cwd();
  const server = createStaticServer(rootDir);

  // Bind server to ephemeral port 0 on loopback
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });

  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/index.html`;
  console.log(`[INFO] Ephemeral HTTP server started on http://127.0.0.1:${port}`);

  // Ensure graceful shutdown on signals
  const cleanupAndExit = (code) => {
    server.close(() => {
      console.log(`[INFO] Ephemeral server on port ${port} released.`);
      process.exit(code);
    });
  };

  process.on('SIGINT', () => cleanupAndExit(1));
  process.on('SIGTERM', () => cleanupAndExit(1));

  const scenarios = [
    {
      id: 'scenario-1',
      name: 'Scenario 1: Initial Default View (Video Player & Overlay Controls)',
      options: {
        runners: ['axe'],
        standard: 'WCAG2AA',
        timeout: 30000,
        wait: 500,
        chromeLaunchConfig: {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
      }
    },
    {
      id: 'scenario-2',
      name: 'Scenario 2: Interactive Sidebar View (Offcanvas Channel Drawer)',
      options: {
        runners: ['axe'],
        standard: 'WCAG2AA',
        timeout: 30000,
        wait: 500,
        actions: [
          'click element #openSidebar',
          'wait for element #sidebarChannels.show:not(.showing) to be visible',
          'wait for element #channels-group [role="option"], #channels-group button to be added'
        ],
        chromeLaunchConfig: {
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
      }
    }
  ];

  let totalViolations = 0;
  const summaryReport = [];

  try {
    for (const scenario of scenarios) {
      console.log(`\n----------------------------------------------------------------`);
      console.log(`Executing: ${scenario.name}`);
      console.log(`----------------------------------------------------------------`);

      const startTime = Date.now();
      const results = await pa11y(baseUrl, scenario.options);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      const violations = (results.issues || []).filter(issue => issue.type === 'error');
      totalViolations += violations.length;

      summaryReport.push({
        id: scenario.id,
        name: scenario.name,
        duration: `${duration}s`,
        violationsCount: violations.length,
        violations: violations
      });

      if (violations.length === 0) {
        console.log(`\x1b[32m✔ PASS\x1b[0m (${duration}s): 0 WCAG 2.1 AA violations detected.`);
      } else {
        console.log(`\x1b[31m✖ FAIL\x1b[0m (${duration}s): ${violations.length} violation(s) detected:`);
        violations.forEach((v, idx) => {
          console.log(`\n  [Violation ${idx + 1}]`);
          console.log(`    Rule ID:   \x1b[33m${v.code}\x1b[0m`);
          console.log(`    Selector:  ${v.selector}`);
          console.log(`    Message:   ${v.message}`);
          if (v.context) {
            console.log(`    Context:   ${v.context.trim()}`);
          }
        });
      }
    }
  } catch (runErr) {
    console.error(`\n[ERROR] Audit runner encountered an unexpected failure:`, runErr);
    totalViolations += 1;
  } finally {
    await new Promise(resolve => server.close(resolve));
    console.log(`\n[INFO] Ephemeral server on port ${port} released cleanly.`);
  }

  console.log(`\n================================================================`);
  console.log(`                        AUDIT SUMMARY                           `);
  console.log(`================================================================`);
  summaryReport.forEach(item => {
    const statusText = item.violationsCount === 0 ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`- ${item.name}: ${statusText} (${item.violationsCount} violations, ${item.duration})`);
  });
  console.log(`----------------------------------------------------------------`);
  console.log(`Total Violations: ${totalViolations}`);

  if (totalViolations === 0) {
    console.log(`\x1b[32m\x1b[1mSUCCESS: All scenarios achieved 0 WCAG 2.1 AA violations!\x1b[0m\n`);
    process.exit(0);
  } else {
    console.error(`\x1b[31m\x1b[1mFAILURE: Expected 0 violations, found ${totalViolations}.\x1b[0m\n`);
    process.exit(1);
  }
}

runAudit();
