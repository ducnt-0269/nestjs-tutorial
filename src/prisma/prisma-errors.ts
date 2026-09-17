import { Prisma } from '../generated/prisma/client.js';

// Error codes Prisma documents; the module that owns the client owns the
// knowledge of what they mean. What each one should answer stays with the
// caller, which is the only place that knows what the request asked for.
const UNIQUE_VIOLATION = 'P2002';
const ROW_NOT_FOUND = 'P2025';

function hasCode(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

// A write landed on a value some other row already holds.
export function isUniqueViolation(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return hasCode(error, UNIQUE_VIOLATION);
}

// An update or a delete found no row to act on.
export function isRowGone(error: unknown): boolean {
  return hasCode(error, ROW_NOT_FOUND);
}

interface UniqueViolationMeta {
  driverAdapterError?: {
    cause?: { table?: string; constraint?: { index?: string } };
  };
}

/**
 * Prisma 7 with a driver adapter no longer populates `meta.target`; the only
 * thing adapter-pg passes on is the violated index name, even though the
 * documentation still describes `target`. Open upstream since 2025-10:
 * https://github.com/prisma/prisma/issues/28281 (#28953 is the P2002-specific
 * duplicate). Index names follow `<table>_<column>_key` (docs/code-standards.md
 * §3), so the column is what sits between. Once the issue is fixed this
 * function collapses to `meta.target[0]`.
 *
 * One column only. A composite unique index is named for every column it
 * spans, so this returns all of them joined, and the caller has to decide
 * which one the request should be told about.
 */
export function violatedColumn(
  exception: Prisma.PrismaClientKnownRequestError,
): string | undefined {
  const cause = (exception.meta as UniqueViolationMeta | undefined)
    ?.driverAdapterError?.cause;
  const table = cause?.table ?? '';
  const index = cause?.constraint?.index ?? '';
  const prefix = `${table}_`;
  if (!table || !index.startsWith(prefix)) return undefined;
  return index.slice(prefix.length).replace(/_key$/, '') || undefined;
}
