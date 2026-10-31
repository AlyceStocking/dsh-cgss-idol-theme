// Run with an unpacked Electron binary: electron tests/browser/table-overflow.cjs
const { app, BrowserWindow, session } = require('electron');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
app.disableHardwareAcceleration();
let win;
app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_, done) => done({ cancel: true }));
  win = new BrowserWindow({ show: false, width: 1200, height: 700, webPreferences: { backgroundThrottling: false, offscreen: true } });
  await win.loadURL('about:blank');
  const run = code => win.webContents.executeJavaScript(code);
  await run(`
    document.body.innerHTML = '<main><div data-chat-flow><article data-chat-flow-kind="assistant-step"><div class="host-body"><div class="markdown"><p>Wide table regression</p><div class="table-scroll md-table-wide" tabindex="0"><table><tbody><tr>' + Array.from({length:12},(_,i)=>'<td>Column '+(i+1)+' — complete value</td>').join('') + '</tr></tbody></table></div></div></div></article></div></main>';
    const style = document.createElement('style');
    // Host layout/table rules from Desktop's AssistantMarkdown and Markdown modules.
    // Use readable class names; production theme selectors use only semantic markers.
    style.textContent = 'body{margin:0;background:#204060;color:#16203a;--dsh-chat-content-width:788px;--yukimi-history-surface:#eef2fa;--yukimi-history-stroke:#ccd;--yukimi-history-code-surface:white}main{container-type:inline-size;width:100%;padding-top:80px}[data-chat-flow]{width:min(788px,100%);margin:auto;mask-image:linear-gradient(transparent,#000 28px calc(100% - 28px),transparent);padding-bottom:70px}.host-body{display:flex;flex-direction:column}.markdown{min-width:0;overflow-wrap:anywhere}.table-scroll{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain}.table-scroll table{border-collapse:collapse;width:max-content;max-width:max-content}.table-scroll td{min-width:100px;padding:10px 16px;border:1px solid #889}.host-body .md-table-wide{--dsh-table-spare:max(0px,calc((100cqw - var(--dsh-chat-content-width))/2));--dsh-table-lead:calc(var(--dsh-table-spare) + min(var(--dsh-chat-content-width),100cqw) - 100%);box-sizing:border-box;width:calc(100% + var(--dsh-table-lead) + var(--dsh-table-spare));max-width:none;margin-left:calc(-1 * var(--dsh-table-lead));padding-left:var(--dsh-table-lead)}';
    document.head.append(style);
    window.disposers=[]; window.__ModuleLoader__={load:entry=>window.plugin=entry.factory(()=>({}))};
    window.measure=()=>{const scroll=document.querySelector('.table-scroll'), cell=scroll.querySelector('td:last-child'), flow=document.querySelector('[data-chat-flow]');scroll.scrollLeft=scroll.scrollWidth;const a=scroll.getBoundingClientRect(),b=cell.getBoundingClientRect(),c=flow.getBoundingClientRect();return {scrollable:scroll.scrollWidth>scroll.clientWidth, right:b.right, edge:Math.min(a.right,c.right), left:a.left, flowLeft:c.left, overflow:document.documentElement.scrollWidth>innerWidth};};
    void 0;
  `);
  const source = readFileSync(path.join(__dirname, '../../lib/client.js'), 'utf8');
  await run(source + '\n;void 0;');
  await run(`plugin.apply({get:key=>key==='slots'?{inject(){}}:undefined,effect:fn=>{const dispose=fn();if(typeof dispose==='function')disposers.push(dispose);}});void 0;`);
  // Remove just the fix first: the full theme must reproduce the original clipping.
  const fixedRule = await run(`(()=>{const sheet=document.querySelector('style[data-plugin]').sheet;const i=Array.from(sheet.cssRules).findIndex(r=>r.selectorText?.includes('.md-table-wide'));const text=sheet.cssRules[i].cssText;sheet.deleteRule(i);return text;})()`);
  const broken = await run('measure()');
  assert.ok(broken.right > broken.edge + 50, 'baseline reproduces right edge outside the history mask');
  await run(`document.querySelector('style[data-plugin]').sheet.insertRule(${JSON.stringify(fixedRule)});void 0;`);
  let count = 1;
  for (const width of [1200, 820, 560]) {
    win.setSize(width, 700);
    await new Promise(resolve => setTimeout(resolve, 100));
    for (const dark of [false, true]) {
      await run(`document.body.toggleAttribute('data-ds-dark-theme',${dark});void 0;`);
      const result = await run('measure()');
      assert.ok(result.scrollable, 'long table retains horizontal scrolling');
      assert.ok(result.right <= result.edge + 1, 'last cell fully visible at scroll end: ' + JSON.stringify(result));
      assert.ok(result.left >= result.flowLeft && !result.overflow, 'scrollport stays inside the message column');
      count += 3;
    }
  }
  mkdirSync(path.join(__dirname, '../../build'), {recursive:true});
  writeFileSync(path.join(__dirname, '../../build/table-overflow-fixed.png'), (await win.webContents.capturePage()).toPNG());
  console.log('PASS: ' + count + ' table overflow checks (including reproduced baseline)');
  win.destroy(); app.exit(0);
}).catch(error=>{console.error(error);win?.destroy();app.exit(1);});
