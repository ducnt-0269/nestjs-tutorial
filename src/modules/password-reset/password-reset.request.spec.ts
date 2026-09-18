import 'reflect-metadata';

import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { CommonModule } from '../../common/common.module.js';
import { validate } from '../../config/env.validation.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { UsersService } from '../users/users.service.js';

import { PASSWORD_RESET_MAIL_QUEUE } from './password-reset.constants.js';
import { PasswordResetController } from './password-reset.controller.js';
import { PasswordResetService } from './password-reset.service.js';
import { digestResetToken } from './reset-token.js';

const account = {
  id: 42,
  email: 'jake@example.com',
  username: 'jake',
  bio: null,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// The value the test environment gives the lifetime.
const lifetimeSeconds = 3600;

describe('POST /api/users/password-reset', () => {
  let app: INestApplication;
  const findUnique = vi.fn();
  const create = vi.fn();
  const add = vi.fn();

  beforeAll(async () => {
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
          useValue: { user: { findUnique }, passwordResetToken: { create } },
        },
        { provide: AttachmentsService, useValue: {} },
        // Stands in for the queue the module registers. The real one brings a
        // worker with it, and a worker opens a connection to Redis, which
        // these suites are deliberately unable to reach.
        {
          provide: getQueueToken(PASSWORD_RESET_MAIL_QUEUE),
          useValue: { add },
        },
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    findUnique.mockReset();
    create.mockReset();
    create.mockResolvedValue(undefined);
    add.mockReset();
    add.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function requestReset(body: object) {
    return request(app.getHttpServer())
      .post('/api/users/password-reset')
      .send(body);
  }

  it('answers 202 and hands the mail to the queue rather than sending it', async () => {
    findUnique.mockResolvedValue(account);

    const response = await requestReset({
      user: { email: 'Jake@Example.com' },
    })
      .expect(202)
      .expect('Cache-Control', 'no-store');

    expect(response.body).toEqual({});
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'jake@example.com' },
    });
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('stores only a digest, from which the mailed token cannot be read back', async () => {
    findUnique.mockResolvedValue(account);

    await requestReset({ user: { email: 'jake@example.com' } }).expect(202);

    const { token } = add.mock.calls[0][1];
    const { data } = create.mock.calls[0][0];

    expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.tokenHash).not.toContain(token);
    expect(data.tokenHash).toBe(digestResetToken(token));
    expect(data.userId).toBe(42);
  });

  it('gives the token the lifetime the environment sets', async () => {
    findUnique.mockResolvedValue(account);

    await requestReset({ user: { email: 'jake@example.com' } }).expect(202);

    const { data } = create.mock.calls[0][0];
    expect(data.expiresAt).toEqual(
      new Date(Date.now() + lifetimeSeconds * 1000),
    );
  });

  it('answers an address with no account exactly as one with an account', async () => {
    findUnique.mockResolvedValue(account);
    const known = await requestReset({
      user: { email: 'jake@example.com' },
    }).expect(202);

    findUnique.mockResolvedValue(null);
    const unknown = await requestReset({
      user: { email: 'nobody@example.com' },
    }).expect(202);

    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    expect(unknown.text).toBe(known.text);
  });

  it('writes nothing and sends nothing when no account holds the address', async () => {
    findUnique.mockResolvedValue(null);

    await requestReset({ user: { email: 'nobody@example.com' } }).expect(202);

    expect(create).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  it('answers the same when the queue refuses the job', async () => {
    findUnique.mockResolvedValue(account);
    const known = await requestReset({
      user: { email: 'jake@example.com' },
    }).expect(202);

    // What a queue whose connection is closed to offline commands raises.
    add.mockRejectedValueOnce(new Error("Stream isn't writeable"));
    const refused = await requestReset({
      user: { email: 'jake@example.com' },
    }).expect(202);

    // Answering differently here would answer only on the branch that found an
    // account, which is the difference this endpoint exists not to report.
    expect(refused.status).toBe(known.status);
    expect(refused.body).toEqual(known.body);
  });

  it('answers 422 keyed by field when the address is missing or malformed', async () => {
    const missing = await requestReset({ user: {} }).expect(422);
    expect(missing.body).toEqual({ errors: { email: ["can't be blank"] } });

    const malformed = await requestReset({
      user: { email: 'not-an-address' },
    }).expect(422);
    expect(malformed.body).toEqual({ errors: { email: ['is invalid'] } });

    expect(findUnique).not.toHaveBeenCalled();
  });
});
