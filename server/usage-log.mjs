import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.join(__dirname, 'logs');
const logFile = path.join(logDir, 'usage.jsonl');

/**
 * @param {{
 *   t: string;
 *   clientId: string;
 *   catId: string;
 *   feature: 'care-bundle' | 'qa';
 *   ok: boolean;
 *   statusCode?: number;
 *   error?: string;
 *   model?: string;
 *   promptTokens?: number | null;
 *   completionTokens?: number | null;
 *   totalTokens?: number | null;
 *   estUsd?: number | null;
 * }} entry
 */
export function appendUsageLog(entry) {
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logFile, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (e) {
    console.error('[usage-log]', e);
  }
}
