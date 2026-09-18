import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MailService } from './mail.service.js';

const sender = 'no-reply@example.com';

describe('MailService', () => {
  const sendMail = vi.fn();
  const transport = { sendMail, close: vi.fn() } as unknown as Transporter;
  const service = new MailService(
    transport,
    new ConfigService({ MAIL_FROM: sender }),
  );

  beforeEach(() => {
    sendMail.mockReset();
    sendMail.mockResolvedValue(undefined);
  });

  it('puts the configured sender on the envelope', async () => {
    await service.send({ to: 'jake@example.com', subject: 'Hi', text: 'body' });

    expect(sendMail).toHaveBeenCalledWith({
      from: sender,
      to: 'jake@example.com',
      subject: 'Hi',
      text: 'body',
    });
  });

  it('gives no caller a way to put a different address on the envelope', async () => {
    const forged = { to: 'jake@example.com', subject: 'Hi', text: 'body' };

    await service.send({ ...forged, from: 'someone@else.test' } as never);

    expect(sendMail.mock.calls[0][0].from).toBe(sender);
  });

  it('passes a failure on so the caller can decide what it means', async () => {
    const unreachable = new Error('ECONNREFUSED');
    sendMail.mockRejectedValueOnce(unreachable);

    await expect(
      service.send({ to: 'jake@example.com', subject: 'Hi', text: 'body' }),
    ).rejects.toThrow(unreachable);
  });
});
