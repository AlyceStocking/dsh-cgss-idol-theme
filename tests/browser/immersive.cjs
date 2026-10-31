// Run with an unpacked Electron binary: electron tests/browser/immersive.cjs
// Uses real Chromium selectors, Selection, CSS and native input without opening a window.
const { app, BrowserWindow, session } = require('electron');
const { readFileSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const profile = mkdtempSync(path.join(tmpdir(), 'idol-immersive-test-'));
app.setPath('userData', profile);
app.disableHardwareAcceleration();
let win;
app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_, done) => done({ cancel: true }));
  win = new BrowserWindow({ show: false, width: 900, height: 700, webPreferences: { backgroundThrottling: false, offscreen: true } });
  await win.loadURL('about:blank');
  const evaluate = code => win.webContents.executeJavaScript(code);
  const waitFor = async code => {
    const deadline = Date.now() + 2500;
    while (!(await evaluate(code))) {
      if (Date.now() >= deadline) throw new Error('Timed out waiting for: ' + code);
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  };
  await evaluate(`
    document.documentElement.dataset.windowsTitlebar = '';
    document.body.innerHTML = '<div data-slot="conversation.header"><header data-window-drag><div data-conversation-tabs>Tabs</div></header></div>' +
      '<main id="background" data-conversation-content data-conversation-region="chat" style="height:300px;padding:20px"><article data-chat-flow-kind="assistant-step" id="card">' +
      '<span id="text">Select this message text</span><button id="button">Copy</button><a id="link" href="#">Link</a></article>' +
      '<div data-composer-seat id="composer-seat"><div data-composer-card id="composer"><textarea id="input"></textarea></div></div>' +
      '<pre id="code-block"><code>code</code></pre><img id="image" alt="attachment"><div data-width-handle id="resize"></div></main>' +
      '<aside class="host_sidebarCol" id="sidebar">Sidebar</aside><div class="yukimi-pet" id="pet">Pet</div>' +
      '<div role="dialog" id="dialog">Dialog</div><div contenteditable id="editable">Editable</div>' +
      '<div id="settings">Settings panel whitespace</div><div id="shell">Shell whitespace</div>' +
      '<aside data-rightbar-col><div data-conversation-content data-conversation-region="chat" id="embedded">Embedded chat</div></aside>';
    window.disposers = [];
    window.__ModuleLoader__ = { load: entry => window.plugin = entry.factory(() => ({})) };
    void 0;
  `);
  await evaluate(readFileSync(path.join(__dirname, '../../lib/client.js'), 'utf8') + '\n;void 0;');
  await evaluate(`
    window.mount = () => plugin.apply({
      get: key => key === 'slots' ? { inject() {} } : undefined,
      effect: fn => { const dispose = fn(); if (typeof dispose === 'function') disposers.push(dispose); }
    });
    mount();
    window.fire = (type, id = 'background', extra = {}) => document.getElementById(id).dispatchEvent(new PointerEvent(type, {
      bubbles: true, button: 0, pointerId: 1, isPrimary: true, clientX: 100, clientY: 310, ...extra
    }));
    window.tap = (id = 'background') => { fire('pointerdown', id); fire('pointerup', id); };
    window.active = () => document.body.classList.contains('yukimi-immersive');
    window.key = (key, extra = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extra }));
    void 0;
  `);
  let count = 0;
  const check = async (code, expected, label) => { assert.deepEqual(await evaluate(code), expected, label); count++; };
  await check(`tap(); active()`, true, 'html platform marker must not exclude chat background');
  await check(`tap('background'); active()`, false, 'a second immediate click restores without a debounce dead zone');
  for (const id of ['card', 'text', 'button', 'link', 'input', 'composer', 'composer-seat', 'sidebar', 'pet', 'dialog', 'editable', 'code-block', 'image', 'resize', 'settings', 'shell', 'embedded']) {
    await check(`tap('${id}'); active()`, false, `${id} keeps the view`);
  }
  await check(`fire('pointerdown'); fire('pointermove', 'background', {clientX:130}); fire('pointermove'); fire('pointerup'); active()`, false, 'dragging out and back is not a click');
  await check(`fire('pointerdown'); fire('pointercancel'); fire('pointerup'); active()`, false, 'canceled pointer does not toggle');
  await check(`fire('pointerdown'); window.dispatchEvent(new Event('blur')); fire('pointerup'); active()`, false, 'focus loss cancels gesture');
  await check(`fire('pointerdown'); fire('pointerup', 'button'); active()`, false, 'release on a control is excluded');
  await check(`fire('pointerdown'); fire('pointerup', 'background', {pointerId:2}); active()`, false, 'unrelated pointer cannot complete a press');
  await check(`fire('pointercancel'); fire('pointerdown', 'background', {button:2}); fire('pointerup', 'background', {button:2}); active()`, false, 'right click is excluded');
  await check(`
    fire('pointerdown');
    var range = document.createRange(); range.selectNodeContents(document.getElementById('text'));
    getSelection().removeAllRanges(); getSelection().addRange(range);
    fire('pointerup'); active()
  `, false, 'a new selection prevents toggling');
  await check(`tap(); active()`, true, 'an unchanged old selection does not block clicking');
  await check(`key('Escape'); active()`, false, 'Escape restores');
  await check(`key('i', {altKey:true}); active()`, true, 'Alt+I enters');
  await check(`key('i', {altKey:true, repeat:true}); active()`, true, 'held hotkey does not flicker');
  await check(`document.getElementById('card').dispatchEvent(new WheelEvent('wheel', {bubbles:true, deltaY:20})); active()`, true, 'downward wheel keeps view');
  await check(`document.getElementById('card').addEventListener('wheel', e => e.stopPropagation()); document.getElementById('card').dispatchEvent(new WheelEvent('wheel', {bubbles:true, deltaY:-20})); active()`, false, 'upward wheel restores even when bubbling is stopped');
  await check(`getComputedStyle(document.getElementById('composer')).transitionProperty.includes('transform')`, true, 'composer motion survives later CSS rules');
  await check(`getComputedStyle(document.getElementById('card')).transitionProperty`, 'opacity', 'messages fade');
  await evaluate(`key('i', {altKey:true})`);
  await waitFor(`['card','composer'].every(id => getComputedStyle(document.getElementById(id)).opacity === '0')`);
  await check(`['card','composer'].map(id => getComputedStyle(document.getElementById(id)).opacity)`, ['0','0'], 'content actually fades out');
  await check(`getComputedStyle(document.querySelector('header')).opacity`, '0', 'session header hides');
  await check(`disposers.reverse().splice(0).forEach(fn => fn()); active()`, false, 'unloading restores full view');
  await check(`tap(); active()`, false, 'unloading removes event listeners');
  await evaluate(`mount(); getSelection().removeAllRanges()`);
  await new Promise(resolve => setTimeout(resolve, 350));
  const textPoint = await evaluate(`(() => { const r = document.getElementById('text').getBoundingClientRect(); return { x: Math.round(r.left + 4), y: Math.round(r.top + r.height / 2) }; })()`);
  win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...textPoint });
  win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...textPoint });
  await new Promise(resolve => setTimeout(resolve, 50));
  await check(`active()`, false, 'native click on message text does not hide the view');
  const cardPoint = await evaluate(`(() => { const r = document.getElementById('card').getBoundingClientRect(); return { x: Math.round(r.right - 20), y: Math.round(r.bottom - 10) }; })()`);
  win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...cardPoint });
  win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...cardPoint });
  await new Promise(resolve => setTimeout(resolve, 50));
  await check(`active()`, false, 'native click on message card whitespace does not hide the view');
  // Chromium dispatches both pointer and compatibility mouse events here.
  const point = await evaluate(`(() => { const r = document.getElementById('background').getBoundingClientRect(); return { x: Math.round(r.right - 20), y: Math.round(r.bottom - 10) }; })()`);
  win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point });
  win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point });
  await new Promise(resolve => setTimeout(resolve, 50));
  await check(`active()`, true, 'native mouse click toggles once despite compatibility events');
  win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...cardPoint });
  win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...cardPoint });
  await new Promise(resolve => setTimeout(resolve, 50));
  await check(`active()`, false, 'native second click restores through the hidden message card');
  await evaluate(`key('Escape')`);
  await new Promise(resolve => setTimeout(resolve, 350));
  const textBox = await evaluate(`(() => { const r = document.getElementById('text').getBoundingClientRect(); return { x: Math.ceil(r.left + 2), end: Math.floor(r.right - 2), y: Math.round(r.top + r.height / 2) }; })()`);
  win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, x: textBox.x, y: textBox.y });
  win.webContents.sendInputEvent({ type: 'mouseMove', button: 'left', x: textBox.end, y: textBox.y });
  win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x: textBox.end, y: textBox.y });
  await new Promise(resolve => setTimeout(resolve, 50));
  await check(`!active() && String(getSelection()).length > 0`, true, 'native drag selects message text without hiding it');
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await check(`['card','composer'].map(id => getComputedStyle(document.getElementById(id)).transitionDuration)`, ['0s','0s'], 'reduced motion disables transitions');
  win.webContents.debugger.detach();
  await evaluate(`disposers.reverse().splice(0).forEach(fn => fn()); window.PointerEvent = undefined; mount();`);
  await check(`['mousedown','mouseup'].forEach(type => document.getElementById('background').dispatchEvent(new MouseEvent(type, {bubbles:true, button:0, clientX:100, clientY:310}))); active()`, true, 'mouse-only fallback');
  await evaluate(`
    disposers.reverse().splice(0).forEach(fn => fn()); window.PointerEvent = PointerEvent;
    document.body.innerHTML = '<div id="frame" style="display:grid;grid-template-columns:180px 1fr 160px;height:600px"><aside id="left">Sidebar</aside><div id="center" style="display:flex;flex-direction:column;min-height:0"><div data-slot="conversation.header"><header data-window-drag><div data-conversation-tabs>Tabs</div></header></div><main id="background" data-conversation-content data-conversation-region="chat" style="display:flex;flex:1;min-height:0"><div id="scroll" data-conversation-scroll style="overflow:auto;flex:1"><div data-slot="conversation.session"><div data-chat-flow id="flow" style="height:900px"><article data-chat-flow-kind="assistant-step" id="card"><span id="text">History record</span><button id="button">Copy</button></article><div role="status" id="notice">Session notice</div></div></div><div data-composer-seat><div data-composer-card id="composer">Input</div></div></div></main></div><aside data-rightbar-col id="right">Files</aside><div data-shell-overlay style="position:absolute;pointer-events:none"></div></div>';
    const slotStyle = document.createElement('style'); slotStyle.textContent = '[data-slot] { display: contents !important; }'; document.head.append(slotStyle);
    mount(); void 0;
  `);
  await check(`key('i', {altKey:true}); active()`, true, 'background mode enters');
  await check(`['left','right'].map(id=>getComputedStyle(document.getElementById(id)).display)`, ['none','none'], 'both sidebars collapse');
  await check(`getComputedStyle(document.getElementById('notice')).visibility`, 'hidden', 'session notices hide');
  await check(`key('Escape'); ['left','right'].map(id=>getComputedStyle(document.getElementById(id)).display)`, ['block','block'], 'original sidebars restore');
  await check(`document.getElementById('frame').style.gridTemplateColumns`, '180px 1fr 160px', 'saved sidebar widths never change');
  await check(`key('I',{altKey:true,shiftKey:true}); document.body.classList.contains('yukimi-reading') && !active()`, true, 'reading hotkey keeps history');
  await check(`getComputedStyle(document.getElementById('composer').parentElement).display`, 'none', 'reading removes input seat from layout');
  await waitFor(`getComputedStyle(document.getElementById('card')).opacity === '1'`);
  await waitFor(`document.getElementById('flow').hasAttribute('data-yukimi-history-fade')`);
  await check(`(()=>{const center=document.getElementById('center').getBoundingClientRect(),scroll=document.getElementById('scroll').getBoundingClientRect();return Math.abs(center.top-scroll.top)<1 && Math.abs(center.bottom-scroll.bottom)<1;})()`, true, 'reading history reaches both content-window edges');
  await check(`(()=>{const flow=document.getElementById('flow'),r=flow.getBoundingClientRect(),s=document.getElementById('scroll').getBoundingClientRect();return Math.abs(r.top+parseFloat(flow.style.getPropertyValue('--yukimi-fade-bottom'))-s.bottom)<1;})()`, true, 'reading fade ends at window bottom instead of input');
  await check(`document.getElementById('scroll').dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:-30})); document.body.classList.contains('yukimi-reading')`, true, 'reading scroll does not exit');
  // Mouse fallback is still selected after the earlier fallback test.
  const down = id => evaluate(`document.getElementById('${id}').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,clientX:120,clientY:100}));void 0;`);
  await down('card');
  await waitFor(`!document.body.classList.contains('yukimi-reading')`);
  await check(`active()`, false, 'second long press restores normal view');
  await down('card');
  await waitFor(`document.body.classList.contains('yukimi-reading')`);
  await check(`getComputedStyle(document.getElementById('card')).pointerEvents`, 'auto', 'reading text remains interactive');
  await evaluate(`key('Escape')`);
  await down('button');
  await new Promise(resolve=>setTimeout(resolve,700));
  await check(`document.body.classList.contains('yukimi-reading')`, false, 'holding a button does not toggle reading');
  await down('card');
  await evaluate(`window.dispatchEvent(new MouseEvent('mousemove',{clientX:160,clientY:100}));void 0;`);
  await new Promise(resolve=>setTimeout(resolve,700));
  await check(`document.body.classList.contains('yukimi-reading')`, false, 'text selection drag cancels long press');
  await evaluate(`key('I',{altKey:true,shiftKey:true}); disposers.reverse().splice(0).forEach(fn=>fn());`);
  await check(`document.querySelectorAll('[data-yukimi-focus-hidden]').length`, 0, 'unloading restores shell markers');
  await check(`document.body.classList.contains('yukimi-reading')`, false, 'unloading exits reading');
  console.log(`PASS: ${count} Chromium immersive checks`);
  win.destroy();
  app.exit(0);
}).catch(error => { console.error(error); win?.destroy(); app.exit(1); });
app.on('quit', () => {
  try {
    if (path.dirname(profile) === path.resolve(tmpdir()) && path.basename(profile).startsWith('idol-immersive-test-')) rmSync(profile, { recursive: true, force: true });
  } catch {}
});
