import 'reflect-metadata';

import { CronExpression } from '@nestjs/schedule';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../prisma/prisma.service.js';

import { ExpiredTokenCleanupService } from './expired-token-cleanup.service.js';

describe('ExpiredTokenCleanupService', () => {
  const deleteMany = vi.fn();
  const prisma = {
    passwordResetToken: { deleteMany },
  } as unknown as PrismaService;
  const cleanup = new ExpiredTokenCleanupService(prisma);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    deleteMany.mockReset();
    deleteMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('removes every token whose lifetime has run out', async () => {
    deleteMany.mockResolvedValue({ count: 3 });

    await cleanup.removeExpired();

    expect(deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lte: new Date('2026-01-01T00:00:00Z') } },
    });
  });

  it('runs on a schedule rather than on a request', () => {
    // No route reaches this method, so what makes it run at all is the
    // decorator, and the schedule it carries is the thing worth asserting.
    const scheduled = Object.getOwnPropertyDescriptor(
      ExpiredTokenCleanupService.prototype,
      'removeExpired',
    )?.value as object;
    const options: unknown = Reflect.getMetadata(
      'SCHEDULE_CRON_OPTIONS',
      scheduled,
    );

    expect(options).toEqual({ cronTime: CronExpression.EVERY_HOUR });
  });
});
