// class-transformer reads decorator metadata; Nest loads this itself at runtime.
import 'reflect-metadata';

import { describe, expect, it } from 'vitest';
import { EnvironmentValidationError, validate } from './env.validation.js';

const validEnv = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
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
});
