import 'reflect-metadata';

import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { compareSync } from 'bcrypt';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { CommonModule } from '../../common/common.module.js';
import { validate } from '../../config/env.validation.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { UsersService } from '../users/users.service.js';

import { PASSWORD_RESET_MAIL_QUEUE } from './password-reset.constants.js';
import { PasswordResetController } from './password-reset.controller.js';
import { PasswordResetService } from './password-reset.service.js';
import { digestResetToken } from './reset-token.js';

const oldPassword = 'old-password';
const newPassword = 'new-password';
const invalidToken = { errors: { token: ['is invalid'] } };

interface StoredToken {
  userId: number;
  expiresAt: Date;
}

// What the client raises when a delete matches no row.
function rowGone(): Error {
  return new Prisma.PrismaClientKnownRequestError('No record was found', {
    code: 'P2025',
    clientVersion: '7.10.0',
  });
}

describe('PUT /api/users/password-reset', () => {
  let app: INestApplication;
  // Stands in for the table, so the conditions the service puts on the delete
  // decide the outcome here just as they would in the database.
  const rows = new Map<string, StoredToken>();
  const update = vi.fn();

  const deleteMany = vi.fn();

  const deleteToken = vi.fn(
    ({ where }: { where: { tokenHash: string; expiresAt: { gt: Date } } }) => {
      const row = rows.get(where.tokenHash);

      if (!row || row.expiresAt <= where.expiresAt.gt) {
        return Promise.reject(rowGone());
      }

      rows.delete(where.tokenHash);
      return Promise.resolve({ id: 1, tokenHash: where.tokenHash, ...row });
    },
  );

  beforeAll(async () => {
    const tx = {
      passwordResetToken: { delete: deleteToken, deleteMany },
      user: { update },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate }),
        CommonModule,
      ],
      controllers: [PasswordResetController],
      providers: [
        PasswordResetService,
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: (work: (client: typeof tx) => Promise<unknown>) =>
              work(tx),
          },
        },
        { provide: AttachmentsService, useValue: {} },
        { provide: getQueueToken(PASSWORD_RESET_MAIL_QUEUE), useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('/api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    rows.clear();
    deleteToken.mockClear();
    deleteMany.mockReset();
    deleteMany.mockResolvedValue({ count: 0 });
    update.mockReset();
    update.mockResolvedValue(undefined);
  });

  function spend(body: object) {
    return request(app.getHttpServer())
      .put('/api/users/password-reset')
      .send(body);
  }

  function issue(token: string, expiresAt: Date): void {
    rows.set(digestResetToken(token), { userId: 42, expiresAt });
  }

  function inAnHour(): Date {
    return new Date(Date.now() + 3600 * 1000);
  }

  it('answers 204 and stores a bcrypt hash of the new password', async () => {
    issue('live-token', inAnHour());

    const response = await spend({
      user: { token: 'live-token', password: newPassword },
    }).expect(204);

    expect(response.body).toEqual({});

    const { where, data } = update.mock.calls[0][0];
    expect(where).toEqual({ id: 42 });
    expect(compareSync(newPassword, data.password)).toBe(true);
    expect(compareSync(oldPassword, data.password)).toBe(false);
  });

  it('retires every other token the account still holds', async () => {
    issue('first-token', inAnHour());
    issue('second-token', inAnHour());

    await spend({
      user: { token: 'second-token', password: newPassword },
    }).expect(204);

    // An earlier link left working would still open the account after the
    // password changed.
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 42 } });
  });

  it('refuses a token that has already been spent', async () => {
    issue('once-token', inAnHour());

    await spend({
      user: { token: 'once-token', password: newPassword },
    }).expect(204);
    update.mockClear();

    const second = await spend({
      user: { token: 'once-token', password: 'another-password' },
    }).expect(422);

    expect(second.body).toEqual(invalidToken);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses a token past its lifetime', async () => {
    issue('stale-token', new Date(Date.now() - 1000));

    const response = await spend({
      user: { token: 'stale-token', password: newPassword },
    }).expect(422);

    expect(response.body).toEqual(invalidToken);
    expect(update).not.toHaveBeenCalled();
  });

  it('answers an expired token and one that never existed identically', async () => {
    issue('stale-token', new Date(Date.now() - 1000));

    const expired = await spend({
      user: { token: 'stale-token', password: newPassword },
    }).expect(422);
    const unknown = await spend({
      user: { token: 'never-issued', password: newPassword },
    }).expect(422);

    expect(expired.status).toBe(unknown.status);
    expect(expired.body).toEqual(unknown.body);
  });

  it('refuses a weak password the way registration does and leaves the token spendable', async () => {
    issue('live-token', inAnHour());

    const refused = await spend({
      user: { token: 'live-token', password: 'short' },
    }).expect(422);

    expect(refused.body).toEqual({
      errors: { password: ['must be at least 8 characters long'] },
    });
    // The rule runs at the boundary, so nothing reached the table.
    expect(deleteToken).not.toHaveBeenCalled();

    await spend({
      user: { token: 'live-token', password: newPassword },
    }).expect(204);
  });

  it('answers 422 keyed by field when the token is missing', async () => {
    const response = await spend({ user: { password: newPassword } }).expect(
      422,
    );

    expect(response.body).toEqual({ errors: { token: ["can't be blank"] } });
  });
});
