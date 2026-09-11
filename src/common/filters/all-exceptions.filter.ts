import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

const UNIQUE_VIOLATION = 'P2002';

/**
 * The one error shape the API returns, whatever the status
 * (docs/system-architecture.md §2). The key names what the error is about:
 * a field, `credentials`, `token`, a resource name.
 */
interface ErrorsBody {
  errors: Record<string, string[]>;
}

interface UniqueViolationMeta {
  driverAdapterError?: {
    cause?: { table?: string; constraint?: { index?: string } };
  };
}

/**
 * Every error leaves the API as `{ errors: { <key>: [messages] } }`, whatever
 * raised it. Catching everything also means Nest no longer logs unknown
 * errors, so the 500 branch has to log them itself.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    // Mirrors Nest's BaseExceptionFilter: once a handler has started
    // streaming, another status line would throw inside the error path.
    if (response.headersSent) {
      response.end();
      return;
    }
    const { status, body } = this.toResponse(exception);
    response.status(status).json(body);
  }

  private toResponse(exception: unknown): {
    status: number;
    body: ErrorsBody;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (isErrorsBody(payload)) return { status, body: payload };
      return { status, body: envelope('request', exception.message) };
    }

    if (isUniqueViolation(exception)) {
      return {
        status: HttpStatus.CONFLICT,
        body: envelope(violatedField(exception), 'has already been taken'),
      };
    }

    // Errors raised before Nest sees the request, such as body-parser
    // rejecting malformed JSON, carry their own status without being
    // HttpExceptions.
    const status = httpStatusOf(exception);
    if (status !== undefined) {
      return { status, body: envelope('request', messageOf(exception)) };
    }

    this.logger.error(exception, AllExceptionsFilter.name);
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: envelope('server', 'internal error'),
    };
  }
}

function envelope(key: string, message: string): ErrorsBody {
  return { errors: { [key]: [message] } };
}

function isErrorsBody(value: unknown): value is ErrorsBody {
  if (typeof value !== 'object' || value === null) return false;
  const errors = (value as { errors?: unknown }).errors;
  return (
    typeof errors === 'object' && errors !== null && !Array.isArray(errors)
  );
}

function isUniqueViolation(
  exception: unknown,
): exception is Prisma.PrismaClientKnownRequestError {
  return (
    exception instanceof Prisma.PrismaClientKnownRequestError &&
    exception.code === UNIQUE_VIOLATION
  );
}

/**
 * Prisma 7 with a driver adapter no longer populates `meta.target`; the only
 * thing adapter-pg passes on is the violated index name, even though the
 * documentation still describes `target`. Open upstream since 2025-10:
 * https://github.com/prisma/prisma/issues/28281 (#28953 is the P2002-specific
 * duplicate). Index names follow `<table>_<column>_key` (docs/system-architecture.md
 * §4), so the column is what sits between. Once the issue is fixed this
 * function collapses to `meta.target[0]`.
 */
function violatedField(
  exception: Prisma.PrismaClientKnownRequestError,
): string {
  const cause = (exception.meta as UniqueViolationMeta | undefined)
    ?.driverAdapterError?.cause;
  const table = cause?.table ?? '';
  const index = cause?.constraint?.index ?? '';
  const prefix = `${table}_`;
  if (!table || !index.startsWith(prefix)) return 'body';
  return index.slice(prefix.length).replace(/_key$/, '') || 'body';
}

function httpStatusOf(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const { status, statusCode } = exception as {
    status?: unknown;
    statusCode?: unknown;
  };
  const candidate = status ?? statusCode;
  return typeof candidate === 'number' && candidate >= 400 && candidate < 600
    ? candidate
    : undefined;
}

function messageOf(exception: unknown): string {
  return exception instanceof Error ? exception.message : 'bad request';
}
