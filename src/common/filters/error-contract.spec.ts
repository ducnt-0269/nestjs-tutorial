import 'reflect-metadata';
import { type INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { Prisma } from '../../generated/prisma/client.js';
import { CommonModule } from '../common.module.js';
import { AuthModule } from '../../modules/auth/auth.module.js';
import { TokenRevocationService } from '../../modules/auth/token-revocation.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ProfilesModule } from '../../modules/profiles/profiles.module.js';
import { UsersModule } from '../../modules/users/users.module.js';

const secret = 'test-secret-'.padEnd(32, 'x');

// adapter-pg reports the violated index instead of the target field.
function uniqueViolation(): Error {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.0',
    meta: {
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: { constraint: { index: 'users_email_key' }, table: 'users' },
      },
    },
  });
}

describe('error contract', () => {
  let app: INestApplication;
  const create = vi.fn();
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
        UsersModule,
        ProfilesModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { create, findUnique } })
      .overrideProvider(TokenRevocationService)
      .useValue({ isRevoked: () => Promise.resolve(false) })
      .overrideProvider(Logger)
      .useValue({ error: vi.fn(), log: vi.fn(), warn: vi.fn() })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('/api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    create.mockReset();
    findUnique.mockReset();
  });

  function expectEnvelope(body: unknown): Record<string, string[]> {
    expect(Object.keys(body as object)).toEqual(['errors']);
    const errors = (body as { errors: Record<string, string[]> }).errors;
    for (const messages of Object.values(errors)) {
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);
      for (const message of messages) expect(message.trim()).not.toBe('');
    }
    return errors;
  }

  const register = (body: object) =>
    request(app.getHttpServer()).post('/api/users').send(body);

  it('names the root key when the body carries none', async () => {
    const response = await register({}).expect(422);

    expect(expectEnvelope(response.body)).toEqual({ user: ["can't be blank"] });
  });

  it('names every field that failed validation', async () => {
    const response = await register({
      user: { username: 'jake', email: 'not-an-email', password: 'short' },
    }).expect(422);

    const errors = expectEnvelope(response.body);
    expect(errors.email).toEqual(['is invalid']);
    expect(errors.password).toEqual(['must be at least 8 characters long']);
  });

  it('names the duplicated column on a unique violation', async () => {
    create.mockRejectedValue(uniqueViolation());

    const response = await register({
      user: {
        username: 'jake',
        email: 'jake@example.com',
        password: 'secret123',
      },
    }).expect(409);

    expect(expectEnvelope(response.body)).toEqual({
      email: ['has already been taken'],
    });
  });

  it('refuses a sign-in without naming which half was wrong', async () => {
    findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/api/users/login')
      .send({ user: { email: 'jake@example.com', password: 'secret123' } })
      .expect(401);

    expect(expectEnvelope(response.body)).toEqual({
      credentials: ['are invalid'],
    });
  });

  it('refuses a guarded route without a token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/user')
      .expect(401);

    expect(expectEnvelope(response.body)).toEqual({ token: ['is invalid'] });
  });

  it('answers a missing resource with the resource name', async () => {
    findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .get('/api/profiles/ghost')
      .expect(404);

    expect(expectEnvelope(response.body)).toEqual({ profile: ['not found'] });
  });
});
