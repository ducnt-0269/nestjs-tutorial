import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

import { invalidResetToken } from '../../common/errors/api-error.js';
import { isRowGone } from '../../prisma/prisma-errors.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';

import {
  PASSWORD_RESET_MAIL_QUEUE,
  type ResetMailJob,
  SEND_RESET_MAIL,
} from './password-reset.constants.js';
import { digestResetToken, generateResetToken } from './reset-token.js';

const MILLISECONDS = 1000;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    @InjectQueue(PASSWORD_RESET_MAIL_QUEUE)
    private readonly mailQueue: Queue<ResetMailJob>,
  ) {}

  // An address with no account returns here just as quietly as one with an
  // account, and nothing is sent, so the answer never reports who holds an
  // account on this system.
  async request(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return;
    }

    const token = generateResetToken();
    const lifetime = this.configService.getOrThrow<number>(
      'PASSWORD_RESET_TTL_SECONDS',
    );

    await this.prismaService.passwordResetToken.create({
      data: {
        tokenHash: digestResetToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + lifetime * MILLISECONDS),
      },
    });

    // Handed to the queue rather than to the mail server, and deliberately not
    // waited on. Handing a job over waits for the connection to be ready
    // first, which never happens while Redis is away, so awaiting it would
    // hold this response open until it came back. It would hold it open only
    // on this branch, too, since an address with no account returns above
    // without ever reaching Redis, and that difference is itself the answer
    // about who holds an account that this endpoint exists not to give.
    void this.mailQueue
      .add(SEND_RESET_MAIL, { email: user.email, token })
      .catch((error: unknown) => {
        // Nothing to tell the caller: the response has already gone. The token
        // stays valid, so asking again once the queue is back sends the mail.
        this.logger.error(
          `Queueing a password reset mail failed: ${String(error)}`,
        );
      });
  }

  async spend(token: string, password: string): Promise<void> {
    await this.prismaService.$transaction(async (tx) => {
      // The delete is the check, not a step after it. Reading the row first
      // would let two requests arriving together both find it and both change
      // the password; here exactly one delete finds a row and the other is
      // refused. Expiry sits in the same condition rather than in a branch
      // after it, so a row that outlived its lifetime is refused whether or
      // not the recurring sweep has reached it yet.
      const spent = await tx.passwordResetToken
        .delete({
          where: {
            tokenHash: digestResetToken(token),
            expiresAt: { gt: new Date() },
          },
        })
        .catch((error: unknown) => {
          // Spent, expired and never issued all arrive here as the same
          // missing row, which is the same answer they are owed.
          if (isRowGone(error)) throw invalidResetToken();
          throw error;
        });

      await this.usersService.setPassword(tx, spent.userId, password);

      // Whatever else was outstanding for this account goes with it. Leaving
      // an earlier link working would hand whoever holds it a way in after the
      // password changed, which is the thing being asked for here.
      await tx.passwordResetToken.deleteMany({
        where: { userId: spent.userId },
      });
    });
  }
}
