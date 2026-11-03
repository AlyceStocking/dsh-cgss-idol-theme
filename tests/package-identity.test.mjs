import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import { requiredSourceFiles } from '../scripts/sync-desktop.mjs';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('renamed package, lockfile, bundle patch and browser registration agree', async () => {
  const metadata = JSON.parse(await read('package.json'));
  const lock = JSON.parse(await read('package-lock.json'));
  assert.equal(metadata.name, 'dsh-cgss-idol-theme');
  assert.equal(lock.name, metadata.name);
  assert.equal(lock.packages[''].name, metadata.name);
  assert.equal(lock.version, metadata.version);
  assert.equal(lock.packages[''].version, metadata.version);
  assert.equal(metadata.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(metadata.dsh.client.platform, 'web');
  for (const entry of Object.values(metadata.exports)) await access(new URL(`../${entry}`, import.meta.url));
  for (const file of ['lib', 'desktop/*.cjs', 'desktop/*.js', 'desktop/*.html', 'desktop/*.css', 'scripts/desktop-runtime.mjs', 'cordis.patch.yml', 'README.md', 'README.en.md', 'LICENSE']) assert.ok(metadata.files.includes(file));
  assert.ok(!metadata.files.includes('desktop'), 'npm must not ship the whole runtime directory');
  assert.equal(metadata.bin['dsh-cgss-idol-runtime'], './scripts/desktop-runtime.mjs');
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) assert.equal(metadata.scripts[hook], undefined, `no implicit download in ${hook}`);
  for (const entry of Object.values(metadata.bin)) await access(new URL(`../${entry}`, import.meta.url));
  const patch = await read('cordis.patch.yml');
  assert.match(patch, /id: cgss-idol-theme/);
  assert.ok(patch.includes(`name: '${metadata.name}'`));
  let registration;
  vm.runInNewContext(await read('lib/client.js'), { window: { __ModuleLoader__: { load: entry => { registration = entry; } } } });
  assert.equal(registration.id, metadata.name);
  assert.equal(typeof registration.factory, 'function');
  const client = registration.factory(() => ({}));
  assert.ok(client.inject.includes('slots'));
  assert.equal(typeof client.apply, 'function');
  const host = await import('../lib/index.js');
  assert.equal(typeof host.apply, 'function');
});

test('desktop packaging, loading and archive validation use the same executable', async () => {
  const executable = 'CGSS Idol Desktop.exe';
  assert.ok(requiredSourceFiles.includes(`desktop/runtime/win32-x64/${executable}`));
  assert.ok((await read('lib/desktop-process.js')).includes(executable));
  assert.ok((await read('scripts/package-desktop.mjs')).includes(executable));
  assert.ok((await read('scripts/package-desktop.mjs')).includes('version: metadata.version'));
});
