import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard.js';

// The one branch no request can reach: an error raised inside the strategy.
describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard();

  it('passes an error from the strategy on rather than calling the token bad', () => {
    const failure = new Error('the blacklist is unreachable');

    expect(() => guard.handleRequest(failure, false)).toThrow(failure);
  });

  it('answers a verified caller with that caller', () => {
    const caller = { id: 42, token: 'a.b.c' };

    expect(guard.handleRequest(null, caller)).toBe(caller);
  });
});
