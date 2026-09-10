/**
 * The one error shape the API returns, whatever the status
 * (docs/system-architecture.md §2). The key names what the error is about:
 * a field, `credentials`, `token`, a resource name.
 */
export interface ErrorsEnvelope {
  errors: Record<string, string[]>;
}

export function isErrorsEnvelope(value: unknown): value is ErrorsEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const errors = (value as { errors?: unknown }).errors;
  return (
    typeof errors === 'object' && errors !== null && !Array.isArray(errors)
  );
}
