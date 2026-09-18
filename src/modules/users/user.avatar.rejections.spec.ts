import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';

import { Prisma } from '../../generated/prisma/client.js';
import { MAX_IMAGE_BYTES } from '../attachments/attachments.constants.js';

import { png, useAvatarHarness } from './user-avatar.fixture.js';

describe('POST /api/user/image rejections', () => {
  const harness = useAvatarHarness();
  const { send, update, transaction } = harness.mocks;
  const { upload, commandsSent } = harness;

  it('refuses a caller with no token before reaching storage', async () => {
    const response = await upload(png, 'image/png', null).expect(401);

    expect(response.body).toEqual({ errors: { token: ['is invalid'] } });
    expect(send).not.toHaveBeenCalled();
  });
  it('refuses a request carrying no file part', async () => {
    const response = await upload(null).expect(422);

    expect(response.body).toEqual({ errors: { image: ["can't be blank"] } });
    expect(send).not.toHaveBeenCalled();
  });
  it('refuses a disallowed type whatever the client declared, storing nothing', async () => {
    const response = await upload(
      Buffer.from('plain text pretending to be an image', 'utf8'),
    ).expect(422);

    expect(response.body).toEqual({ errors: { image: ['is invalid'] } });
    expect(send).not.toHaveBeenCalled();
  });
  it('refuses a file over the size limit, storing nothing', async () => {
    const response = await upload(Buffer.alloc(MAX_IMAGE_BYTES + 1)).expect(
      422,
    );

    expect(response.body).toEqual({
      errors: { image: [`must be at most ${MAX_IMAGE_BYTES} bytes long`] },
    });
    expect(send).not.toHaveBeenCalled();
  });
  it('refuses an allowed type one byte over the limit', async () => {
    // The leading bytes are accepted, so only the size limit can refuse this.
    const overLimit = Buffer.alloc(MAX_IMAGE_BYTES + 1);
    png.copy(overLimit);

    const response = await upload(overLimit).expect(422);

    expect(response.body).toEqual({
      errors: { image: [`must be at most ${MAX_IMAGE_BYTES} bytes long`] },
    });
    expect(send).not.toHaveBeenCalled();
  });
  it('removes the object it just stored when the transaction fails', async () => {
    transaction.mockRejectedValue(new Error('constraint'));

    const response = await upload(png).expect(500);

    expect(response.body).toEqual({ errors: { server: ['internal error'] } });
    expect(commandsSent()).toEqual([
      PutObjectCommand.name,
      DeleteObjectCommand.name,
    ]);

    // The key removed has to be the key just written, or the compensation
    // cleaned up nothing and left the object behind.
    const [put] = send.mock.calls[0] as [PutObjectCommand];
    const [remove] = send.mock.calls[1] as [DeleteObjectCommand];
    // Read on its own first: the comparison must not hold by both sides being absent.
    expect(put.input.Key).toMatch(/^users\/42\/[0-9a-f-]+\.png$/);
    expect(remove.input.Key).toBe(put.input.Key);

    expect(update).not.toHaveBeenCalled();
  });
  it('still answers 500 when the compensating removal fails too', async () => {
    transaction.mockRejectedValue(new Error('constraint'));
    send.mockImplementation((command: unknown) =>
      command instanceof DeleteObjectCommand
        ? Promise.reject(new Error('storage unreachable'))
        : Promise.resolve({}),
    );

    const response = await upload(png).expect(500);

    expect(response.body).toEqual({ errors: { server: ['internal error'] } });
    expect(commandsSent()).toEqual([
      PutObjectCommand.name,
      DeleteObjectCommand.name,
    ]);
  });
  it('answers 401 when the account disappeared before the commit', async () => {
    transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('gone', {
        code: 'P2025',
        clientVersion: '7.10.0',
      }),
    );

    const response = await upload(png).expect(401);

    expect(response.body).toEqual({ errors: { token: ['is invalid'] } });
    expect(commandsSent()).toEqual([
      PutObjectCommand.name,
      DeleteObjectCommand.name,
    ]);
  });
});
