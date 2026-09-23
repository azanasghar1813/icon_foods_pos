/**
 * Zod 4 exposes issues on `error.issues`. Older code used `error.errors`,
 * which is undefined and crashed validation handlers.
 */
export function zodIssueList(error) {
  const issues = error?.issues || error?.errors || [];
  if (!Array.isArray(issues)) return [];
  return issues.map((err) => ({
    field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || ''),
    message: err.message || 'Invalid value'
  }));
}

export function zodFirstMessage(error, fallback = 'Validation failed') {
  return zodIssueList(error)[0]?.message || fallback;
}
