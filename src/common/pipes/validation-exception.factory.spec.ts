import { UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validationExceptionFactory } from './validation-exception.factory.js';

describe('validationExceptionFactory', () => {
  it('returns a 422 keyed by the last path segment of each issue', () => {
    const exception = validationExceptionFactory([
      { message: "can't be blank", path: ['user', 'username'] },
      { message: 'is invalid', path: ['user', 'email'] },
    ]);

    expect(exception).toBeInstanceOf(UnprocessableEntityException);
    expect(exception.getStatus()).toBe(422);
    expect(exception.getResponse()).toEqual({
      errors: { username: ["can't be blank"], email: ['is invalid'] },
    });
  });

  it('collects several messages under one field', () => {
    const exception = validationExceptionFactory([
      { message: 'is too short', path: ['user', 'password'] },
      { message: 'needs a digit', path: ['user', 'password'] },
    ]);

    expect(exception.getResponse()).toEqual({
      errors: { password: ['is too short', 'needs a digit'] },
    });
  });

  it('accepts the { key } form of a path segment', () => {
    const exception = validationExceptionFactory([
      { message: 'is invalid', path: ['user', { key: 'email' }] },
    ]);

    expect(exception.getResponse()).toEqual({
      errors: { email: ['is invalid'] },
    });
  });

  it('falls back to "body" when the issue has no path', () => {
    const exception = validationExceptionFactory([
      { message: 'expected object' },
    ]);

    expect(exception.getResponse()).toEqual({
      errors: { body: ['expected object'] },
    });
  });
});
