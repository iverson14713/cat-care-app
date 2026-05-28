import type { DbError } from './supabaseError';

export type SyncAction = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

export type SyncSeverity = 'critical' | 'warning';

export type SyncIssue = {
  table: string;
  action: SyncAction;
  message: string;
  code?: string;
  severity: SyncSeverity;
  catId?: string;
  recordKey?: string;
  source?: 'pull' | 'push' | 'local';
};

const WARNING_TABLES = new Set([
  'daily_record_photos',
  'weekly_reports',
  'user_ai_usage',
  'user_preferences',
]);

/** PostgREST: no rows (e.g. empty maybeSingle) — not a sync failure. */
const WARNING_CODES = new Set(['PGRST116']);

/** Tables that must exist for core care; missing table / RLS is critical. */
const CRITICAL_TABLES = new Set([
  'cats',
  'daily_records',
  'weight_records',
  'monthly_records',
  'user_reminders',
]);

export function classifySyncSeverity(table: string, code?: string): SyncSeverity {
  if (code && WARNING_CODES.has(code)) return 'warning';
  if (WARNING_TABLES.has(table)) return 'warning';
  if (CRITICAL_TABLES.has(table)) return 'critical';
  return 'warning';
}

export function makeSyncIssue(params: {
  table: string;
  action: SyncAction;
  error: DbError | Error | string;
  catId?: string;
  recordKey?: string;
  source?: SyncIssue['source'];
  severity?: SyncSeverity;
}): SyncIssue {
  const err =
    typeof params.error === 'string'
      ? { message: params.error }
      : 'message' in params.error
        ? params.error
        : { message: String(params.error) };
  const code = 'code' in err && typeof err.code === 'string' ? err.code : undefined;
  const message = err.message;
  const severity = params.severity ?? classifySyncSeverity(params.table, code);
  return {
    table: params.table,
    action: params.action,
    message,
    code,
    severity,
    catId: params.catId,
    recordKey: params.recordKey,
    source: params.source,
  };
}

export function logSyncIssue(issue: SyncIssue): void {
  const payload = {
    table: issue.table,
    action: issue.action,
    code: issue.code ?? null,
    message: issue.message,
    severity: issue.severity,
    catId: issue.catId ?? null,
    recordKey: issue.recordKey ?? null,
    source: issue.source ?? null,
  };
  if (issue.severity === 'critical') {
    console.error('[cloud-sync]', payload);
  } else {
    console.warn('[cloud-sync]', payload);
  }
}

export function logSyncIssueBatch(issues: SyncIssue[], label: string): void {
  if (issues.length === 0) return;
  const critical = issues.filter((i) => i.severity === 'critical');
  const warnings = issues.filter((i) => i.severity === 'warning');
  for (const issue of issues) logSyncIssue(issue);
  console.warn(`[cloud-sync] ${label}`, {
    total: issues.length,
    critical: critical.length,
    warnings: warnings.length,
    tables: [...new Set(issues.map((i) => i.table))],
  });
}

export function formatIssuesForUi(issues: SyncIssue[], max = 2): string {
  return issues
    .slice(0, max)
    .map((i) => {
      const where = i.catId ? ` (${i.catId.slice(0, 8)}…)` : '';
      const code = i.code ? ` [${i.code}]` : '';
      return `${i.table}${where}: ${i.message}${code}`;
    })
    .join(' · ');
}

/** Legacy `photos ${catId}: msg` strings → structured issue (for gradual migration). */
export function parseLegacySyncErrorString(raw: string, source: SyncIssue['source']): SyncIssue {
  const pullPrefixes: Record<string, { table: string; action: SyncAction }> = {
    photos: { table: 'daily_record_photos', action: 'select' },
    daily: { table: 'daily_records', action: 'select' },
    weight: { table: 'weight_records', action: 'select' },
    monthly: { table: 'monthly_records', action: 'select' },
    weekly: { table: 'weekly_reports', action: 'select' },
    reminders: { table: 'user_reminders', action: 'select' },
    'ai usage': { table: 'user_ai_usage', action: 'select' },
    'ai plan': { table: 'user_preferences', action: 'select' },
  };
  const pushPrefixes: Record<string, { table: string; action: SyncAction }> = {
    'daily upsert': { table: 'daily_records', action: 'upsert' },
    'photos upsert': { table: 'daily_record_photos', action: 'upsert' },
    'weight upsert': { table: 'weight_records', action: 'upsert' },
    'monthly upsert': { table: 'monthly_records', action: 'upsert' },
    'weekly upsert': { table: 'weekly_reports', action: 'upsert' },
    'reminders upsert': { table: 'user_reminders', action: 'upsert' },
    'ai usage upsert': { table: 'user_ai_usage', action: 'upsert' },
    'ai plan upsert': { table: 'user_preferences', action: 'upsert' },
  };

  for (const [prefix, meta] of Object.entries(pullPrefixes)) {
    const m = raw.match(new RegExp(`^${prefix}\\s+([^:]+):\\s*(.+)$`));
    if (m) {
      return makeSyncIssue({
        ...meta,
        error: m[2],
        catId: m[1].length === 36 ? m[1] : undefined,
        recordKey: m[1].length !== 36 ? m[1] : undefined,
        source,
      });
    }
    if (raw.startsWith(`${prefix}:`)) {
      return makeSyncIssue({ ...meta, error: raw.slice(prefix.length + 1).trim(), source });
    }
  }

  for (const [prefix, meta] of Object.entries(pushPrefixes)) {
    const m = raw.match(new RegExp(`^${prefix}\\s+([^\\s]+)(?:\\s+([^:]+))?:\\s*(.+)$`));
    if (m) {
      return makeSyncIssue({
        ...meta,
        error: m[3],
        catId: m[1],
        recordKey: m[2],
        source,
      });
    }
  }

  return makeSyncIssue({
    table: 'unknown',
    action: 'select',
    error: raw,
    source,
    severity: 'critical',
  });
}
