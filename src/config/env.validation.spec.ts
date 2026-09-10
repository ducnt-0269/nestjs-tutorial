import { describe, expect, it } from 'vitest';
import { EnvironmentValidationError, validate } from './env.validation.js';

const validEnv = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a'.repeat(32),
  JWT_TTL_SECONDS: '604800',
};

describe('validate', () => {
  it('accepts a complete configuration and coerces PORT to a number', () => {
    const result = validate(validEnv);

    expect(result.PORT).toBe(3000);
    expect(result.NODE_ENV).toBe('development');
  });

  it('rejects a missing variable', () => {
    const { DATABASE_URL: _omitted, ...incomplete } = validEnv;

    expect(() => validate(incomplete)).toThrow(EnvironmentValidationError);
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(() => validate({ ...validEnv, JWT_SECRET: 'short' })).toThrow(
      EnvironmentValidationError,
    );
  });

  it('rejects a token lifetime that is not a positive integer', () => {
    for (const JWT_TTL_SECONDS of ['7d', '0', '-1', '1.5']) {
      expect(() => validate({ ...validEnv, JWT_TTL_SECONDS })).toThrow(
        EnvironmentValidationError,
      );
    }
  });

  it('rejects a PORT that is not a number', () => {
    expect(() => validate({ ...validEnv, PORT: 'abc' })).toThrow(
      EnvironmentValidationError,
    );
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validate({ ...validEnv, NODE_ENV: 'staging' })).toThrow(
      EnvironmentValidationError,
    );
  });

  it('rejects a URL that carries no protocol or the wrong one', () => {
    for (const DATABASE_URL of [
      'localhost:5432',
      'mysql://localhost:3306/db',
    ]) {
      expect(() => validate({ ...validEnv, DATABASE_URL })).toThrow(
        EnvironmentValidationError,
      );
    }
  });

  // ioredis reads "redis:///0" as localhost:6379 instead of failing, so a
  // hostless URL has to be rejected here or it silently hits the wrong server.
  it('rejects a URL with no host', () => {
    expect(() => validate({ ...validEnv, REDIS_URL: 'redis:///0' })).toThrow(
      EnvironmentValidationError,
    );

    expect(() =>
      validate({ ...validEnv, DATABASE_URL: 'postgresql:///db' }),
    ).toThrow(EnvironmentValidationError);
  });
});
