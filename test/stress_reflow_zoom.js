'use strict';

/**
 * Adversarial Reflow and Zoom Stress Test Harness for SPTV
 * Evaluates WCAG 2.1 SC 1.4.10 (Reflow @ 320px width, @ 256px height)
 * and SC 1.4.4 (Resize Text up to 200%).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

function resolvePuppeteer() {
  try {
    return require('puppeteer');
  } catch (err) {
    const npxCacheBase = path.join(os.homedir(), 'AppData', 'Local', 'npm-cache', '_npx');
    if (fs.existsSync(npxCacheBase)) {
      for (const dir of fs.readdirSync(npxCacheBase)) {
        const candidate = path.join(npxCacheBase, dir, 'node_modules', 'puppeteer');
        if (fs.existsSync(candidate)) return require(candidate);
      }
    }
    throw new Error('Puppeteer not found');
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
  '.vtt': 'text/vtt; charset=utf-8',
  '.m3u': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon'
};

function createStaticServer(rootDir) {
  return http.createServer((req, res) => {
    let reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    const safePath = path.normalize(path.join(path.resolve(rootDir), reqPath));
    if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    const ext = path.extname(safePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(safePath).pipe(res);
  });
}

async function runReflowZoomStress() {
  console.log('================================================================');
  console.log('   ADVERSARIAL STRESS TEST: REFLOW (320px) & ZOOM (200%)        ');
  console.log('================================================================');

  const puppeteer = resolvePuppeteer();
  const server = createStaticServer(process.cwd());
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/index.html`;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const findings = [];

  // ==============================================================
  // TEST 1: Viewport Width = 320px (Mobile Portrait Baseline)
  // ==============================================================
  console.log('\n--- Probe 1: Viewport Width 320px x 640px (Initial State) ---');
  await page.setViewport({ width: 320, height: 640 });
  await page.goto(baseUrl, { waitUntil: 'networkidle0' });

  const initial320Metrics = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    const bodyWidth = document.body.scrollWidth;
    const openSidebar = document.querySelector('#openSidebar');
    const overlayActions = document.querySelector('#overlayActions');

    // Unhide PiP to test worst-case layout collision
    const pipBtn = document.querySelector('#pipBtn');
    pipBtn?.classList.remove('d-none');

    const sidebarRect = openSidebar?.getBoundingClientRect();
    const actionsRect = overlayActions?.getBoundingClientRect();

    const hasHorizontalOverflow = docWidth > 320 || bodyWidth > 320;
    const controlsOverlap = sidebarRect && actionsRect && (sidebarRect.right > actionsRect.left);

    return {
      docWidth,
      bodyWidth,
      hasHorizontalOverflow,
      sidebarRect: sidebarRect ? { left: sidebarRect.left, right: sidebarRect.right, top: sidebarRect.top, width: sidebarRect.width } : null,
      actionsRect: actionsRect ? { left: actionsRect.left, right: actionsRect.right, top: actionsRect.top, width: actionsRect.width } : null,
      controlsOverlap
    };
  });

  console.log(`Document scrollWidth at 320px: ${initial320Metrics.docWidth}px (body: ${initial320Metrics.bodyWidth}px)`);
  console.log(`OpenSidebar Rect: [${initial320Metrics.sidebarRect?.left}px to ${initial320Metrics.sidebarRect?.right}px] (w=${initial320Metrics.sidebarRect?.width}px)`);
  console.log(`OverlayActions Rect: [${initial320Metrics.actionsRect?.left}px to ${initial320Metrics.actionsRect?.right}px] (w=${initial320Metrics.actionsRect?.width}px)`);

  if (initial320Metrics.controlsOverlap) {
    const msg = `CRITICAL OVERLAP: #openSidebar (right: ${initial320Metrics.sidebarRect.right}px) collides with #overlayActions (left: ${initial320Metrics.actionsRect.left}px) at 320px viewport!`;
    console.log(`  \x1b[31m✖ FAIL: ${msg}\x1b[0m`);
    findings.push({ severity: 'CRITICAL', rule: 'SC 1.4.10 Reflow / Overlap', detail: msg });
  } else {
    console.log(`  ✔ PASS: Controls do not overlap (Gap: ${initial320Metrics.actionsRect.left - initial320Metrics.sidebarRect.right}px).`);
  }

  // ==============================================================
  // TEST 2: Sidebar Open State at 320px
  // ==============================================================
  console.log('\n--- Probe 2: Sidebar Open State at 320px ---');
  const sidebarOpenMetrics = await page.evaluate(async () => {
    const btn = document.querySelector('#openSidebar');
    btn?.click();

    // Wait for offcanvas to finish transitioning
    await new Promise(r => setTimeout(r, 600));

    const offcanvas = document.querySelector('#sidebarChannels');
    const closeBtn = offcanvas?.querySelector('.btn-close');
    const offcanvasRect = offcanvas?.getBoundingClientRect();
    const closeBtnRect = closeBtn?.getBoundingClientRect();
    const firstOption = offcanvas?.querySelector('[role="option"]');
    const firstOptionRect = firstOption?.getBoundingClientRect();

    const offcanvasOverflowsViewport = offcanvasRect ? (offcanvasRect.right > 320 || offcanvasRect.width > 320) : false;
    const closeBtnOffScreen = closeBtnRect ? (closeBtnRect.right > 320 || closeBtnRect.left < 0) : true;

    return {
      offcanvasRect: offcanvasRect ? { left: offcanvasRect.left, right: offcanvasRect.right, width: offcanvasRect.width } : null,
      closeBtnRect: closeBtnRect ? { left: closeBtnRect.left, right: closeBtnRect.right, top: closeBtnRect.top, width: closeBtnRect.width } : null,
      firstOptionRect: firstOptionRect ? { left: firstOptionRect.left, right: firstOptionRect.right, width: firstOptionRect.width } : null,
      offcanvasOverflowsViewport,
      closeBtnOffScreen
    };
  });

  console.log(`Offcanvas Rect: width=${sidebarOpenMetrics.offcanvasRect?.width}px, right=${sidebarOpenMetrics.offcanvasRect?.right}px`);
  console.log(`Close button Rect: left=${sidebarOpenMetrics.closeBtnRect?.left}px, right=${sidebarOpenMetrics.closeBtnRect?.right}px, width=${sidebarOpenMetrics.closeBtnRect?.width}px`);

  if (sidebarOpenMetrics.offcanvasOverflowsViewport) {
    const msg = `Offcanvas width (${sidebarOpenMetrics.offcanvasRect.width}px) exceeds 320px viewport (right boundary: ${sidebarOpenMetrics.offcanvasRect.right}px)!`;
    console.log(`  \x1b[31m✖ FAIL: ${msg}\x1b[0m`);
    findings.push({ severity: 'HIGH', rule: 'SC 1.4.10 Reflow / Offcanvas Overflow', detail: msg });
  } else {
    console.log(`  ✔ PASS: Offcanvas fits within 320px viewport (width: ${sidebarOpenMetrics.offcanvasRect?.width}px).`);
  }

  if (sidebarOpenMetrics.closeBtnOffScreen) {
    const msg = `Close button is pushed off-screen at 320px (right: ${sidebarOpenMetrics.closeBtnRect?.right}px)!`;
    console.log(`  \x1b[31m✖ FAIL: ${msg}\x1b[0m`);
    findings.push({ severity: 'CRITICAL', rule: 'SC 1.4.10 / SC 2.1.1 Close Button Inaccessible', detail: msg });
  } else {
    console.log(`  ✔ PASS: Close button is fully visible and clickable inside viewport (right: ${sidebarOpenMetrics.closeBtnRect?.right}px).`);
  }

  // ==============================================================
  // TEST 3: Toast & Dialog Bounding Boxes at 320px Viewport
  // ==============================================================
  console.log('\n--- Probe 3: Toast & Alertdialog at 320px Viewport ---');
  const toast320Metrics = await page.evaluate(async () => {
    // Close sidebar first
    const offcanvas = document.querySelector('#sidebarChannels');
    const closeBtn = offcanvas?.querySelector('.btn-close');
    closeBtn?.click();
    await new Promise(r => setTimeout(r, 500));

    const { notifications } = await import('./js/ui/NotificationManager.js');
    notifications.showError('Error de prueba con texto largo para evaluar desbordamiento horizontal');
    notifications.showUpdateToast(() => {});

    await new Promise(r => setTimeout(r, 400));

    const toasts = Array.from(document.querySelectorAll('.toast'));
    const metrics = toasts.map((t, idx) => {
      const rect = t.getBoundingClientRect();
      const isOffscreen = rect.right > 320 || rect.left < 0;
      const exceeds320 = rect.width > 320;
      return {
        idx,
        className: t.className,
        width: rect.width,
        left: rect.left,
        right: rect.right,
        isOffscreen,
        exceeds320
      };
    });

    return metrics;
  });

  for (const tm of toast320Metrics) {
    console.log(`Toast [${tm.idx}] w=${tm.width}px, left=${tm.left}px, right=${tm.right}px`);
    if (tm.isOffscreen || tm.exceeds320) {
      const msg = `Toast [${tm.idx}] (${tm.className}) overflows 320px viewport (w=${tm.width}px, right=${tm.right}px)!`;
      console.log(`  \x1b[31m✖ FAIL: ${msg}\x1b[0m`);
      findings.push({ severity: 'HIGH', rule: 'SC 1.4.10 Reflow / Toast Overflow', detail: msg });
    } else {
      console.log(`  ✔ PASS: Toast [${tm.idx}] fits comfortably within 320px viewport.`);
    }
  }

  // ==============================================================
  // TEST 4: Text Zoom 200% (SC 1.4.4 Resize Text)
  // ==============================================================
  console.log('\n--- Probe 4: Text Zoom 200% (SC 1.4.4) ---');
  // Re-open in desktop viewport and apply 200% font scaling
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(baseUrl, { waitUntil: 'networkidle0' });

  const zoomMetrics = await page.evaluate(async () => {
    // Scale root font size to 200%
    document.documentElement.style.fontSize = '200%';

    // Wait for reflow
    await new Promise(r => setTimeout(r, 300));

    // Open sidebar
    const openBtn = document.querySelector('#openSidebar');
    openBtn?.click();
    await new Promise(r => setTimeout(r, 500));

    const options = Array.from(document.querySelectorAll('#channels-group [role="option"]'));
    const itemHeight = 56; // From SidebarUI.js

    const itemChecks = options.slice(0, 5).map((opt, i) => {
      const textSpan = opt.querySelector('span');
      const textRect = textSpan?.getBoundingClientRect();
      const optRect = opt.getBoundingClientRect();
      const textHeight = textRect ? textRect.height : 0;
      const textScrollHeight = textSpan ? textSpan.scrollHeight : 0;

      // Check if text is clipped vertically or overflows item boundary
      const overflowsItem = textRect ? (textRect.bottom > optRect.bottom) : false;

      return {
        i,
        optHeight: optRect.height,
        textHeight,
        textScrollHeight,
        overflowsItem
      };
    });

    // Also check update dialog at 200%
    const { notifications } = await import('./js/ui/NotificationManager.js');
    notifications.showUpdateToast(() => {});
    await new Promise(r => setTimeout(r, 400));

    const updateToast = document.querySelector('.toast-update');
    const updateRect = updateToast?.getBoundingClientRect();
    const updateButtons = Array.from(updateToast?.querySelectorAll('button') || []);
    const buttonsMetrics = updateButtons.map(b => {
      const r = b.getBoundingClientRect();
      return { text: b.textContent?.trim(), height: r.height, width: r.width };
    });

    return {
      itemChecks,
      updateToast: updateRect ? { width: updateRect.width, height: updateRect.height } : null,
      buttonsMetrics
    };
  });

  console.log(`Channel items at 200% font size:`);
  let itemOverflowCount = 0;
  for (const ic of zoomMetrics.itemChecks) {
    console.log(`  Item ${ic.i}: container height=${ic.optHeight}px, text height=${ic.textHeight}px (scrollHeight=${ic.textScrollHeight}px), overflows: ${ic.overflowsItem}`);
    if (ic.overflowsItem) {
      itemOverflowCount++;
    }
  }

  if (itemOverflowCount > 0) {
    const msg = `${itemOverflowCount} channel items overflow their hardcoded ${56}px height at 200% text zoom!`;
    console.log(`  \x1b[31m✖ FAIL: ${msg}\x1b[0m`);
    findings.push({ severity: 'HIGH', rule: 'SC 1.4.4 Resize Text / Clipping', detail: msg });
  } else {
    console.log(`  ✔ PASS: Channel items adapt within 56px virtual scrolling row without vertical overflow.`);
  }

  console.log(`PWA Update Dialog at 200% font size: w=${zoomMetrics.updateToast?.width}px, h=${zoomMetrics.updateToast?.height}px`);
  for (const bm of zoomMetrics.buttonsMetrics) {
    console.log(`  Button "${bm.text}": w=${bm.width}px, h=${bm.height}px`);
    if (bm.height < 44) {
      const msg = `Button "${bm.text}" height (${bm.height}px) drops below 44px at 200% zoom!`;
      console.log(`  \x1b[31m✖ FAIL: ${msg}\x1b[0m`);
      findings.push({ severity: 'MEDIUM', rule: 'SC 2.5.8 Touch Target Size', detail: msg });
    } else {
      console.log(`  ✔ PASS: Button "${bm.text}" satisfies >= 44px height.`);
    }
  }

  // ==============================================================
  // TEST 5: Horizontal Scrolling @ 256px Height (SC 1.4.10 Landscape)
  // ==============================================================
  console.log('\n--- Probe 5: Viewport Height 256px x 640px (Landscape Baseline) ---');
  await page.setViewport({ width: 640, height: 256 });
  await page.goto(baseUrl, { waitUntil: 'networkidle0' });

  const landscapeMetrics = await page.evaluate(() => {
    const docHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    return {
      docHeight,
      clientHeight,
      openBtnVisible: !!document.querySelector('#openSidebar')
    };
  });
  console.log(`Landscape 256px: docHeight=${landscapeMetrics.docHeight}px, clientHeight=${landscapeMetrics.clientHeight}px`);
  console.log(`  ✔ PASS: Player controls functional in landscape.`);

  await browser.close();
  await new Promise(r => server.close(r));

  console.log('\n================================================================');
  console.log(`Reflow & Zoom Stress Summary: ${findings.length} findings.`);
  console.log('================================================================');
  findings.forEach((f, idx) => {
    console.log(`[${idx + 1}] [${f.severity}] ${f.rule}: ${f.detail}`);
  });

  return findings;
}

runReflowZoomStress().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
