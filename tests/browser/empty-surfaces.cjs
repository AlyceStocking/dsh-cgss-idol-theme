// Run with Electron: electron tests/browser/empty-surfaces.cjs
// Fixtures mirror DSH's FlowItem and ConversationSessionHeader semantic DOM.
// Set CGSS_THEME_CLIENT to an older client.js to verify these regressions fail.
const { app, BrowserWindow, session } = require('electron');
const { readFileSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const profile = mkdtempSync(path.join(tmpdir(), 'idol-empty-surfaces-'));
app.setPath('userData', profile);
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});
let win;
const cleanup = () => {
  win?.destroy();
  // Chromium may retain profile handles until process exit on Windows.
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
};
app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_, done) => done({ cancel: true }));
  win = new BrowserWindow({ show: false, width: 900, height: 700, webPreferences: { backgroundThrottling: false, offscreen: true } });
  await win.loadURL('about:blank');
  const run = code => win.webContents.executeJavaScript(code);
  await run(`
    document.body.innerHTML = '<style>' +
      '[data-slot] { display:contents; }' +
      '[data-chat-flow-kind]:is(:empty,:has(> [data-slot="conversation.chat.node"]:empty)) { height:0; }' +
      '[hidden], [data-turn-process-hidden] { display:none; }' +
      '.title-row { display:flex; height:30px; } [data-conversation-header-corner] { margin-left:auto; }' +
      '</style><main id="fixtures"></main>';
    window.disposers = [];
    window.__ModuleLoader__ = { load: entry => window.plugin = entry.factory(() => ({})) };
    window.paint = id => {
      const el = document.getElementById(id), s = getComputedStyle(el);
      return { background:s.backgroundColor, padding:s.padding, border:s.borderTopWidth,
        shadow:s.boxShadow, blur:s.backdropFilter, height:el.getBoundingClientRect().height };
    };
    void 0;
  `);
  await run(readFileSync(process.env.CGSS_THEME_CLIENT || path.join(__dirname, '../../lib/client.js'), 'utf8') + '\n;void 0;');
  await run(`
    plugin.apply({
      get: key => key === 'slots' ? {inject(){}} : key === 'theme' ? {
        overrideTokens(_, tokens) {
          window.setMode = mode => {
            document.body.toggleAttribute('data-ds-dark-theme', mode === 'dark');
            for (const [key, value] of Object.entries(tokens)) document.body.style.setProperty(key, value[mode]);
          };
          setMode('light');
        }
      } : undefined,
      effect: fn => { const dispose = fn(); if (typeof dispose === 'function') disposers.push(dispose); }
    });
    void 0;
  `);
  let checks = 0;
  const failures = [];
  const check = async (code, expected, label) => {
    try { assert.deepEqual(await run(code), expected, label); checks++; }
    catch (error) { failures.push(error); }
  };
  for (const width of [900, 500]) {
    win.setContentSize(width, 700);
    for (const colorMode of ['light', 'dark']) {
      const mode = colorMode + ' ' + width + 'px';
      await run('setMode(' + JSON.stringify(colorMode) + ')');
      for (const kind of ['turn-process', 'assistant-step', 'tool-call']) {
        for (const contents of ['', '<!-- React null -->', '<div data-slot="conversation.chat.node"></div>', '<div data-slot="conversation.chat.node"><!-- React null --></div>']) {
          const html = '<div id="empty" data-chat-flow-kind="' + kind + '">' + contents + '</div>';
          await run('document.getElementById("fixtures").innerHTML = ' + JSON.stringify(html));
          await check(`paint('empty')`, {background:'rgba(0, 0, 0, 0)', padding:'0px', border:'0px', shadow:'none', blur:'none', height:0}, mode + ' empty ' + kind + ': ' + contents);
        }
        // The same wrapper must recover its surface when streaming content arrives.
        await run(`document.querySelector('#empty > div').innerHTML = '<button aria-expanded="false">Thinking</button>'`);
        await check(`paint('empty').background !== 'rgba(0, 0, 0, 0)' && paint('empty').height > 0`, true, mode + ' populated ' + kind + ' retains its surface');
        await check(`paint('empty').border`, kind === 'tool-call' ? '0px' : '1px', mode + ' populated ' + kind + ' border');
        if (kind === 'assistant-step') {
          await check(`(() => { const s = getComputedStyle(document.getElementById('empty')); return [s.padding, s.borderRadius]; })()`, width <= 600 ? ['14px 16px', '16px'] : ['18px 22px', '20px'], mode + ' populated assistant keeps responsive sizing');
        }
        await run(`document.querySelector('#empty > div').replaceChildren()`);
        await check(`paint('empty').height`, 0, mode + ' clearing ' + kind + ' removes padding and border');
      }
      await run(`document.getElementById('fixtures').innerHTML = '<div data-chat-flow-kind="assistant-step" hidden id="hidden"><div data-slot="conversation.chat.node">Hidden answer</div></div><div data-chat-flow-kind="turn-process" data-turn-process-hidden id="folded"><div data-slot="conversation.chat.node">Folded process</div></div><div role="status" id="status">Deep exploring…</div>'`);
      await check(`['hidden','folded'].map(id => paint(id).height)`, [0,0], mode + ' hidden and folded messages stay hidden');
      await check(`paint('status').height > 0`, true, mode + ' running status stays visible');
      for (const windows of [true, false]) {
        await run('document.documentElement.toggleAttribute("data-windows-titlebar", ' + windows + ')');
        await run(`
          document.getElementById('fixtures').innerHTML = '<div data-slot="conversation.header"><header data-window-drag><div data-slot="conversation.session.header"><div class="title-row" id="title"><div data-conversation-header-corner><button id="layout" aria-label="Panel layout">▣</button></div></div></div></header></div>';
          window.layoutClicks = 0;
          document.getElementById('layout').onclick = () => layoutClicks++;
          void 0;
        `);
        const label = mode + (windows ? ' Windows' : ' web');
        await check(`paint('title').background`, 'rgba(0, 0, 0, 0)', label + ' corner-only header has no full-width surface');
        await check(`(() => { const el = document.getElementById('layout'), r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.contains(document.elementFromPoint(r.x + r.width/2, r.y + r.height/2)); })()`, true, label + ' layout button remains hit-testable');
        await check(`document.getElementById('layout').click(); layoutClicks`, 1, label + ' layout button remains actionable');
        await check(`document.getElementById('layout').focus(); document.activeElement.id`, 'layout', label + ' layout button remains focusable');
        await run(`document.getElementById('title').insertAdjacentHTML('afterbegin', '<div id="title-cluster"><nav aria-label="Session hierarchy"><span>Session title</span></nav><div data-slot="conversation.session.header.actions"><button>Rename</button></div></div>')`);
        await check(`paint('title').background !== 'rgba(0, 0, 0, 0)'`, true, label + ' populated title without tabs retains reading surface');
        await run(`document.querySelector('[data-slot="conversation.session.header"]').insertAdjacentHTML('beforeend', '<div id="tabs"><div data-conversation-tabs role="tablist"><button role="tab" aria-selected="true">Chat</button><button role="tab">Files</button></div></div>')`);
        await check(`getComputedStyle(document.querySelector('header')).backgroundColor !== 'rgba(0, 0, 0, 0)'`, windows, label + ' populated tabs retain platform-specific unified header');
        await check(`paint('title').background === 'rgba(0, 0, 0, 0)'`, windows, label + ' unified Windows header avoids stacked surfaces');
        await run(`document.getElementById('tabs').remove(); document.getElementById('title-cluster').remove()`);
        await check(`paint('title').background`, 'rgba(0, 0, 0, 0)', label + ' returning to new session restores transparent header');
      }
    }
  }
  await check(`document.querySelectorAll('style[data-plugin="dsh-cgss-idol-theme"]').length`, 1, 'theme stylesheet is mounted');
  await run(`disposers.reverse().forEach(fn => fn())`);
  await check(`document.querySelectorAll('style[data-plugin="dsh-cgss-idol-theme"]').length`, 0, 'unloading removes theme styles');
  if (failures.length) throw new AggregateError(failures, failures.length + ' Chromium empty-surface checks failed');
  console.log('PASS: ' + checks + ' Chromium empty-surface checks');
  cleanup(); app.exit(0);
}).catch(error => { console.error(error); cleanup(); app.exit(1); });
