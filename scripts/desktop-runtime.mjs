#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { findCachedRuntime, installRuntime, runtimeDirectory } from '../lib/desktop-runtime.js';

const usage = 'Usage: dsh-cgss-idol-runtime <install|status> [--dsh-home PATH] [--archive PATH (install only)]';

export async function runCli(argv, { log = console.log, error = console.error, install = installRuntime, find = findCachedRuntime } = {}) {
  try {
    if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) { log(usage); return 0; }
    const [command, ...args] = argv, options = {};
    if (!['install', 'status'].includes(command)) throw new Error(usage);
    for (let index = 0; index < args.length; index += 2) {
      const name = args[index], value = args[index + 1];
      if (!['--dsh-home', '--archive'].includes(name) || !value || value.startsWith('--')) throw new Error(usage);
      const key = name === '--dsh-home' ? 'dshHome' : 'archive';
      if (Object.hasOwn(options, key) || (key === 'archive' && command !== 'install')) throw new Error(usage);
      options[key] = path.resolve(value);
    }
    if (command === 'status') {
      const executable = find(options);
      log(executable ? 'Ready: ' + executable : 'Not installed, invalid, or unsupported: ' + runtimeDirectory(options));
      return executable ? 0 : 1;
    }
    const result = await install(options);
    log((result.reused ? 'Already installed: ' : 'Installed: ') + result.executable);
    return 0;
  } catch (failure) { error(failure.message); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
