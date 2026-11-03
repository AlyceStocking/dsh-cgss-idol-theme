import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { helperCommand, launchHelper } from '../lib/desktop-process.js';

async function fixture(t) {
  const base = await realpath(tmpdir());
  const root = await mkdtemp(path.join(base, 'cgss-resolution-'));
  t.after(async () => {
    assert.equal(path.dirname(await realpath(root)), base);
    await rm(root, { recursive: true, force: true });
  });
  const put = async relative => { const file = path.join(root, relative); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, 'fixture'); return file; };
  return { root, put };
}

test('complete distributions prefer their bundled helper without consulting or downloading cache', async t => {
  const { root, put } = await fixture(t);
  const executable = await put('desktop/runtime/win32-x64/CGSS Idol Desktop.exe');
  const command = helperCommand({ root, platform: 'win32', arch: 'x64', resolveCached() { throw new Error('cache must not be consulted'); } });
  assert.deepEqual(command, { executable, args: [] });
});

test('lightweight packages use stable cache runtime to execute their current local desktop code', async t => {
  const { root } = await fixture(t);
  const dshHome = path.join(root, 'shared home');
  const executable = path.join(dshHome, 'idol-desktop/runtimes/electron-44.5.1-win32-x64/electron.exe');
  let calls = 0;
  const command = helperCommand({ root, platform: 'win32', arch: 'x64', dshHome, resolveCached(options) { calls++; assert.deepEqual(options, { dshHome, platform: 'win32', arch: 'x64' }); return executable; } });
  assert.equal(calls, 1);
  assert.deepEqual(command, { executable, args: [path.join(root, 'desktop/main.cjs')] });
});

test('missing cache falls back to a development Electron but never downloads one', async t => {
  const { root, put } = await fixture(t);
  const options = { root, platform: 'win32', arch: 'x64', resolveCached: () => null };
  assert.equal(helperCommand(options), null);
  const executable = await put('node_modules/electron/dist/electron.exe');
  assert.deepEqual(helperCommand(options), { executable, args: [path.join(root, 'desktop/main.cjs')] });
});

test('unsupported targets do not attempt runtime discovery or launch', () => {
  for (const [platform, arch] of [['linux', 'x64'], ['darwin', 'arm64'], ['win32', 'arm64']]) {
    assert.equal(helperCommand({ platform, arch, resolveCached() { throw new Error('unexpected lookup'); } }), null);
  }
});

test('missing runtime reports explicit installation and leaves the Web fallback intact', () => {
  let error;
  assert.equal(launchHelper({ command: null, onError(value) { error = value; } }), null);
  assert.match(error.message, /dsh-cgss-idol-runtime install/);
  assert.match(error.message, /Web/);
});
