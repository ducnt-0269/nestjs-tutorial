import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { compare } from 'bcrypt';
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
import { AuthModule } from './auth.module.js';

const secret = 'test-secret-'.padEnd(32, 'x');
const validBody = {
  user: { username: 'jake', email: 'Jake@Example.com', password: 'secret123' },
};
// Carries a hash on purpose: the response schema, not the fixture, is what
// must keep it out of the body.
const storedUser = {
  id: 42,
  email: 'jake@example.com',
  username: 'jake',
  password: '$2b$10$' + 'x'.repeat(53),
  bio: null,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

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

describe('POST /api/users', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const create = vi.fn();

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
      .useValue({ user: { create } })
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
    create.mockReset();
  });

  it('answers 201 with the user envelope and a token that verifies', async () => {
    create.mockResolvedValue(storedUser);

    const response = await request(app.getHttpServer())
      .post('/api/users')
      .send(validBody)
      .expect(201)
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

  it('stores a lower-cased email and a bcrypt hash, never the password', async () => {
    create.mockResolvedValue(storedUser);

    await request(app.getHttpServer()).post('/api/users').send(validBody);

    const [{ data }] = create.mock.calls[0] as [
      { data: { email: string; username: string; password: string } },
    ];
    expect(data.email).toBe('jake@example.com');
    expect(data.username).toBe('jake');
    expect(data.password).not.toBe('secret123');
    expect(await compare('secret123', data.password)).toBe(true);
  });

  it('answers 422 keyed by field when the body is invalid', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/users')
      .send({ user: { email: 'not-an-email', password: 'short' } })
      .expect(422);

    expect(response.body).toEqual({
      errors: {
        username: ["can't be blank"],
        email: ['is invalid'],
        password: ['must be at least 8 characters long'],
      },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a password bcrypt would silently truncate', async () => {
    // 37 characters but 73 bytes: 'é' is two bytes in UTF-8.
    for (const password of ['x'.repeat(73), 'é'.repeat(36) + 'x']) {
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send({ user: { ...validBody.user, password } })
        .expect(422);

      expect(response.body).toEqual({
        errors: { password: ['must be at most 72 bytes long'] },
      });
    }
  });

  it('reports a missing email as blank rather than invalid', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/users')
      .send({ user: { username: 'jake', password: 'secret123' } })
      .expect(422);

    expect(response.body).toEqual({ errors: { email: ["can't be blank"] } });
  });

  it('answers 409 keyed by the taken field', async () => {
    create.mockRejectedValue(uniqueViolation('users_email_key'));

    const response = await request(app.getHttpServer())
      .post('/api/users')
      .send(validBody)
      .expect(409);

    expect(response.body).toEqual({
      errors: { email: ['has already been taken'] },
    });
  });
});
