import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
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
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { TokenRevocationService } from '../auth/token-revocation.service.js';

import { UsersModule } from './users.module.js';

const secret = 'test-secret-'.padEnd(32, 'x');

// Shape copied from a real duplicate insert through adapter-pg.
function uniqueViolation(index: string): Error {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.0',
    meta: {
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: { constraint: { index }, table: 'users' },
      },
    },
  });
}

describe('PUT /api/user rejections', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const update = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: secret, JWT_TTL_SECONDS: 3600 })],
        }),
        CommonModule,
        PrismaModule,
        AuthModule,
        UsersModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { update } })
      .overrideProvider(TokenRevocationService)
      .useValue({ isRevoked: () => Promise.resolve(false) })
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
    update.mockReset();
  });

  function write(body: object, token?: string) {
    const pending = request(app.getHttpServer()).put('/api/user').send(body);
    return token === undefined
      ? pending
      : pending.set('Authorization', `Token ${token}`);
  }

  it('answers 401 while signed out, without touching the database', async () => {
    const response = await write({ user: { bio: 'hi' } }).expect(401);

    expect(response.body).toEqual({ errors: { token: ['is invalid'] } });
    expect(update).not.toHaveBeenCalled();
  });

  it('answers 409 for an email another account already holds', async () => {
    update.mockRejectedValue(uniqueViolation('users_email_key'));

    const response = await write(
      { user: { email: 'taken@example.com' } },
      jwt.sign({ sub: '42' }),
    ).expect(409);

    expect(response.body).toEqual({
      errors: { email: ['has already been taken'] },
    });
  });

  it('answers 409 for a username another account already holds', async () => {
    update.mockRejectedValue(uniqueViolation('users_username_key'));

    const response = await write(
      { user: { username: 'taken' } },
      jwt.sign({ sub: '42' }),
    ).expect(409);

    expect(response.body).toEqual({
      errors: { username: ['has already been taken'] },
    });
  });

  it('answers 422 to a field that breaks the registration rules', async () => {
    const response = await write(
      { user: { email: 'not-an-email', password: 'short' } },
      jwt.sign({ sub: '42' }),
    ).expect(422);

    expect(response.body).toEqual({
      errors: {
        email: ['is invalid'],
        password: ['must be at least 8 characters long'],
      },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('answers 422 to a username that is blank once trimmed', async () => {
    const response = await write(
      { user: { username: '   ' } },
      jwt.sign({ sub: '42' }),
    ).expect(422);

    expect(response.body).toEqual({
      errors: { username: ["can't be blank"] },
    });
    expect(update).not.toHaveBeenCalled();
  });
});
