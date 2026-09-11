import { UnprocessableEntityException } from '@nestjs/common';
import type { StandardSchemaV1 } from '@standard-schema/spec';

/**
 * Groups schema issues by the last segment of their path, so a body of
 * `{ user: { email: "x" } }` reports `{ errors: { email: [...] } }` rather
 * than the flat "user.email is invalid" the pipe would produce on its own.
 */
export function validationExceptionFactory(
  issues: readonly StandardSchemaV1.Issue[],
): UnprocessableEntityException {
  const errors: Record<string, string[]> = {};
  for (const issue of issues) {
    (errors[fieldOf(issue)] ??= []).push(issue.message);
  }
  return new UnprocessableEntityException({ errors });
}

// The spec allows a path segment to be either a property key or `{ key }`.
function fieldOf(issue: StandardSchemaV1.Issue): string {
  const last = issue.path?.at(-1);
  if (last === undefined) return 'body';
  return String(typeof last === 'object' ? last.key : last);
}
