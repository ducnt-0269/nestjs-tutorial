import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { createMailTransport } from './mail-transport.provider.js';
import { MAIL_TRANSPORT } from './mail.constants.js';
import { MailService } from './mail.service.js';

@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      useFactory: createMailTransport,
      inject: [ConfigService],
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
