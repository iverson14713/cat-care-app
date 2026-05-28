/**
 * `npx cap sync ios` only lists node_modules plugins in `packageClassList`.
 * Append local App-target plugins here. Prefer: `npm run cap:sync:ios` or `node scripts/cap-sync-ios.mjs`
 * (runs this automatically after sync).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const capJsonPath = resolve('ios/App/App/capacitor.config.json');
const capJSON = JSON.parse(readFileSync(capJsonPath, 'utf8'));
const list = Array.isArray(capJSON.packageClassList) ? [...capJSON.packageClassList] : [];

const localPlugins = ['PetCareAppleSignInPlugin', 'PetCareIAPPlugin'];
let changed = false;

for (const pluginClass of localPlugins) {
  if (!list.includes(pluginClass)) {
    list.push(pluginClass);
    changed = true;
    console.log(`[ensure-ios-plugins] added ${pluginClass} to packageClassList`);
  }
}

if (changed) {
  capJSON.packageClassList = list;
  writeFileSync(capJsonPath, `${JSON.stringify(capJSON, null, '\t')}\n`);
}
