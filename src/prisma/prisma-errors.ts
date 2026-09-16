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
