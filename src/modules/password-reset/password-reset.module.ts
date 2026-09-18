import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MailModule } from '../../mail/mail.module.js';
import { UsersModule } from '../users/users.module.js';

import { ExpiredTokenCleanupService } from './expired-token-cleanup.service.js';
import { PASSWORD_RESET_MAIL_QUEUE } from './password-reset.constants.js';
import { PasswordResetController } from './password-reset.controller.js';
import { PasswordResetMailProcessor } from './password-reset.processor.js';
import { PasswordResetService } from './password-reset.service.js';

@Module({
  imports: [
    UsersModule,
    MailModule,
    BullModule.registerQueueAsync({
      name: PASSWORD_RESET_MAIL_QUEUE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // No connection here on purpose: these options are shallow-merged over
        // the shared configuration, so naming a connection would replace the
        // one carrying the address and the retry settings rather than add to it.
        defaultJobOptions: {
          attempts: 5,
          // Waits a second, then two, then four, and so on, so a mail server
          // that is briefly down is not hammered while it comes back.
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          // A job that has used up its attempts rests in the failed set to be
          // read and sent again by hand, but only while the token it carries
          // could still be spent. Past that it can no longer be resent, and
          // keeping it would leave the token readable in Redis for nothing.
          removeOnFail: {
            age: configService.getOrThrow<number>('PASSWORD_RESET_TTL_SECONDS'),
          },
        },
      }),
    }),
  ],
  controllers: [PasswordResetController],
  providers: [
    PasswordResetService,
    PasswordResetMailProcessor,
    ExpiredTokenCleanupService,
  ],
})
export class PasswordResetModule {}
