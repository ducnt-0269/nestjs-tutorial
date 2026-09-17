import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  type ErrorsBody,
  fieldBody,
  internalErrorBody,
  requestErrorBody,
} from '../errors/api-error.js';
import { TAKEN_MESSAGE } from '../errors/messages.js';
import {
  isUniqueViolation,
  violatedColumn,
} from '../../prisma/prisma-errors.js';

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
      return { status, body: requestErrorBody(exception.message) };
    }

    if (isUniqueViolation(exception)) {
      return {
        status: HttpStatus.CONFLICT,
        // The column is what Postgres reports; naming the whole body is the
        // best the API can do when the index name does not yield one.
        body: fieldBody(violatedColumn(exception) ?? 'body', TAKEN_MESSAGE),
      };
    }

    // Errors raised before Nest sees the request, such as body-parser
    // rejecting malformed JSON, carry their own status without being
    // HttpExceptions.
    const status = httpStatusOf(exception);
    if (status !== undefined) {
      return { status, body: requestErrorBody(messageOf(exception)) };
    }

    this.logger.error(exception, AllExceptionsFilter.name);
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: internalErrorBody,
    };
  }
}

function isErrorsBody(value: unknown): value is ErrorsBody {
  if (typeof value !== 'object' || value === null) return false;
  const errors = (value as { errors?: unknown }).errors;
  return (
    typeof errors === 'object' && errors !== null && !Array.isArray(errors)
  );
}

// body-parser uses expose to mark messages safe for clients; status alone is insufficient.
function httpStatusOf(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const { status, statusCode, expose } = exception as {
    status?: unknown;
    statusCode?: unknown;
    expose?: unknown;
  };
  if (expose !== true) return undefined;
  const candidate = status ?? statusCode;
  return typeof candidate === 'number' && candidate >= 400 && candidate < 500
    ? candidate
    : undefined;
}

function messageOf(exception: unknown): string {
  return exception instanceof Error ? exception.message : 'bad request';
}
