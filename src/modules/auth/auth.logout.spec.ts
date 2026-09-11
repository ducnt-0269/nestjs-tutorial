import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { type INestApplication, Logger } from '@nestjs/common';
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
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { REDIS_CLIENT } from '../../redis/redis.constants.js';
import { RedisModule } from '../../redis/redis.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthModule } from './auth.module.js';

const secret = 'test-secret-'.padEnd(32, 'x');
const ttlSeconds = 3600;

const storedUser = {
  id: 42,
  email: 'jake@example.com',
  username: 'jake',
  bio: null,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const invalidToken = { errors: { token: ['is invalid'] } };

describe('POST /api/users/logout', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const findUnique = vi.fn();

  // Stands in for Redis. Entries have to survive from one request to the next,
  // so a constant answer would leave the tests below proving nothing.
  const blacklist = new Set<string>();
  const set = vi.fn<
    (key: string, value: string, mode: 'EX', ttl: number) => Promise<'OK'>
  >((key) => {
    blacklist.add(key);
    return Promise.resolve('OK');
  });
  const exists = vi.fn<(key: string) => Promise<number>>((key) =>
    Promise.resolve(blacklist.has(key) ? 1 : 0),
  );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: secret, JWT_TTL_SECONDS: ttlSeconds })],
        }),
        CommonModule,
        PrismaModule,
        RedisModule,
        AuthModule,
        UsersModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique } })
      // Only the wire is faked: the revocation service, the strategy and the
      // guard are the real ones.
      .overrideProvider(REDIS_CLIENT)
      .useValue({
        set,
        exists,
        quit: () => Promise.resolve('OK'),
        disconnect: () => undefined,
      })
      // Keeps the deliberate failure below from printing a stack trace.
      .overrideProvider(Logger)
      .useValue({ error: vi.fn(), log: vi.fn(), warn: vi.fn() })
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
    blacklist.clear();
    set.mockClear();
    exists.mockClear();
    findUnique.mockReset();
    findUnique.mockResolvedValue(storedUser);
  });

  function logout(token?: string) {
    const call = request(app.getHttpServer()).post('/api/users/logout');
    return token ? call.set('Authorization', `Token ${token}`) : call;
  }

  function readAccount(token: string) {
    return request(app.getHttpServer())
      .get('/api/user')
      .set('Authorization', `Token ${token}`);
  }

  it('answers 204 and stores the digest for the time the token has left', async () => {
    const response = await logout(jwt.sign({ sub: '42' }));

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(set).toHaveBeenCalledWith(
      expect.stringMatching(/^revoked:[0-9a-f]{64}$/),
      '1',
      'EX',
      expect.any(Number),
    );

    const [, , , remaining] = set.mock.calls[0];
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(ttlSeconds);
  });

  it('turns the token away from an authenticated endpoint afterwards', async () => {
    const token = jwt.sign({ sub: '42' });
    await logout(token).expect(204);

    const response = await readAccount(token);

    expect(response.status).toBe(401);
    expect(response.body).toEqual(invalidToken);
  });

  it('leaves the other session of the same account signed in', async () => {
    // Minted the way signing in mints them, identifier and all.
    const token = jwt.sign({ sub: '42', jti: randomUUID() });
    const other = jwt.sign({ sub: '42', jti: randomUUID() });

    await logout(token).expect(204);

    await readAccount(other).expect(200);
    await readAccount(token).expect(401);
  });

  it('turns away a request carrying no token and one carrying a broken token', async () => {
    const absent = await logout();
    const malformed = await logout('not-a-token');

    expect(absent.status).toBe(401);
    expect(absent.body).toEqual(invalidToken);
    expect(malformed.status).toBe(401);
    expect(malformed.body).toEqual(invalidToken);
    expect(set).not.toHaveBeenCalled();
  });

  it('turns away a second logout carrying the token it just revoked', async () => {
    const token = jwt.sign({ sub: '42' });
    await logout(token).expect(204);

    await logout(token).expect(401);
  });

  it('rejects an authenticated request while the blacklist is unreachable', async () => {
    exists.mockRejectedValueOnce(new Error("Stream isn't writeable"));

    const response = await readAccount(jwt.sign({ sub: '42' }));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ errors: { server: ['internal error'] } });
  });
});
