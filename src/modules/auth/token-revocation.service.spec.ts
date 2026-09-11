import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisService } from '../../redis/redis.service.js';
import { TokenRevocationService } from './token-revocation.service.js';

const secret = 'test-secret-'.padEnd(32, 'x');
const ttlSeconds = 3600;

function keyFor(token: string): string {
  return `revoked:${createHash('sha256').update(token).digest('hex')}`;
}

describe('TokenRevocationService', () => {
  const setWithExpiry =
    vi.fn<(key: string, value: string, seconds: number) => Promise<void>>();
  const exists = vi.fn<(key: string) => Promise<boolean>>();
  const redis = { setWithExpiry, exists } as unknown as RedisService;
  const jwt = new JwtService({
    secret,
    signOptions: { expiresIn: ttlSeconds },
  });
  const revocation = new TokenRevocationService(redis, jwt);

  beforeEach(() => {
    // Frozen, so the remaining lifetime the service computes is exact.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    setWithExpiry.mockReset();
    setWithExpiry.mockResolvedValue(undefined);
    exists.mockReset();
    exists.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores the digest of the token for exactly the time it has left', async () => {
    const token = jwt.sign({ sub: '42' });

    await revocation.revoke(token);

    expect(keyFor(token)).toMatch(/^revoked:[0-9a-f]{64}$/);
    expect(setWithExpiry).toHaveBeenCalledWith(keyFor(token), '1', ttlSeconds);
  });

  it('writes nothing for a token that has already expired', async () => {
    const token = jwt.sign({ sub: '42' }, { expiresIn: '-1s' });

    await revocation.revoke(token);

    expect(setWithExpiry).not.toHaveBeenCalled();
  });

  it('calls a token revoked only while the blacklist holds its digest', async () => {
    const token = jwt.sign({ sub: '42' });

    exists.mockResolvedValueOnce(true);
    await expect(revocation.isRevoked(token)).resolves.toBe(true);

    exists.mockResolvedValueOnce(false);
    await expect(revocation.isRevoked(token)).resolves.toBe(false);

    expect(exists).toHaveBeenCalledWith(keyFor(token));
  });

  it('gives two tokens of the same account two different keys', async () => {
    const token = jwt.sign({ sub: '42', jti: randomUUID() });
    const other = jwt.sign({ sub: '42', jti: randomUUID() });

    await revocation.revoke(token);
    await revocation.revoke(other);

    const [[firstKey], [secondKey]] = setWithExpiry.mock.calls;
    expect(firstKey).not.toBe(secondKey);
  });

  it('passes a failure of the blacklist on rather than answering false', async () => {
    const failure = new Error("Stream isn't writeable");
    exists.mockRejectedValueOnce(failure);

    await expect(revocation.isRevoked(jwt.sign({ sub: '42' }))).rejects.toThrow(
      failure,
    );
  });
});
