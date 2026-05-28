/** Normalized PostgREST / Supabase error (preserves `code` for sync diagnostics). */
export type DbError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export function mapSupabaseErr(
  error: { message: string; code?: string; details?: string; hint?: string } | null
): DbError | null {
  if (!error) return null;
  return {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  };
}
