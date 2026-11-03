import { spawnSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function verifyLightweightReport(report) {
  const files = new Set(report.files.map(file => file.path));
  for (const required of ['package.json', 'cordis.patch.yml', 'lib/index.js', 'lib/client.js', 'lib/characters.js', 'lib/desktop-process.js', 'lib/desktop-runtime.js', 'scripts/desktop-runtime.mjs', 'desktop/main.cjs', 'desktop/preload.cjs', 'desktop/renderer.js', 'desktop/index.html', 'desktop/style.css', 'desktop/sprite-cache.js', 'README.md', 'README.en.md', 'LICENSE']) {
    if (!files.has(required)) throw new Error('Missing lightweight package component: ' + required);
  }
  for (const file of files) {
    if (file.startsWith('desktop/runtime/') || /\.(exe|dll|node|zip|tgz)$/iu.test(file) || file.split('/').some(part => ['node_modules', 'build', '.git'].includes(part))) {
      throw new Error('Unexpected runtime or build artifact in npm package: ' + file);
    }
  }
  if (!(report.size > 0 && report.size < 10_000_000)) throw new Error('Lightweight npm archive exceeds the 10 MB budget.');
}

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error('Run this check with npm run pack:npm.');
  const destination = path.join(root, 'build', 'npm');
  await mkdir(destination, { recursive: true });
  const result = spawnSync(process.execPath, [npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', destination], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('npm pack failed: ' + result.status);
  const [report] = JSON.parse(result.stdout);
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (report.name !== metadata.name || report.version !== metadata.version) throw new Error('Packed package identity differs from source.');
  verifyLightweightReport(report);
  console.log(JSON.stringify({ archive: path.join(destination, report.filename), name: report.name, version: report.version, size: report.size, unpackedSize: report.unpackedSize, files: report.entryCount, shasum: report.shasum, integrity: report.integrity }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
