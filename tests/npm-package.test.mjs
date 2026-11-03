import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyLightweightReport } from '../scripts/pack-npm.mjs';
const paths = ['package.json', 'cordis.patch.yml', 'lib/index.js', 'lib/client.js', 'lib/characters.js', 'lib/desktop-process.js', 'lib/desktop-runtime.js', 'scripts/desktop-runtime.mjs', 'desktop/main.cjs', 'desktop/preload.cjs', 'desktop/renderer.js', 'desktop/index.html', 'desktop/style.css', 'desktop/sprite-cache.js', 'desktop/idol-picker.js', 'README.md', 'README.en.md', 'LICENSE'];
const report = () => ({ size: 6_500_000, files: paths.map(path => ({ path })) });

test('lightweight package validation retains Web, desktop and explicit installer code', () => {
  assert.doesNotThrow(() => verifyLightweightReport(report()));
});

test('missing installer or desktop code fails lightweight publication verification', () => {
  for (const path of ['scripts/desktop-runtime.mjs', 'lib/desktop-runtime.js', 'desktop/main.cjs', 'desktop/idol-picker.js', 'cordis.patch.yml']) {
    const value = report(); value.files = value.files.filter(file => file.path !== path);
    assert.throws(() => verifyLightweightReport(value), /Missing lightweight package component/);
  }
});

test('accidentally bundled runtimes and build trees cannot pass npm verification', () => {
  for (const path of ['desktop/runtime/win32-x64/version', 'desktop/electron.exe', 'lib/driver.DLL', 'build/output.txt', 'node_modules/extra/index.js', 'desktop/runtime.zip']) {
    const value = report(); value.files.push({ path });
    assert.throws(() => verifyLightweightReport(value), /Unexpected runtime or build artifact/);
  }
});

test('archive compression must stay within the lightweight size budget', () => {
  for (const size of [0, -1, NaN, Infinity, 10_000_000, 170_000_000]) {
    assert.throws(() => verifyLightweightReport({ ...report(), size }), /10 MB budget/);
  }
});
