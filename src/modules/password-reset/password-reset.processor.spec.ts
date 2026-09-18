import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MailService } from '../../mail/mail.service.js';

import type { ResetMailJob } from './password-reset.constants.js';
import { PasswordResetMailProcessor } from './password-reset.processor.js';

const resetUrl = 'http://client.invalid/password-reset';

describe('PasswordResetMailProcessor', () => {
  const send = vi.fn();
  const mail = { send } as unknown as MailService;
  const config = new ConfigService({
    PASSWORD_RESET_URL: resetUrl,
  });
  const processor = new PasswordResetMailProcessor(mail, config);

  function jobOf(data: ResetMailJob): Job<ResetMailJob> {
    return { id: '1', data, attemptsMade: 1 } as Job<ResetMailJob>;
  }

  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue(undefined);
  });

  it('sends one mail carrying the link the token belongs to', async () => {
    await processor.process(
      jobOf({ email: 'jake@example.com', token: 'abc123' }),
    );

    expect(send).toHaveBeenCalledTimes(1);
    const [mailSent] = send.mock.calls[0];
    expect(mailSent.to).toBe('jake@example.com');
    expect(mailSent.text).toContain(`${resetUrl}?token=abc123`);
  });

  it('escapes a token whose characters would otherwise end the query', async () => {
    await processor.process(
      jobOf({ email: 'jake@example.com', token: 'a&b=c' }),
    );

    const [mailSent] = send.mock.calls[0];
    expect(mailSent.text).toContain(`${resetUrl}?token=a%26b%3Dc`);
  });

  it('logs a failure whose job can no longer be fetched instead of throwing', () => {
    // A stalled job arrives here as undefined, and throwing inside the emitter
    // would end the process rather than be caught anywhere.
    expect(() =>
      processor.onFailed(undefined, new Error('stalled')),
    ).not.toThrow();
  });

  it('lets a failure reach the queue instead of retiring the job', async () => {
    const unreachable = new Error('ECONNREFUSED');
    send.mockRejectedValueOnce(unreachable);

    await expect(
      processor.process(jobOf({ email: 'jake@example.com', token: 'abc123' })),
    ).rejects.toThrow(unreachable);
  });
});
