#!/usr/bin/env node
'use strict';

/**
 * Challenger M1-1: Automated Keyboard Navigation & Focus Management Stress Harness
 *
 * Evaluates:
 * 1. Rapid Tabbing & Keyboard Trap Immunity
 * 2. Focus Restoration across all 5 Drawer Dismissal Vectors
 * 3. Idle Timer Interactions, Focus-Visible Retention, and Keyboard Wakeup (SC 2.4.7)
 * 4. Unhijacked Key Interactions on Interactive Controls & Video (SC 2.1.1, 2.1.2)
 * 5. Alertdialog Focus Trapping & Dismissal (Update Modal)
 * 6. Virtual Listbox Roving Tabindex & Keyboard Navigation
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Dynamic resolver for Puppeteer
function resolvePuppeteer() {
  try {
    return require('puppeteer');
  } catch (err) {
    const npxCacheBase = path.join(os.homedir(), 'AppData', 'Local', 'npm-cache', '_npx');
    if (fs.existsSync(npxCacheBase)) {
      try {
        const subdirs = fs.readdirSync(npxCacheBase);
        for (const dir of subdirs) {
          const candidate = path.join(npxCacheBase, dir, 'node_modules', 'puppeteer');
          if (fs.existsSync(candidate)) return require(candidate);
        }
      } catch (scanErr) {}
    }
    const globalCandidate = path.join(os.homedir(), 'node_modules', 'puppeteer');
    if (fs.existsSync(globalCandidate)) return require(globalCandidate);
    throw new Error('Puppeteer could not be resolved.');
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

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function runStressTests() {
  console.log('================================================================');
  console.log('   CHALLENGER M1-1: KEYBOARD NAVIGATION & FOCUS STRESS HARNESS  ');
  console.log('================================================================\n');

  const puppeteer = resolvePuppeteer();
  const rootDir = process.cwd();
  const server = createStaticServer(rootDir);

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });

  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/index.html`;
  console.log(`[INFO] Test server running on http://127.0.0.1:${port}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const testResults = [];

  function recordResult(name, passed, details = '') {
    testResults.push({ name, passed, details });
    const status = passed ? '\x1b[32m✔ PASS\x1b[0m' : '\x1b[31m✖ FAIL\x1b[0m';
    console.log(`  ${status} | ${name}${details ? ` -> ${details}` : ''}`);
  }

  try {
    // Navigate and wait for app to be ready
    await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.waitForSelector('#openSidebar', { timeout: 5000 });
    // Wait for channel data to load
    await page.waitForSelector('#channels-group [role="option"]', { timeout: 5000 });

    // Enable PiP button in DOM for testing PiP keyboard interactions
    await page.evaluate(() => {
      const pip = document.getElementById('pipBtn');
      if (pip) pip.classList.remove('d-none');
    });

    console.log('\n--- SUITE 1: Rapid Tabbing & Focus Trapping Immunity ---');

    // 1A. Forward rapid tabbing
    {
      await page.evaluate(() => document.body.focus());
      const tabOrder = [];
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab');
        await delay(50);
        const activeInfo = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            tagName: el.tagName,
            id: el.id,
            className: el.className,
            role: el.getAttribute('role')
          };
        });
        tabOrder.push(`${activeInfo.tagName}#${activeInfo.id || activeInfo.role || activeInfo.className.split(' ')[0]}`);
      }

      const hasSkipLink = tabOrder.some(s => s.includes('skip-link') || s.includes('A#'));
      const hasOpenSidebar = tabOrder.some(s => s.includes('openSidebar'));
      const passed = hasSkipLink && hasOpenSidebar;
      recordResult(
        '1A. Rapid forward Tab cycle traversal',
        passed,
        `Tabbing sequence: [${tabOrder.join(' -> ')}]`
      );
    }

    // 1B. Rapid reverse tabbing (Shift+Tab)
    {
      // Focus video, then shift-tab back
      await page.evaluate(() => {
        const v = document.getElementById('video');
        if (v) v.focus();
      });
      const reverseOrder = [];
      for (let i = 0; i < 5; i++) {
        await page.keyboard.down('Shift');
        await page.keyboard.press('Tab');
        await page.keyboard.up('Shift');
        await delay(50);
        const activeId = await page.evaluate(() => document.activeElement ? (document.activeElement.id || document.activeElement.className) : 'none');
        reverseOrder.push(activeId);
      }
      const passed = reverseOrder.some(id => id.includes('openSidebar') || id.includes('skip-link'));
      recordResult(
        '1B. Rapid reverse Shift+Tab traversal',
        passed,
        `Reverse sequence: [${reverseOrder.join(' -> ')}]`
      );
    }

    // 1C. Focus trapping check when offcanvas is closed
    {
      // Tab 20 times continuously. Focus should never get stuck indefinitely.
      let stuck = false;
      let lastElement = null;
      let repeatCount = 0;
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab');
        await delay(30);
        const curEl = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 40));
        if (curEl === lastElement) {
          repeatCount++;
          if (repeatCount > 3) {
            stuck = true;
            break;
          }
        } else {
          repeatCount = 0;
          lastElement = curEl;
        }
      }
      recordResult(
        '1C. 20x Rapid Tab Stress without Focus Trapping',
        !stuck,
        stuck ? 'Focus got trapped on element' : 'Focus advanced smoothly across cycles'
      );
    }

    console.log('\n--- SUITE 2: Focus Restoration on Drawer Dismissal (5 Vectors) ---');

    // Vector 2A: Dismiss via Escape key
    {
      await page.click('#openSidebar');
      await page.waitForSelector('#sidebarChannels.show', { timeout: 3000 });
      await delay(100);

      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('sidebarChannels').classList.contains('show'), { timeout: 3000 });
      await delay(150);

      const activeId = await page.evaluate(() => document.activeElement?.id);
      recordResult(
        '2A. Focus restoration on Escape key dismiss',
        activeId === 'openSidebar',
        `Active element after Escape: #${activeId}`
      );
    }

    // Vector 2B: Dismiss via Close Button (.btn-close)
    {
      await page.click('#openSidebar');
      await page.waitForSelector('#sidebarChannels.show', { timeout: 3000 });
      await delay(100);

      await page.click('#sidebarChannels .btn-close');
      await page.waitForFunction(() => !document.getElementById('sidebarChannels').classList.contains('show'), { timeout: 3000 });
      await delay(150);

      const activeId = await page.evaluate(() => document.activeElement?.id);
      recordResult(
        '2B. Focus restoration on Close Button click',
        activeId === 'openSidebar',
        `Active element after Close Button: #${activeId}`
      );
    }

    // Vector 2C: Dismiss via Backdrop Outside Click
    {
      await page.click('#openSidebar');
      await page.waitForSelector('#sidebarChannels.show', { timeout: 3000 });
      await page.waitForSelector('.offcanvas-backdrop.show', { timeout: 3000 });
      await delay(100);

      // Click on backdrop outside offcanvas (e.g. at x: 800, y: 300)
      await page.mouse.click(800, 300);
      await page.waitForFunction(() => !document.getElementById('sidebarChannels').classList.contains('show'), { timeout: 3000 });
      await delay(150);

      const activeId = await page.evaluate(() => document.activeElement?.id);
      recordResult(
        '2C. Focus restoration on Backdrop Outside Click',
        activeId === 'openSidebar',
        `Active element after Outside Click: #${activeId}`
      );
    }

    // Vector 2D: Dismiss via Backspace on channel item
    {
      await page.click('#openSidebar');
      await page.waitForSelector('#sidebarChannels.show', { timeout: 3000 });
      await delay(150);

      // Verify active channel has focus
      await page.keyboard.press('Backspace');
      await page.waitForFunction(() => !document.getElementById('sidebarChannels').classList.contains('show'), { timeout: 3000 });
      await delay(150);

      const activeId = await page.evaluate(() => document.activeElement?.id);
      recordResult(
        '2D. Focus restoration on Backspace (Smart TV Back)',
        activeId === 'openSidebar',
        `Active element after Backspace: #${activeId}`
      );
    }

    // Vector 2E: Dismiss via ArrowRight on channel item
    {
      await page.click('#openSidebar');
      await page.waitForSelector('#sidebarChannels.show', { timeout: 3000 });
      await delay(150);

      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => !document.getElementById('sidebarChannels').classList.contains('show'), { timeout: 3000 });
      await delay(150);

      const activeId = await page.evaluate(() => document.activeElement?.id);
      recordResult(
        '2E. Focus restoration on ArrowRight (Smart TV Return)',
        activeId === 'openSidebar',
        `Active element after ArrowRight: #${activeId}`
      );
    }

    // Stress 2F: Rapid Open/Dismiss cycle 5 times
    {
      let allRestored = true;
      for (let i = 0; i < 5; i++) {
        await page.click('#openSidebar');
        await page.waitForSelector('#sidebarChannels.show', { timeout: 3000 });
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.getElementById('sidebarChannels').classList.contains('show'), { timeout: 3000 });
        await delay(100);
        const curActive = await page.evaluate(() => document.activeElement?.id);
        if (curActive !== 'openSidebar') {
          allRestored = false;
          break;
        }
      }
      recordResult(
        '2F. Rapid 5x Open/Dismiss stress cycle',
        allRestored,
        allRestored ? 'Focus faithfully restored to #openSidebar all 5 times' : 'Focus dropped during rapid toggling'
      );
    }

    console.log('\n--- SUITE 3: Idle Timer Interactivity & Visibility (SC 2.4.7) ---');

    // 3A: Idle fade when unfocused
    {
      // Blur any focused element
      await page.evaluate(() => {
        if (document.activeElement && document.activeElement.blur) {
          document.activeElement.blur();
        }
        document.body.focus();
      });

      // Wait 3700ms for idle timer (3500ms configured in main.js)
      await delay(3700);

      const idleState = await page.evaluate(() => {
        const btn = document.getElementById('openSidebar');
        const actions = document.getElementById('overlayActions');
        const btnIdle = btn?.classList.contains('menu-btn--idle');
        const actionsIdle = actions?.classList.contains('menu-btn--idle');
        const btnOpacity = btn ? window.getComputedStyle(btn).opacity : null;
        return { btnIdle, actionsIdle, btnOpacity };
      });

      const passed = idleState.btnIdle && idleState.btnOpacity === '0';
      recordResult(
        '3A. Unfocused idle fade after 3.5s inactivity',
        passed,
        `btnIdle=${idleState.btnIdle}, opacity=${idleState.btnOpacity}`
      );
    }

    // 3B: Waking up via keyboard Tab press
    {
      await page.keyboard.press('Tab');
      await delay(50);

      const awakeState = await page.evaluate(() => {
        const btn = document.getElementById('openSidebar');
        const actions = document.getElementById('overlayActions');
        const btnIdle = btn?.classList.contains('menu-btn--idle');
        const btnOpacity = btn ? window.getComputedStyle(btn).opacity : null;
        return { btnIdle, btnOpacity };
      });

      const passed = !awakeState.btnIdle && awakeState.btnOpacity === '1';
      recordResult(
        '3B. Tab key wakes controls and removes menu-btn--idle',
        passed,
        `btnIdle=${awakeState.btnIdle}, opacity=${awakeState.btnOpacity}`
      );
    }

    // 3C: Focused #openSidebar prevents idle hiding
    {
      await page.evaluate(() => {
        const btn = document.getElementById('openSidebar');
        btn?.focus();
      });

      // Wait 3700ms while focused
      await delay(3700);

      const stateWhileFocused = await page.evaluate(() => {
        const btn = document.getElementById('openSidebar');
        const hasIdleClass = btn?.classList.contains('menu-btn--idle');
        const opacity = btn ? window.getComputedStyle(btn).opacity : null;
        const activeId = document.activeElement?.id;
        return { hasIdleClass, opacity, activeId };
      });

      // Should NOT have menu-btn--idle class and opacity MUST be 1
      const passed = !stateWhileFocused.hasIdleClass && stateWhileFocused.opacity === '1';
      recordResult(
        '3C. Focused #openSidebar remains visible through idle timeout',
        passed,
        `hasIdleClass=${stateWhileFocused.hasIdleClass}, opacity=${stateWhileFocused.opacity}`
      );
    }

    // 3D: Focused #pipBtn prevents overlayActions idle hiding
    {
      await page.evaluate(() => {
        const pip = document.getElementById('pipBtn');
        pip?.focus();
      });

      // Wait 3700ms while focused on PiP
      await delay(3700);

      const stateWhilePipFocused = await page.evaluate(() => {
        const actions = document.getElementById('overlayActions');
        const hasIdleClass = actions?.classList.contains('menu-btn--idle');
        const opacity = actions ? window.getComputedStyle(actions).opacity : null;
        return { hasIdleClass, opacity };
      });

      const passed = !stateWhilePipFocused.hasIdleClass && stateWhilePipFocused.opacity === '1';
      recordResult(
        '3D. Focused #pipBtn prevents overlayActions idle hiding',
        passed,
        `hasIdleClass=${stateWhilePipFocused.hasIdleClass}, opacity=${stateWhilePipFocused.opacity}`
      );
    }

    console.log('\n--- SUITE 4: Unhijacked Key Interactions (SC 2.1.1, 2.1.2) ---');

    // 4A: Enter on focused #openSidebar opens drawer without global conflict
    {
      await page.evaluate(() => document.getElementById('openSidebar')?.focus());
      await delay(50);
      await page.keyboard.press('Enter');
      await page.waitForSelector('#sidebarChannels.show', { timeout: 3000 });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('sidebarChannels').classList.contains('show'), { timeout: 3000 });
      await delay(100);

      recordResult(
        '4A. Enter key on focused #openSidebar opens drawer natively',
        true,
        'Drawer opened and dismissed cleanly'
      );
    }

    // 4B: ArrowDown on focused #openSidebar does NOT zap channels
    {
      await page.evaluate(() => document.getElementById('openSidebar')?.focus());
      const initialChannel = await page.evaluate(() => {
        const activeOption = document.querySelector('#channels-group .channel-active');
        return activeOption?.getAttribute('data-index');
      });

      await page.keyboard.press('ArrowDown');
      await delay(200);

      const channelAfterArrow = await page.evaluate(() => {
        const activeOption = document.querySelector('#channels-group .channel-active');
        return activeOption?.getAttribute('data-index');
      });

      const passed = initialChannel === channelAfterArrow;
      recordResult(
        '4B. ArrowDown on focused #openSidebar does NOT zap channels',
        passed,
        `Before: idx=${initialChannel}, After: idx=${channelAfterArrow}`
      );
    }

    // 4C: Enter / Arrow keys on focused #pipBtn do NOT open drawer or zap channels
    {
      await page.evaluate(() => document.getElementById('pipBtn')?.focus());
      const initialChannel = await page.evaluate(() => {
        const activeOption = document.querySelector('#channels-group .channel-active');
        return activeOption?.getAttribute('data-index');
      });

      await page.keyboard.press('ArrowDown');
      await delay(200);
      await page.keyboard.press('ArrowUp');
      await delay(200);

      const channelAfterArrows = await page.evaluate(() => {
        const activeOption = document.querySelector('#channels-group .channel-active');
        return activeOption?.getAttribute('data-index');
      });

      const sidebarOpen = await page.evaluate(() => document.getElementById('sidebarChannels')?.classList.contains('show'));

      const passed = initialChannel === channelAfterArrows && !sidebarOpen;
      recordResult(
        '4C. Arrow keys on focused #pipBtn do NOT trigger channel zapping or drawer',
        passed,
        `Channel unchanged=${passed}, Sidebar open=${sidebarOpen}`
      );
    }

    // 4D: Enter and Arrow keys on focused <video> do NOT open drawer or zap channels
    {
      await page.evaluate(() => document.getElementById('video')?.focus());
      const initialChannel = await page.evaluate(() => {
        const activeOption = document.querySelector('#channels-group .channel-active');
        return activeOption?.getAttribute('data-index');
      });

      await page.keyboard.press('ArrowDown');
      await delay(200);

      const channelAfter = await page.evaluate(() => {
        const activeOption = document.querySelector('#channels-group .channel-active');
        return activeOption?.getAttribute('data-index');
      });

      const sidebarOpen = await page.evaluate(() => document.getElementById('sidebarChannels')?.classList.contains('show'));

      const passed = initialChannel === channelAfter && !sidebarOpen;
      recordResult(
        '4D. Arrow keys on focused <video> do NOT trigger channel zapping or drawer',
        passed,
        `Channel unchanged=${passed}, Sidebar open=${sidebarOpen}`
      );
    }

    // 4E: Global body focused (Smart TV mode): Enter opens drawer, ArrowDown zaps channel
    {
      // Blur all elements so activeElement is body
      await page.evaluate(() => {
        if (document.activeElement?.blur) document.activeElement.blur();
        document.body.focus();
      });

      const initialChannel = await page.evaluate(() => {
        const activeOption = document.querySelector('#channels-group .channel-active');
        return parseInt(activeOption?.getAttribute('data-index') || '0', 10);
      });

      // ArrowDown should zap to next channel
      await page.keyboard.press('ArrowDown');
      await delay(600); // Wait for zap debounce

      const channelAfterZap = await page.evaluate(() => {
        const activeOption = document.querySelector('#channels-group .channel-active');
        return parseInt(activeOption?.getAttribute('data-index') || '0', 10);
      });

      const zapped = channelAfterZap === initialChannel + 1;
      recordResult(
        '4E. Global body navigation: ArrowDown zaps channel as expected on Smart TV',
        zapped,
        `Initial=${initialChannel}, After ArrowDown=${channelAfterZap}`
      );
    }

    console.log('\n--- SUITE 5: Alertdialog Focus Trapping & Dismissal ---');

    // 5A: Update Toast creation and initial focus
    {
      // Focus #openSidebar first to test restoration later
      await page.evaluate(() => document.getElementById('openSidebar')?.focus());
      await delay(50);

      // Trigger showUpdateToast
      await page.evaluate(async () => {
        const { notifications } = await import('./js/ui/NotificationManager.js');
        notifications.showUpdateToast(() => console.log('Update confirmed!'));
      });

      await page.waitForSelector('.toast-update', { timeout: 3000 });
      await delay(300); // Wait for shown.bs.toast

      const toastAria = await page.evaluate(() => {
        const t = document.querySelector('.toast-update');
        return {
          role: t?.getAttribute('role'),
          ariaModal: t?.getAttribute('aria-modal'),
          ariaLabelledby: t?.getAttribute('aria-labelledby'),
          ariaDescribedby: t?.getAttribute('aria-describedby'),
          activeIsUpdateBtn: document.activeElement?.classList.contains('btnUpdatePwa')
        };
      });

      const passed = toastAria.role === 'alertdialog' &&
                     toastAria.ariaModal === 'true' &&
                     toastAria.ariaLabelledby === 'pwaUpdateTitle' &&
                     toastAria.activeIsUpdateBtn;

      recordResult(
        '5A. Alertdialog ARIA attributes & initial focus on Update button',
        passed,
        `role=${toastAria.role}, ariaModal=${toastAria.ariaModal}, focusedOnBtn=${toastAria.activeIsUpdateBtn}`
      );
    }

    // 5B: Strict Focus Trapping inside Alertdialog (Forward & Reverse Tab)
    {
      const tabCycle = [];
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Tab');
        await delay(50);
        const btnClass = await page.evaluate(() => {
          const el = document.activeElement;
          if (el?.classList.contains('btnUpdatePwa')) return 'UpdateBtn';
          if (el?.getAttribute('data-bs-dismiss') === 'toast') return 'DismissBtn';
          return el?.tagName + '#' + (el?.id || el?.className);
        });
        tabCycle.push(btnClass);
      }

      // Must strictly alternate between UpdateBtn and DismissBtn, NEVER leaking to background
      const leaked = tabCycle.some(c => c !== 'UpdateBtn' && c !== 'DismissBtn');
      recordResult(
        '5B. Strict Forward Tab Cycle trapping in Alertdialog (8x spam)',
        !leaked,
        `Cycle: [${tabCycle.join(' -> ')}] (Leaked: ${leaked})`
      );

      // Test Shift+Tab wrapping
      await page.keyboard.down('Shift');
      await page.keyboard.press('Tab');
      await page.keyboard.up('Shift');
      await delay(50);

      const shiftTabTarget = await page.evaluate(() => {
        const el = document.activeElement;
        if (el?.classList.contains('btnUpdatePwa')) return 'UpdateBtn';
        if (el?.getAttribute('data-bs-dismiss') === 'toast') return 'DismissBtn';
        return el?.tagName;
      });

      recordResult(
        '5C. Reverse Shift+Tab wrapping inside Alertdialog',
        shiftTabTarget === 'UpdateBtn' || shiftTabTarget === 'DismissBtn',
        `Shift+Tab focused: ${shiftTabTarget}`
      );
    }

    // 5D: Dismiss alertdialog via Escape key & restore focus
    {
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.toast-update'), { timeout: 3000 });
      await delay(200);

      const activeAfterDismiss = await page.evaluate(() => document.activeElement?.id);
      recordResult(
        '5D. Escape key dismisses alertdialog and restores focus',
        activeAfterDismiss === 'openSidebar',
        `Active element after alertdialog dismiss: #${activeAfterDismiss}`
      );
    }

    console.log('\n--- SUITE 6: Virtual Listbox Roving Tabindex & Keyboard Navigation ---');

    // 6A: Drawer Listbox ARIA Semantics
    {
      await page.click('#openSidebar');
      await page.waitForSelector('#sidebarChannels.show', { timeout: 3000 });
      await delay(200);

      const listboxAria = await page.evaluate(() => {
        const group = document.getElementById('channels-group');
        const role = group?.getAttribute('role');
        const ariaLabel = group?.getAttribute('aria-label');
        const activeOption = group?.querySelector('.channel-active');
        const activeRole = activeOption?.getAttribute('role');
        const activeAriaSelected = activeOption?.getAttribute('aria-selected');
        const activeTabindex = activeOption?.getAttribute('tabindex');

        const inactiveOption = group?.querySelector('[role="option"]:not(.channel-active)');
        const inactiveTabindex = inactiveOption?.getAttribute('tabindex');

        return {
          role,
          ariaLabel,
          activeRole,
          activeAriaSelected,
          activeTabindex,
          inactiveTabindex
        };
      });

      const passed = listboxAria.role === 'listbox' &&
                     listboxAria.ariaLabel === 'Lista de canales' &&
                     listboxAria.activeRole === 'option' &&
                     listboxAria.activeAriaSelected === 'true' &&
                     listboxAria.activeTabindex === '0' &&
                     listboxAria.inactiveTabindex === '-1';

      recordResult(
        '6A. Listbox role, roving tabindex (0 for active, -1 for inactive)',
        passed,
        `activeTabIndex=${listboxAria.activeTabindex}, inactiveTabIndex=${listboxAria.inactiveTabindex}`
      );
    }

    // 6B: ArrowDown / ArrowUp roving navigation in listbox
    {
      const startIdx = await page.evaluate(() => parseInt(document.activeElement?.getAttribute('data-index') || '0', 10));

      await page.keyboard.press('ArrowDown');
      await delay(100);

      const nextIdx = await page.evaluate(() => parseInt(document.activeElement?.getAttribute('data-index') || '-1', 10));

      await page.keyboard.press('ArrowUp');
      await delay(100);

      const returnIdx = await page.evaluate(() => parseInt(document.activeElement?.getAttribute('data-index') || '-1', 10));

      const passed = nextIdx === startIdx + 1 && returnIdx === startIdx;
      recordResult(
        '6B. ArrowDown & ArrowUp roving focus navigation across channel options',
        passed,
        `Start=${startIdx} -> ArrowDown=${nextIdx} -> ArrowUp=${returnIdx}`
      );
    }

    // 6C: Channel selection via Enter key
    {
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.getElementById('sidebarChannels').classList.contains('show'), { timeout: 3000 });
      await delay(150);

      const activeAfterSelection = await page.evaluate(() => document.activeElement?.id);
      recordResult(
        '6C. Enter key selects channel, closes drawer, and restores focus to #openSidebar',
        activeAfterSelection === 'openSidebar',
        `Active after selection: #${activeAfterSelection}`
      );
    }

  } catch (err) {
    console.error('\n[FATAL TEST ERROR]', err);
    recordResult('Unhandled Test Harness Exception', false, err.message);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    console.log(`\n[INFO] Ephemeral server on port ${port} released cleanly.`);
  }

  console.log('\n================================================================');
  console.log('                 STRESS TEST SUITE SUMMARY                      ');
  console.log('================================================================');
  const total = testResults.length;
  const passedCount = testResults.filter(t => t.passed).length;
  const failedCount = total - passedCount;

  console.log(`Total Probes Executed: ${total}`);
  console.log(`Passed: \x1b[32m${passedCount}\x1b[0m`);
  console.log(`Failed: \x1b[31m${failedCount}\x1b[0m\n`);

  if (failedCount === 0) {
    console.log('\x1b[32m\x1b[1mVERDICT: APPROVE - All Keyboard & Focus Stress Probes PASSED!\x1b[0m\n');
    process.exit(0);
  } else {
    console.log('\x1b[31m\x1b[1mVERDICT: REJECT - Focus or Keyboard Failure Modes Detected!\x1b[0m\n');
    process.exit(1);
  }
}

runStressTests();
