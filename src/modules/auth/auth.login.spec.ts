import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hashSync } from 'bcrypt';
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
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthModule } from './auth.module.js';
import { TokenRevocationService } from './token-revocation.service.js';

const secret = 'test-secret-'.padEnd(32, 'x');
const password = 'secret123';
const storedUser = {
  id: 42,
  email: 'jake@example.com',
  username: 'jake',
  password: hashSync(password, 10),
  bio: null,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const invalid = { errors: { credentials: ['invalid'] } };

describe('POST /api/users/login', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const findUnique = vi.fn();

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
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique } })
      // Redis stays out of these suites; nothing here exercises revocation.
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
    findUnique.mockReset();
  });

  function signIn(body: object) {
    return request(app.getHttpServer()).post('/api/users/login').send(body);
  }

  it('answers 200 with the user envelope and a token that verifies', async () => {
    findUnique.mockResolvedValue(storedUser);

    const response = await signIn({
      user: { email: 'Jake@Example.com', password },
    })
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(response.body).toEqual({
      user: {
        email: 'jake@example.com',
        username: 'jake',
        bio: null,
        image: null,
        token: expect.any(String),
      },
    });
    expect(jwt.verify<{ sub: string }>(response.body.user.token).sub).toBe(
      '42',
    );
  });

  it('mints a different token for each sign-in of the same account', async () => {
    findUnique.mockResolvedValue(storedUser);
    const credentials = { user: { email: 'jake@example.com', password } };

    const first = await signIn(credentials).expect(200);
    const second = await signIn(credentials).expect(200);

    // Both sign-ins land in the same second, so only something unique to each
    // token keeps revoking one of them from ending the other.
    expect(first.body.user.token).not.toBe(second.body.user.token);
  });

  it('looks the account up by lower-cased email and opts into the hash', async () => {
    findUnique.mockResolvedValue(storedUser);

    await signIn({ user: { email: 'Jake@Example.com', password } });

    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'jake@example.com' },
      omit: { password: false },
    });
  });

  it('answers a wrong password and an unknown email identically', async () => {
    findUnique.mockResolvedValue(storedUser);
    const wrongPassword = await signIn({
      user: { email: 'jake@example.com', password: 'not the password' },
    }).expect(401);

    findUnique.mockResolvedValue(null);
    const unknownEmail = await signIn({
      user: { email: 'nobody@example.com', password },
    }).expect(401);

    expect(wrongPassword.body).toEqual(invalid);
    expect(unknownEmail.body).toEqual(invalid);
  });

  it('still runs a bcrypt comparison when no account matches', async () => {
    findUnique.mockResolvedValue(null);

    const started = performance.now();
    await signIn({ user: { email: 'nobody@example.com', password } }).expect(
      401,
    );

    // A comparison at cost 10 takes tens of milliseconds; returning early
    // would answer in about one. The bound sits low so it cannot flake.
    expect(performance.now() - started).toBeGreaterThan(10);
  });

  it('answers 422 keyed by field when the body is invalid', async () => {
    const response = await signIn({ user: {} }).expect(422);

    expect(response.body).toEqual({
      errors: { email: ["can't be blank"], password: ["can't be blank"] },
    });
    expect(findUnique).not.toHaveBeenCalled();
  });
});
