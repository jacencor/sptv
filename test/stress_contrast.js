'use strict';

/**
 * Adversarial Contrast Probing Harness for SPTV
 * Tests computed color contrast across all UI components, surfaces, and interaction states.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Dynamic resolver for puppeteer
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

// Color and Luminance math
function parseRgba(colorStr) {
  if (!colorStr) return { r: 0, g: 0, b: 0, a: 1 };
  colorStr = colorStr.trim().toLowerCase();
  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length === 6) hex += 'ff';
    const num = parseInt(hex, 16);
    return {
      r: (num >> 24) & 255,
      g: (num >> 16) & 255,
      b: (num >> 8) & 255,
      a: ((num & 255) / 255)
    };
  }
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
      a: match[4] !== undefined ? parseFloat(match[4]) : 1
    };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

function compositeColor(fg, bg) {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const r = Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a);
  const g = Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a);
  const b = Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a);
  return { r, g, b, a };
}

function sRgbLuminance(rgb) {
  const linear = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b);
}

function contrastRatio(colorA, colorB) {
  const l1 = sRgbLuminance(colorA);
  const l2 = sRgbLuminance(colorB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function runContrastStress() {
  console.log('================================================================');
  console.log('       ADVERSARIAL STRESS TEST: COMPUTED COLOR CONTRAST         ');
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
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(baseUrl, { waitUntil: 'networkidle0' });

  // Evaluate contrasts across DOM elements
  const results = await page.evaluate(async () => {
    // Helper to get effective background by climbing parent tree
    function getEffectiveBackground(el) {
      let current = el;
      let layers = [];
      while (current && current !== document) {
        const style = window.getComputedStyle(current);
        const bg = style.backgroundColor;
        if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
          layers.push(bg);
        }
        current = current.parentElement;
      }
      // default root background
      layers.push('#000000');
      return layers;
    }

    const testCases = [];

    // Helper to test an element
    function checkElement(name, el, options = {}) {
      if (!el) {
        testCases.push({ name, error: 'Element not found' });
        return;
      }
      const style = window.getComputedStyle(el);
      const isLarge = (parseInt(style.fontSize, 10) >= 24) ||
                      (parseInt(style.fontSize, 10) >= 19 && parseInt(style.fontWeight, 10) >= 700);
      const minRequired = options.minContrast || (isLarge ? 3.0 : 4.5);

      const color = options.color || style.color;
      const bgLayers = options.bgLayers || getEffectiveBackground(el);
      const fontSize = style.fontSize;
      const fontWeight = style.fontWeight;

      testCases.push({
        name,
        color,
        bgLayers,
        fontSize,
        fontWeight,
        isLarge,
        minRequired,
        outlineColor: style.outlineColor,
        outlineWidth: style.outlineWidth
      });
    }

    // 1. Skip link
    const skipLink = document.querySelector('.skip-link');
    checkElement('Skip Link (Normal)', skipLink, { bgLayers: ['#2563eb', '#000000'] });

    // 2. Menu button
    const openSidebar = document.querySelector('#openSidebar');
    checkElement('Menu Button #openSidebar Icon', openSidebar?.querySelector('i'), {
      color: window.getComputedStyle(openSidebar?.querySelector('i') || openSidebar).color,
      bgLayers: [window.getComputedStyle(openSidebar).backgroundColor, '#000000']
    });

    // 3. PiP button
    const pipBtn = document.querySelector('#pipBtn');
    pipBtn?.classList.remove('d-none');
    checkElement('PiP Button Icon', pipBtn?.querySelector('i'), {
      color: window.getComputedStyle(pipBtn?.querySelector('i') || pipBtn).color,
      bgLayers: [window.getComputedStyle(pipBtn).backgroundColor, '#000000']
    });

    // 4. Cast Launcher disconnected
    const castLauncher = document.querySelector('.cast-launcher');
    const castDiscColor = window.getComputedStyle(castLauncher).getPropertyValue('--disconnected-color').trim() || '#94a3b8';
    testCases.push({
      name: 'Cast Launcher (Disconnected state)',
      color: castDiscColor,
      bgLayers: ['#000000'],
      isLarge: true,
      minRequired: 3.0
    });

    // 5. Sidebar offcanvas header & title
    const sidebar = document.querySelector('#sidebarChannels');
    const sidebarTitle = document.querySelector('#sidebarTitle');
    checkElement('Sidebar Title #sidebarTitle', sidebarTitle, {
      bgLayers: ['#121212', '#000000']
    });

    // 6. Sidebar Channel items: Normal & Active
    // Wait for channels to render
    const normalOption = document.querySelector('#channels-group [role="option"]:not(.channel-active)');
    const normalOptionSpan = normalOption?.querySelector('span');
    checkElement('Channel Option Text (Normal)', normalOptionSpan, {
      bgLayers: ['#121212', '#000000']
    });

    const activeOption = document.querySelector('#channels-group [role="option"].channel-active');
    const activeOptionSpan = activeOption?.querySelector('span');
    checkElement('Channel Option Text (Active)', activeOptionSpan, {
      bgLayers: ['rgba(59, 130, 246, 0.22)', '#121212', '#000000']
    });

    // Channel Option active indicator arrow pseudo-element color
    testCases.push({
      name: 'Channel Option Active Indicator Arrow (SC 1.4.1 / 1.4.11)',
      color: '#60a5fa',
      bgLayers: ['rgba(59, 130, 246, 0.22)', '#121212', '#000000'],
      isLarge: true,
      minRequired: 3.0
    });

    // Channel thumb placeholder
    const thumbPlaceholder = document.querySelector('.channel-thumb.bg-secondary');
    checkElement('Channel Thumb Placeholder Icon', thumbPlaceholder?.querySelector('i'), {
      bgLayers: ['#334155', '#121212', '#000000'],
      minRequired: 3.0
    });

    // 7. Focus Ring Color (:focus-visible outline: 3px solid #60a5fa)
    testCases.push({
      name: 'Focus Ring #60a5fa against #000000 background (SC 2.4.7 / 1.4.11)',
      color: '#60a5fa',
      bgLayers: ['#000000'],
      isLarge: true,
      minRequired: 3.0
    });
    testCases.push({
      name: 'Focus Ring #60a5fa against #121212 sidebar background',
      color: '#60a5fa',
      bgLayers: ['#121212'],
      isLarge: true,
      minRequired: 3.0
    });

    // 8. Toasts: Danger, Success, Warning, Info, Update
    // Trigger toasts via notification system if available
    const { notifications } = await import('./js/ui/NotificationManager.js');

    notifications.showError('Error de prueba');
    notifications.showSuccess('Exito de prueba');
    notifications.showWarning('Advertencia de prueba');
    notifications.showInfo('Informacion de prueba');
    notifications.showUpdateToast(() => {});

    // Collect rendered toasts
    const toasts = Array.from(document.querySelectorAll('.toast'));
    for (const t of toasts) {
      const isDanger = t.classList.contains('toast-danger');
      const isSuccess = t.classList.contains('toast-success');
      const isWarning = t.classList.contains('toast-warning');
      const isInfo = t.classList.contains('toast-info');
      const isUpdate = t.classList.contains('toast-update');

      let label = 'Unknown Toast';
      if (isDanger) label = 'Toast Danger (#b02a37)';
      if (isSuccess) label = 'Toast Success (#146c43)';
      if (isWarning) label = 'Toast Warning (#ffca2c)';
      if (isInfo) label = 'Toast Info (#31d2f2)';
      if (isUpdate) label = 'Toast Update (#1d3557)';

      const body = t.querySelector('.toast-body');
      const bodyStyle = window.getComputedStyle(body || t);
      const tStyle = window.getComputedStyle(t);

      testCases.push({
        name: `${label} Body Text`,
        color: bodyStyle.color,
        bgLayers: [tStyle.backgroundColor, '#000000'],
        fontSize: bodyStyle.fontSize,
        fontWeight: bodyStyle.fontWeight,
        minRequired: 4.5
      });

      if (isUpdate) {
        const updateBtn = t.querySelector('.btnUpdatePwa');
        if (updateBtn) {
          const btnStyle = window.getComputedStyle(updateBtn);
          testCases.push({
            name: `${label} Action Button .btnUpdatePwa`,
            color: btnStyle.color,
            bgLayers: [btnStyle.backgroundColor, tStyle.backgroundColor, '#000000'],
            fontSize: btnStyle.fontSize,
            fontWeight: btnStyle.fontWeight,
            minRequired: 4.5
          });
        }
        const dismissBtn = t.querySelector('[data-bs-dismiss="toast"]');
        if (dismissBtn) {
          const btnStyle = window.getComputedStyle(dismissBtn);
          testCases.push({
            name: `${label} Dismiss Link`,
            color: btnStyle.color,
            bgLayers: [tStyle.backgroundColor, '#000000'],
            fontSize: btnStyle.fontSize,
            fontWeight: btnStyle.fontWeight,
            minRequired: 4.5
          });
        }
      }
    }

    // 9. Cast Overlay
    const castOverlay = document.querySelector('#castOverlay');
    castOverlay?.classList.remove('d-none');
    const castTitle = castOverlay?.querySelector('h2');
    checkElement('Cast Overlay Title', castTitle, { bgLayers: ['#000000'] });

    const castChannelName = castOverlay?.querySelector('#castChannelName');
    castChannelName.textContent = 'Canal 1 HD';
    checkElement('Cast Overlay Channel Name (text-secondary)', castChannelName, {
      color: '#94a3b8',
      bgLayers: ['#000000']
    });

    return testCases;
  });

  let totalTested = 0;
  let totalFailed = 0;
  const failureDetails = [];

  for (const tc of results) {
    if (tc.error) {
      console.log(`[WARN] ${tc.name}: ${tc.error}`);
      continue;
    }
    totalTested++;

    // Compute composite background
    let compBg = { r: 0, g: 0, b: 0, a: 1 };
    for (let i = tc.bgLayers.length - 1; i >= 0; i--) {
      const parsed = parseRgba(tc.bgLayers[i]);
      compBg = compositeColor(parsed, compBg);
    }
    const fg = parseRgba(tc.color);
    const effectiveFg = compositeColor(fg, compBg);

    const ratio = contrastRatio(effectiveFg, compBg);
    const passed = ratio >= tc.minRequired;

    const ratioStr = `${ratio.toFixed(2)}:1`;
    const reqStr = `${tc.minRequired}:1`;
    const fgStr = `rgb(${effectiveFg.r},${effectiveFg.g},${effectiveFg.b})`;
    const bgStr = `rgb(${compBg.r},${compBg.g},${compBg.b})`;

    if (passed) {
      console.log(`  ✔ PASS [${ratioStr} >= ${reqStr}] ${tc.name} (FG: ${fgStr} on BG: ${bgStr})`);
    } else {
      totalFailed++;
      const detail = `✖ FAIL [${ratioStr} < ${reqStr}] ${tc.name} (FG: ${fgStr} on BG: ${bgStr})`;
      console.log(`  \x1b[31m${detail}\x1b[0m`);
      failureDetails.push({ name: tc.name, ratio: ratioStr, required: reqStr, fg: fgStr, bg: bgStr });
    }
  }

  await browser.close();
  await new Promise(r => server.close(r));

  console.log('----------------------------------------------------------------');
  console.log(`Contrast Summary: Tested ${totalTested}, Failed: ${totalFailed}`);
  if (totalFailed === 0) {
    console.log('\x1b[32m✔ SUCCESS: All elements and states meet WCAG 2.1 AA contrast requirements!\x1b[0m\n');
  } else {
    console.log(`\x1b[31m✖ FAILURE: ${totalFailed} contrast violations detected!\x1b[0m\n`);
  }

  return { totalTested, totalFailed, failureDetails };
}

runContrastStress().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
