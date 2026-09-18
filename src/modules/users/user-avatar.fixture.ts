import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, vi } from 'vitest';

import { CommonModule } from '../../common/common.module.js';
import { validate } from '../../config/env.validation.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { S3_CLIENT } from '../attachments/attachments.constants.js';
import { AuthModule } from '../auth/auth.module.js';
import { TokenRevocationService } from '../auth/token-revocation.service.js';

import { UsersModule } from './users.module.js';

export const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
export const storedUser = {
  id: 42,
  email: 'jake@example.com',
  username: 'jake',
  bio: null,
  image: 'http://storage.invalid:9000/bucket/users/42/new.png',
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * The application, the mocks and the request helpers that both upload suites
 * need, kept in one place because the two were identical for their first
 * hundred lines. Registers its own lifecycle hooks, so a suite declares one
 * call and then only the cases that differ between them.
 */
export function useAvatarHarness() {
  let app: INestApplication;
  let jwt: JwtService;

  const send = vi.fn();
  const update = vi.fn();
  const findMany = vi.fn();
  const deleteMany = vi.fn();
  const create = vi.fn();
  const transaction = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate }),
        CommonModule,
        PrismaModule,
        // Registers the strategy; the route itself belongs to users.
        AuthModule,
        UsersModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ $transaction: transaction })
      .overrideProvider(TokenRevocationService)
      .useValue({ isRevoked: () => Promise.resolve(false) })
      .overrideProvider(S3_CLIENT)
      .useValue({ send })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('/api');
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    for (const mock of [send, update, findMany, deleteMany, create]) {
      mock.mockReset();
    }
    send.mockResolvedValue({});
    update.mockResolvedValue(storedUser);
    findMany.mockResolvedValue([]);
    deleteMany.mockResolvedValue({ count: 0 });
    create.mockResolvedValue({});
    // The callback form, and the client it hands over carries both models.
    transaction.mockReset();
    transaction.mockImplementation((run: (tx: unknown) => Promise<unknown>) =>
      run({
        user: { update },
        attachment: { findMany, deleteMany, create },
      }),
    );
  });

  return {
    mocks: { send, update, findMany, deleteMany, create, transaction },

    // Arrow properties so that a suite can destructure them without the
    // unbound-method warning a shorthand method would raise.
    upload: (
      body: Buffer | null,
      contentType = 'image/png',
      token: string | null = jwt.sign({ sub: '42' }),
    ) => {
      const call = request(app.getHttpServer()).post('/api/user/image');
      if (token) call.set('Authorization', `Token ${token}`);
      return body
        ? call.attach('image', body, { filename: 'avatar.png', contentType })
        : call;
    },

    commandsSent: (): string[] =>
      send.mock.calls.map(
        (call: unknown[]) => (call[0] as object).constructor.name,
      ),
  };
}
