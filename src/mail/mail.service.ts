import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';

import { MAIL_TRANSPORT } from './mail.constants.js';

interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
}

// Knows how to hand a message to a mail server and nothing about what any
// message says; the module that owns the wording composes it.
@Injectable()
export class MailService implements OnModuleDestroy {
  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: Transporter,
    private readonly configService: ConfigService,
  ) {}

  // The sender is configuration rather than an argument, so no caller can put
  // a different address on the envelope.
  async send(mail: OutgoingMail): Promise<void> {
    await this.transport.sendMail({
      ...mail,
      from: this.configService.getOrThrow<string>('MAIL_FROM'),
    });
  }

  onModuleDestroy(): void {
    this.transport.close();
  }
}
