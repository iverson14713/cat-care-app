/**
 * `npx cap sync ios` overwrites `ios/App/App/capacitor.config.json` and drops local App-target
 * plugins from `packageClassList`. Always run `ensure-ios-plugins.mjs` after sync.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(root);

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run('npx', ['cap', 'sync', 'ios']);
run('node', [join(root, 'ensure-ios-plugins.mjs')]);
