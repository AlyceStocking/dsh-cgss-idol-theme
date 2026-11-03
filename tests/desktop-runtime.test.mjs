import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findCachedRuntime, installRuntime, runtimeDirectory, RUNTIME_NAME, RUNTIME_SHA256, RUNTIME_VERSION, REQUIRED_RUNTIME_FILES } from '../lib/desktop-runtime.js';
import { runCli } from '../scripts/desktop-runtime.mjs';

async function fixture(t) {
  const base = await realpath(tmpdir()), root = await mkdtemp(path.join(base, 'idol-runtime-test-'));
  t.after(async () => {
    assert.equal(path.dirname(await realpath(root)), base);
    assert.ok(path.basename(root).startsWith('idol-runtime-test-'));
    await rm(root, { recursive: true, force: true });
  });
  const options = { dshHome: path.join(root, 'dsh home & spaces'), platform: 'win32', arch: 'x64' };
  const archive = path.join(root, 'electron fixture.zip');
  await writeFile(archive, 'not an official archive');
  const dependencies = { download: async () => archive, hashArchive: () => RUNTIME_SHA256, extract: extractFixture };
  return { root, options, archive, dependencies, directory: runtimeDirectory(options) };
}

async function extractFixture(_archive, { dir, onEntry }) {
  for (const name of REQUIRED_RUNTIME_FILES) {
    onEntry({ fileName: name, externalFileAttributes: 0 });
    const file = path.join(dir, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, name === 'version' ? RUNTIME_VERSION : 'fixture:' + name);
  }
}

