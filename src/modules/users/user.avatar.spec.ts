import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';

import { MAX_IMAGE_BYTES } from '../attachments/attachments.constants.js';

import { png, storedUser, useAvatarHarness } from './user-avatar.fixture.js';

describe('POST /api/user/image', () => {
  const harness = useAvatarHarness();
  const { send, update, findMany, deleteMany, create, transaction } =
    harness.mocks;
  const { upload, commandsSent } = harness;

  it('stores the file, points the account at it, and answers with the account', async () => {
    const response = await upload(png)
      .expect(201)
      .expect('Cache-Control', 'no-store');

    expect(commandsSent()).toEqual([PutObjectCommand.name]);
    const [put] = send.mock.calls[0] as [PutObjectCommand];
    expect(put.input.Bucket).toBe('bucket');
    expect(put.input.Key).toMatch(/^users\/42\/[0-9a-f-]+\.png$/);
    expect(put.input.ContentType).toBe('image/png');

    expect(response.body.user.image).toBe(storedUser.image);
    expect(response.body.user.email).toBe('jake@example.com');
  });
  it('points the account at the public URL rather than at the bare key', async () => {
    await upload(png).expect(201);

    const [put] = send.mock.calls[0] as [PutObjectCommand];
    expect(update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { image: `http://storage.invalid:9000/bucket/${put.input.Key}` },
    });
  });
  it('writes the account through the transaction client, not around it', async () => {
    const txUpdate = vi.fn().mockResolvedValue(storedUser);
    transaction.mockImplementation((run: (tx: unknown) => Promise<unknown>) =>
      run({
        user: { update: txUpdate },
        attachment: { findMany, deleteMany, create },
      }),
    );

    await upload(png).expect(201);

    expect(txUpdate).toHaveBeenCalledTimes(1);
    // A write through the root client would not roll back with the attachment row.
    expect(update).not.toHaveBeenCalled();
  });
  // Holds the offset in place: the size the rejection message calls the maximum
  // has to be accepted.
  it('accepts a file of exactly the size limit', async () => {
    const atLimit = Buffer.alloc(MAX_IMAGE_BYTES);
    png.copy(atLimit);

    await upload(atLimit).expect(201);

    expect(commandsSent()).toEqual([PutObjectCommand.name]);
  });
  it('replaces an earlier attachment and clears the object it left', async () => {
    findMany.mockResolvedValue([{ objectKey: 'users/42/old.png' }]);

    await upload(png).expect(201);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { ownerType: 'User', ownerId: 42 },
    });
    const [{ data }] = create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data.objectKey).toMatch(/^users\/42\/[0-9a-f-]+\.png$/);
    expect(data.visibility).toBe('public');

    const [remove] = send.mock.calls[1] as [DeleteObjectCommand];
    expect(remove.input.Key).toBe('users/42/old.png');
  });
  it('answers 201 when clearing the replaced object fails', async () => {
    findMany.mockResolvedValue([{ objectKey: 'users/42/old.png' }]);
    send.mockImplementation((command: unknown) =>
      command instanceof DeleteObjectCommand
        ? Promise.reject(new Error('storage unreachable'))
        : Promise.resolve({}),
    );

    await upload(png).expect(201);
  });
});
