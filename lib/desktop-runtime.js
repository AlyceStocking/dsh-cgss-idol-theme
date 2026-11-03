import { createHash } from 'node:crypto';
import { closeSync, lstatSync, openSync, readFileSync, readdirSync, readSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export const RUNTIME_VERSION = '44.5.1';
export const RUNTIME_SHA256 = '9b382492dcfee91f8f9e92c91f7972550a1b95d2299cac72279dab33a600d7db';
export const RUNTIME_NAME = 'electron-44.5.1-win32-x64';
const manifestName = 'dsh-runtime.json';
export const REQUIRED_RUNTIME_FILES = Object.freeze([
  'electron.exe', 'chrome_100_percent.pak', 'chrome_200_percent.pak',
  'd3dcompiler_47.dll', 'dxcompiler.dll', 'dxil.dll', 'ffmpeg.dll', 'icudtl.dat',
  'LICENSE', 'LICENSES.chromium.html', 'resources.pak', 'snapshot_blob.bin',
  'v8_context_snapshot.bin', 'vk_swiftshader.dll', 'vk_swiftshader_icd.json',
  'vulkan-1.dll', 'version', 'locales/en-US.pak', 'resources/default_app.asar',
]);

export function runtimeDirectory({ dshHome } = {}) {
  return path.join(path.resolve(dshHome || process.env.DSH_HOME || path.join(homedir(), '.dsh')), 'idol-desktop', 'runtimes', RUNTIME_NAME);
}

function supported({ platform = process.platform, arch = process.arch } = {}) {
  return platform === 'win32' && arch === 'x64';
}

// Check each ancestor, not just the leaf: junctions must not redirect the cache.
function noLinks(candidate) {
  const absolute = path.resolve(candidate), parent = path.dirname(absolute);
  if (parent !== absolute) noLinks(parent);
  const info = lstatSync(absolute);
  if (info.isSymbolicLink()) throw new Error('Refusing symbolic link: ' + absolute);
  return info;
}

function exists(candidate) {
  try { lstatSync(candidate); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function ensureDirectory(directory) {
  if (!exists(directory)) {
    await ensureDirectory(path.dirname(directory));
    try { await mkdir(directory); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  if (!noLinks(directory).isDirectory()) throw new Error('Not a regular directory: ' + directory);
}

function fileHash(file) {
  const hash = createHash('sha256'), buffer = Buffer.allocUnsafe(1024 * 1024), fd = openSync(file, 'r');
  try {
    let count;
    while ((count = readSync(fd, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, count));
    return hash.digest('hex');
  } finally { closeSync(fd); }
}

function safeName(name) {
  return typeof name === 'string' && name.length > 0 && !/[\\:*?"<>|\x00-\x1f]/u.test(name)
    && name.split('/').every(part => part && part !== '.' && part !== '..' && !/[. ]$/u.test(part)
      && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part));
}

function inventory(directory, relative = '', files = Object.create(null)) {
  for (const entry of readdirSync(path.join(directory, relative), { withFileTypes: true })) {
    const name = relative ? relative + '/' + entry.name : entry.name;
    if (!safeName(name)) throw new Error('Unsafe runtime path: ' + name);
    const file = path.join(directory, name), info = lstatSync(file);
    if (info.isSymbolicLink()) throw new Error('Refusing runtime link: ' + name);
    // Electron may create this log next to its executable. Exempt only this
    // root-level regular file, never a link, directory or nested namesake.
    if (name === 'debug.log') {
      if (!info.isFile()) throw new Error('Not a regular runtime log: ' + name);
      continue;
    }
    if (info.isDirectory()) inventory(directory, name, files);
    else if (!info.isFile()) throw new Error('Not a regular runtime file: ' + name);
    else if (name !== manifestName) files[name] = { size: info.size, sha256: fileHash(file) };
  }
  return files;
}

function requireComplete(files, directory) {
  for (const name of REQUIRED_RUNTIME_FILES) {
    if (!Object.hasOwn(files, name) || files[name].size <= 0) throw new Error('Missing or empty runtime file: ' + name);
  }
  if (readFileSync(path.join(directory, 'version'), 'utf8').trim() !== RUNTIME_VERSION) throw new Error('Unexpected Electron version.');
}

function validCache(directory) {
  if (!noLinks(directory).isDirectory()) return false;
  const manifestPath = path.join(directory, manifestName);
  if (!noLinks(manifestPath).isFile()) return false;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.schema !== 1 || manifest.version !== RUNTIME_VERSION || manifest.platform !== 'win32'
    || manifest.arch !== 'x64' || manifest.archiveSha256 !== RUNTIME_SHA256 || !manifest.files) return false;
  const files = inventory(directory), names = Object.keys(files);
  requireComplete(files, directory);
  return names.length === Object.keys(manifest.files).length && names.every(name => Object.hasOwn(manifest.files, name)
    && files[name].size === manifest.files[name].size && files[name].sha256 === manifest.files[name].sha256);
}

/** Synchronous, read-only, offline lookup. Invalid, linked or unsupported caches return null. */
export function findCachedRuntime(options = {}) {
  if (!supported(options)) return null;
  const directory = runtimeDirectory(options);
  try { return validCache(directory) ? path.join(directory, 'electron.exe') : null; } catch { return null; }
}

async function downloadRuntime() {
  const { downloadArtifact } = await import('@electron/get');
  return downloadArtifact({ version: RUNTIME_VERSION, artifactName: 'electron', platform: 'win32', arch: 'x64',
    checksums: { ['electron-v' + RUNTIME_VERSION + '-win32-x64.zip']: RUNTIME_SHA256 } });
}

async function extractRuntime(archive, options) {
  const { default: extract } = await import('extract-zip');
  return extract(archive, options);
}

// extract-zip calls this before writing an entry. Its own path containment check
// remains enabled; reject links and Windows aliases as well, on every platform.
function checkEntry(entry) {
  const name = entry.fileName.replace(/\/$/u, '');
  const type = (entry.externalFileAttributes >>> 16) & 0o170000;
  if (!safeName(name) || (type && type !== 0o100000 && type !== 0o040000)) throw new Error('Unsafe ZIP entry: ' + entry.fileName);
}

/** Explicit install only. Dependency overrides are for trusted, offline tests. */
export async function installRuntime(options = {}, dependencies = {}) {
  if (!supported(options)) throw new Error('Desktop runtime installation supports Windows x64 only.');
  const directory = runtimeDirectory(options), parent = path.dirname(directory);
  await ensureDirectory(parent);
  const lock = directory + '.lock';
  try { await mkdir(lock); } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Runtime install is locked: ' + lock + '. If no installer is running, remove this stale lock manually.');
    throw error;
  }
  let staging;
  try {
    if (exists(directory)) {
      const executable = findCachedRuntime(options);
      if (!executable) throw new Error('Existing runtime cache is invalid; refusing to overwrite: ' + directory);
      return { executable, directory, reused: true };
    }
    const source = path.resolve(options.archive || await (dependencies.download || downloadRuntime)());
    if (!noLinks(source).isFile()) throw new Error('Archive is not a regular file: ' + source);
    staging = await mkdtemp(path.join(parent, '.' + RUNTIME_NAME + '-'));
    const archive = path.join(staging, 'electron.zip'), extracted = path.join(staging, 'runtime');
    // Hash a private copy so changes to an external archive cannot race extraction.
    await copyFile(source, archive);
    const digest = await (dependencies.hashArchive || fileHash)(archive);
    if (digest !== RUNTIME_SHA256) throw new Error('Electron archive SHA256 mismatch; expected ' + RUNTIME_SHA256 + ', received ' + digest);
    await mkdir(extracted);
    await (dependencies.extract || extractRuntime)(archive, { dir: extracted, onEntry: checkEntry });
    if (exists(path.join(extracted, manifestName))) throw new Error('Archive contains a reserved runtime manifest.');
    const files = inventory(extracted);
    requireComplete(files, extracted);
    await writeFile(path.join(extracted, manifestName), JSON.stringify({ schema: 1, version: RUNTIME_VERSION,
      platform: 'win32', arch: 'x64', archiveSha256: RUNTIME_SHA256, files }, null, 2) + '\n', { flag: 'wx' });
    if (exists(directory)) throw new Error('Runtime destination appeared during installation; refusing to overwrite.');
    await rename(extracted, directory);
    return { executable: path.join(directory, 'electron.exe'), directory, reused: false };
  } finally {
    // These paths are exclusively owned by this invocation; never remove an old cache.
    try {
      if (staging && path.dirname(staging) === parent && path.basename(staging).startsWith('.' + RUNTIME_NAME + '-')) {
        noLinks(staging);
        await rm(staging, { recursive: true, force: true });
      }
    } finally { await rmdir(lock); }
  }
}
