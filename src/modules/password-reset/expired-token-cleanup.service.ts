import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ExpiredTokenCleanupService {
  private readonly logger = new Logger(ExpiredTokenCleanupService.name);

  constructor(private readonly prismaService: PrismaService) {}

  // An expired row is already refused on its own, so this sweep is
  // housekeeping rather than part of the rule, and an hour between runs is
  // close enough. Running it on every instance costs a delete that finds
  // nothing, which is cheaper than the coordination not doing so would need.
  @Cron(CronExpression.EVERY_HOUR)
  async removeExpired(): Promise<void> {
    const { count } = await this.prismaService.passwordResetToken.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });

    if (count > 0) {
      this.logger.log(`Removed ${count} expired password reset tokens`);
    }
  }
}