// Minimal stored ZIP fixture, independent of Electron downloads and ZIP writers.
function zipFixture(entries) {
  const local = [], central = [];
  let offset = 0;
  for (const { name, data = 'fixture', mode = 0o100644 } of entries) {
    const filename = Buffer.from(name), bytes = Buffer.from(data);
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = Buffer.alloc(30), record = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(filename.length, 26);
    record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(0x0314, 4); record.writeUInt16LE(20, 6);
    record.writeUInt32LE(crc, 16); record.writeUInt32LE(bytes.length, 20); record.writeUInt32LE(bytes.length, 24);
    record.writeUInt16LE(filename.length, 28); record.writeUInt32LE((mode << 16) >>> 0, 38); record.writeUInt32LE(offset, 42);
    local.push(header, filename, bytes); central.push(record, filename);
    offset += header.length + filename.length + bytes.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

const forbidden = () => { throw new Error('Unexpected download or extraction'); };

test('offline lookup is read-only and unsupported installs fail before I/O', async t => {
  const f = await fixture(t);
  assert.equal(findCachedRuntime(f.options), null);
  for (const platform of ['linux', 'darwin']) {
    await assert.rejects(installRuntime({ ...f.options, platform }, { download: forbidden }), /Windows x64/);
    assert.equal(findCachedRuntime({ ...f.options, platform }), null);
  }
  await assert.rejects(installRuntime({ ...f.options, arch: 'arm64' }), /Windows x64/);
  assert.equal(existsSync(f.options.dshHome), false);
});

test('explicit install publishes a complete manifest and reuses valid cache without network', async t => {
  const f = await fixture(t), result = await installRuntime(f.options, f.dependencies);
  assert.equal(result.reused, false);
  assert.equal(result.executable, path.join(f.directory, 'electron.exe'));
  assert.equal(findCachedRuntime(f.options), result.executable);
  const manifest = JSON.parse(await readFile(path.join(f.directory, 'dsh-runtime.json'), 'utf8'));
  assert.equal(manifest.archiveSha256, RUNTIME_SHA256);
  assert.deepEqual(Object.keys(manifest.files).sort(), [...REQUIRED_RUNTIME_FILES].sort());
  assert.deepEqual(await readdir(path.dirname(f.directory)), [RUNTIME_NAME]);
  assert.equal((await installRuntime(f.options, { download: forbidden, extract: forbidden })).reused, true);
});

test('offline archive bypasses download, is copied privately, and follows the same hash check', async t => {
  const f = await fixture(t);
  let hashed;
  const result = await installRuntime({ ...f.options, archive: f.archive }, { ...f.dependencies, download: forbidden,
    hashArchive: async file => { hashed = file; assert.notEqual(file, f.archive); assert.equal(await readFile(file, 'utf8'), 'not an official archive'); return RUNTIME_SHA256; },
    extract: async (file, options) => { assert.equal(file, hashed); await extractFixture(file, options); } });
  assert.equal(result.reused, false);
});

test('wrong archive checksum never reaches extraction and cleans only its staging', async t => {
  const f = await fixture(t), parent = path.dirname(f.directory);
  await mkdir(path.join(parent, '.unrelated-stage'), { recursive: true });
  await writeFile(path.join(parent, '.unrelated-stage', 'keep'), 'keep');
  await assert.rejects(installRuntime({ ...f.options, archive: f.archive }, { extract: forbidden }), /SHA256 mismatch/);
  assert.equal(findCachedRuntime(f.options), null);
  assert.deepEqual(await readdir(parent), ['.unrelated-stage']);
  assert.equal(await readFile(f.archive, 'utf8'), 'not an official archive');
});

test('failed download releases the lock and can be retried', async t => {
  const f = await fixture(t);
  await assert.rejects(installRuntime(f.options, { download: () => { throw new Error('offline'); } }), /offline/);
  assert.deepEqual(await readdir(path.dirname(f.directory)), []);
  assert.equal((await installRuntime(f.options, f.dependencies)).reused, false);
});

test('missing runtime files and extraction failures are never published', async t => {
  const f = await fixture(t);
  for (const extract of [async () => {}, async () => { throw new Error('extraction failed'); }]) {
    await assert.rejects(installRuntime(f.options, { ...f.dependencies, extract }), /Missing|extraction failed/);
    assert.deepEqual(await readdir(path.dirname(f.directory)), []);
  }
});

test('damaged cache refuses overwrite and preserves existing bytes', async t => {
  const f = await fixture(t);
  await installRuntime(f.options, f.dependencies);
  const file = path.join(f.directory, 'electron.exe');
  await writeFile(file, 'damaged');
  assert.equal(findCachedRuntime(f.options), null);
  await assert.rejects(installRuntime(f.options, { download: forbidden }), /invalid.*refusing to overwrite/);
  assert.equal(await readFile(file, 'utf8'), 'damaged');
  assert.deepEqual(await readdir(path.dirname(f.directory)), [RUNTIME_NAME]);
});

test('missing or extra files and a tampered manifest invalidate cache', async t => {
  const f = await fixture(t);
  await installRuntime(f.options, f.dependencies);
  const extra = path.join(f.directory, 'unexpected.dll');
  await writeFile(extra, 'extra');
  assert.equal(findCachedRuntime(f.options), null);
  await unlink(extra);
  const manifestPath = path.join(f.directory, 'dsh-runtime.json');
  const original = await readFile(manifestPath, 'utf8'), manifest = JSON.parse(original);
  manifest.files['../../outside'] = { size: 1, sha256: 'untrusted path must never be read' };
  await writeFile(manifestPath, JSON.stringify(manifest));
  assert.equal(findCachedRuntime(f.options), null);
  await writeFile(manifestPath, original);
  await unlink(path.join(f.directory, 'ffmpeg.dll'));
  assert.equal(findCachedRuntime(f.options), null);
});

test('only a root regular debug.log is excluded from cache integrity checks', async t => {
  const f = await fixture(t), result = await installRuntime(f.options, f.dependencies);
  const manifest = path.join(f.directory, 'dsh-runtime.json'), before = await readFile(manifest, 'utf8');
  const log = path.join(f.directory, 'debug.log');
  await writeFile(log, 'Electron runtime diagnostic output');
  assert.equal(findCachedRuntime(f.options), result.executable);
  assert.equal((await installRuntime(f.options, { download: forbidden, extract: forbidden })).reused, true);
  await writeFile(log, 'updated diagnostics');
  assert.equal(findCachedRuntime(f.options), result.executable);
  assert.equal(await readFile(manifest, 'utf8'), before);
  for (const relative of ['other.log', 'resources/debug.log']) {
    const unexpected = path.join(f.directory, relative);
    await writeFile(unexpected, 'must not be exempt');
    assert.equal(findCachedRuntime(f.options), null);
    await unlink(unexpected);
  }
});

test('a directory named debug.log invalidates the cache', async t => {
  const f = await fixture(t);
  await installRuntime(f.options, f.dependencies);
  await mkdir(path.join(f.directory, 'debug.log'));
  assert.equal(findCachedRuntime(f.options), null);
  await assert.rejects(installRuntime(f.options, { download: forbidden }), /invalid/);
});

test('a symbolic link named debug.log invalidates cache without following it', async t => {
  const f = await fixture(t), target = path.join(f.root, 'external-log-target');
  await installRuntime(f.options, f.dependencies);
  await mkdir(target);
  await symlink(target, path.join(f.directory, 'debug.log'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(findCachedRuntime(f.options), null);
  await assert.rejects(installRuntime(f.options, { download: forbidden }), /invalid/);
  assert.deepEqual(await readdir(target), []);
});

test('concurrent installer cannot remove another installer lock or staging', async t => {
  const f = await fixture(t);
  let release, started;
  const ready = new Promise(resolve => { started = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  const first = installRuntime(f.options, { ...f.dependencies, extract: async (...args) => { started(); await pending; await extractFixture(...args); } });
  await ready;
  try {
    await assert.rejects(installRuntime(f.options, { download: forbidden }), /locked/);
    assert.equal(existsSync(f.directory + '.lock'), true);
    assert.equal(findCachedRuntime(f.options), null);
  } finally { release(); }
  assert.equal((await first).reused, false);
  assert.equal(existsSync(f.directory + '.lock'), false);
});

test('preexisting lock is not stolen or deleted', async t => {
  const f = await fixture(t);
  await mkdir(f.directory + '.lock', { recursive: true });
  await assert.rejects(installRuntime(f.options, { download: forbidden }), /stale lock manually/);
  assert.equal(existsSync(f.directory + '.lock'), true);
});

test('ZIP callback rejects traversal, absolute paths, Windows aliases and symlinks', async t => {
  const f = await fixture(t);
  for (const name of ['../escape', '/absolute', 'C:/absolute', 'a/../../escape', 'a\\escape', 'a:stream', 'a/CON.txt', 'a./file', 'a /file']) {
    await assert.rejects(installRuntime(f.options, { ...f.dependencies, extract: async (_file, { onEntry }) => {
      onEntry({ fileName: name, externalFileAttributes: 0 });
    } }), /Unsafe ZIP entry/);
  }
  await assert.rejects(installRuntime(f.options, { ...f.dependencies, extract: async (_file, { onEntry }) => {
    onEntry({ fileName: 'link', externalFileAttributes: (0o120777 << 16) >>> 0 });
  } }), /Unsafe ZIP entry/);
  assert.deepEqual(await readdir(path.dirname(f.directory)), []);
});

test('cache junctions and linked parent directories are rejected', async t => {
  const f = await fixture(t), target = path.join(f.root, 'external');
  await mkdir(target);
  await mkdir(path.dirname(f.directory), { recursive: true });
  await symlink(target, f.directory, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(findCachedRuntime(f.options), null);
  await assert.rejects(installRuntime(f.options, { download: forbidden }), /invalid/);
  const linkedHome = path.join(f.root, 'linked-home');
  await symlink(target, linkedHome, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(installRuntime({ ...f.options, dshHome: linkedHome }, { download: forbidden }), /symbolic link/);
  assert.deepEqual(await readdir(target), []);
});

test('real extract-zip installs a complete synthetic ZIP without network', async t => {
  const f = await fixture(t);
  await writeFile(f.archive, zipFixture(REQUIRED_RUNTIME_FILES.map(name => ({ name, data: name === 'version' ? RUNTIME_VERSION : 'fixture:' + name }))));
  const result = await installRuntime({ ...f.options, archive: f.archive }, { download: forbidden, hashArchive: () => RUNTIME_SHA256 });
  assert.equal(findCachedRuntime(f.options), result.executable);
});

test('real extract-zip rejects traversal and symlink entries before publishing', async t => {
  const f = await fixture(t);
  for (const entry of [{ name: '../escape' }, { name: 'link', mode: 0o120777, data: '../../outside' }]) {
    await writeFile(f.archive, zipFixture([entry]));
    await assert.rejects(installRuntime({ ...f.options, archive: f.archive }, { download: forbidden, hashArchive: () => RUNTIME_SHA256 }), /invalid relative path|Unsafe ZIP entry/);
    assert.deepEqual(await readdir(path.dirname(f.directory)), []);
    assert.equal(existsSync(path.join(f.root, 'outside')), false);
  }
});

test('CLI parses explicit paths and status never invokes installation', async t => {
  const f = await fixture(t), output = [], log = line => output.push(line);
  let received;
  assert.equal(await runCli(['install', '--dsh-home', f.options.dshHome, '--archive', f.archive], {
    log, error: log, install: async options => { received = options; return { executable: 'example', reused: false }; },
  }), 0);
  assert.deepEqual(received, { dshHome: f.options.dshHome, archive: f.archive });
  assert.match(output.pop(), /Installed/);
  assert.equal(await runCli(['status', '--dsh-home', f.options.dshHome], { log, error: log, find: () => null, install: forbidden }), 1);
  assert.equal(await runCli(['status'], { log, error: log, find: () => 'cached', install: forbidden }), 0);
  assert.match(output.pop(), /Ready: cached/);
  for (const argv of [[], ['auto'], ['install', '--dsh-home'], ['status', '--archive', f.archive], ['install', '--force'], ['install', '--dsh-home', 'a', '--dsh-home', 'b']]) {
    assert.equal(await runCli(argv, { log, error: log, install: forbidden }), 1);
    assert.match(output.pop(), /Usage:/);
  }
  assert.equal(await runCli(['--help'], { log }), 0);
});

test('Electron Host validates physical ASAR bytes and still rejects modified runtime files', { skip: !process.env.DSH_TEST_ELECTRON }, async t => {
  const f = await fixture(t);
  const installed = await installRuntime(f.options, f.dependencies);
  const script = path.join(f.root, 'electron-probe.mjs');
  const moduleUrl = new URL('../lib/desktop-runtime.js', import.meta.url).href;
  await writeFile(script, `import { findCachedRuntime } from ${JSON.stringify(moduleUrl)};
console.log(JSON.stringify({ electron: process.versions.electron, executable: findCachedRuntime(${JSON.stringify(f.options)}) }));
`);
  const invoke = () => {
    const result = spawnSync(process.env.DSH_TEST_ELECTRON, ['--expose-internals', script], { encoding: 'utf8', timeout: 30000, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout.trim());
    assert.ok(output.electron, 'must exercise a real Electron Host, not ordinary Node');
    return output.executable;
  };
  assert.equal(invoke(), installed.executable);
  await writeFile(path.join(f.directory, 'resources/default_app.asar'), 'modified archive bytes');
  assert.equal(invoke(), null, 'ASAR bypass must preserve physical file integrity validation');
});

test('CLI subprocess reports status and checksum failures without network', async t => {
  const f = await fixture(t), script = fileURLToPath(new URL('../scripts/desktop-runtime.mjs', import.meta.url));
  const invoke = args => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  const status = invoke(['status', '--dsh-home', f.options.dshHome]);
  assert.equal(status.status, 1); assert.match(status.stdout, /Not installed/);
  assert.equal(existsSync(f.options.dshHome), false);
  const help = invoke(['--help']);
  assert.equal(help.status, 0); assert.match(help.stdout, /Usage:/);
  const install = invoke(['install', '--dsh-home', f.options.dshHome, '--archive', f.archive]);
  assert.equal(install.status, 1);
  assert.match(install.stderr, process.platform === 'win32' && process.arch === 'x64' ? /SHA256 mismatch/ : /Windows x64/);
});
