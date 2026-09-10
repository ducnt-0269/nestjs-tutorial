import 'reflect-metadata';
import {
  type ArgumentsHost,
  HttpException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { ErrorsEnvelopeFilter } from './errors-envelope.filter.js';

function mockResponse(headersSent = false) {
  return {
    headersSent,
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    end: vi.fn(),
  };
}

function hostFor(response: unknown): ArgumentsHost {
  return {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
}

function run(
  exception: unknown,
  logger = new Logger(),
): { status: number; body: unknown } {
  const response = mockResponse();
  new ErrorsEnvelopeFilter(logger).catch(exception, hostFor(response));

  return {
    status: response.status.mock.calls[0]?.[0] as number,
    body: response.json.mock.calls[0]?.[0],
  };
}

// Copied from a real duplicate insert against Postgres through adapter-pg.
function uniqueViolation(index: string, table = 'users'): Error {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.0',
    meta: {
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: {
          originalCode: '23505',
          kind: 'UniqueConstraintViolation',
          constraint: { index },
          table,
        },
      },
      modelName: 'User',
    },
  });
}

describe('ErrorsEnvelopeFilter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes through an HttpException that already carries an errors envelope', () => {
    const payload = { errors: { email: ["can't be blank"] } };

    expect(run(new UnprocessableEntityException(payload))).toEqual({
      status: 422,
      body: payload,
    });
  });

  it('wraps a plain HttpException under the "request" key', () => {
    expect(run(new NotFoundException('Cannot GET /api/nothing'))).toEqual({
      status: 404,
      body: { errors: { request: ['Cannot GET /api/nothing'] } },
    });
  });

  it('maps a Prisma unique violation to 409 keyed by the violated column', () => {
    expect(run(uniqueViolation('users_email_key'))).toEqual({
      status: 409,
      body: { errors: { email: ['has already been taken'] } },
    });
  });

  it('falls back to "body" when the index name does not follow the convention', () => {
    expect(run(uniqueViolation('something_else'))).toEqual({
      status: 409,
      body: { errors: { body: ['has already been taken'] } },
    });
  });

  it('keeps the status of a non-Nest error that carries one, such as malformed JSON', () => {
    const parseError = Object.assign(new SyntaxError('Unexpected token'), {
      status: 400,
      type: 'entity.parse.failed',
    });

    expect(run(parseError)).toEqual({
      status: 400,
      body: { errors: { request: ['Unexpected token'] } },
    });
  });

  it('answers 500 with a fixed message and logs the original error', () => {
    const logger = new Logger();
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const boom = new Error('connection refused');

    expect(run(boom, logger)).toEqual({
      status: 500,
      body: { errors: { server: ['internal error'] } },
    });
    expect(error).toHaveBeenCalledWith(boom, 'ErrorsEnvelopeFilter');
  });

  it('only ends the response when headers were already sent', () => {
    const response = mockResponse(true);

    new ErrorsEnvelopeFilter(new Logger()).catch(
      new Error('mid-stream'),
      hostFor(response),
    );

    expect(response.end).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });

  it('does not treat an HttpException as a generic status-bearing error', () => {
    // HttpException has no `status` property; getStatus() is the source.
    expect(run(new HttpException('teapot', 418)).status).toBe(418);
  });
});
