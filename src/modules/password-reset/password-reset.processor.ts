import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';

import { MailService } from '../../mail/mail.service.js';

import {
  PASSWORD_RESET_MAIL_QUEUE,
  type ResetMailJob,
} from './password-reset.constants.js';

const SUBJECT = 'Reset your password';

@Processor(PASSWORD_RESET_MAIL_QUEUE)
export class PasswordResetMailProcessor extends WorkerHost {
  private readonly logger = new Logger(PasswordResetMailProcessor.name);

  constructor(
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  // A failure travels on rather than being caught here: throwing is what tells
  // the queue to attempt the job again, and swallowing it would retire the job
  // as delivered and lose the mail.
  async process(job: Job<ResetMailJob>): Promise<void> {
    const { email, token } = job.data;

    await this.mailService.send({
      to: email,
      subject: SUBJECT,
      text: this.bodyFor(token),
    });
  }

  // Runs once the last attempt has failed as well as after each earlier one.
  // The job itself stays in the failed set, holding everything needed to send
  // it again; this line is only what points a maintainer at it. The token is
  // not among what is written, because a log is one more place it could be
  // read from.
  // The job is optional because a stalled one can no longer be fetched, and
  // reading through it would throw inside the emitter, where nothing catches
  // it and the process ends.
  @OnWorkerEvent('failed')
  onFailed(job: Job<ResetMailJob> | undefined, error: Error): void {
    this.logger.error(
      `Sending a password reset mail failed on attempt ${job?.attemptsMade ?? 0} of job ${job?.id ?? 'unknown'}: ${error.message}`,
    );
  }

  private bodyFor(token: string): string {
    // Composed rather than concatenated: the configured address may already
    // carry a query of its own, and a second question mark would leave a link
    // that no longer parses.
    const link = new URL(
      this.configService.getOrThrow<string>('PASSWORD_RESET_URL'),
    );
    link.searchParams.set('token', token);

    return [
      'Someone asked for the password of this account to be reset.',
      '',
      'Open the link below to choose a new one:',
      '',
      link.toString(),
      '',
      'The link works once and stops working after a while. If this was not',
      'you, nothing has changed and there is nothing you need to do.',
    ].join('\n');
  }
}
