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
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { TokenRevocationService } from '../auth/token-revocation.service.js';
import { UsersModule } from './users.module.js';

const secret = 'test-secret-'.padEnd(32, 'x');
const storedUser = {
  id: 42,
  email: 'jake@example.com',
  username: 'jake',
  bio: null,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PUT /api/user', () => {
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
        // Registers the strategy; the route itself belongs to users.
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
    update.mockResolvedValue(storedUser);
  });

  function write(body: object, token = jwt.sign({ sub: '42' })) {
    return request(app.getHttpServer())
      .put('/api/user')
      .set('Authorization', `Token ${token}`)
      .send(body);
  }

  function dataOf(): Record<string, unknown> {
    const [{ data }] = update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    return data;
  }

  it('leaves every column alone when the body carries no field', async () => {
    for (const body of [{}, { user: {} }]) {
      update.mockClear();
      await write(body).expect(200);

      expect(update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { password: undefined },
      });
    }
  });

  it('sends only the field that was given, leaving the rest undefined', async () => {
    await write({ user: { bio: 'hi' } }).expect(200);

    const data = dataOf();
    expect(data.bio).toBe('hi');
    expect(data.username).toBeUndefined();
    expect(data.email).toBeUndefined();
    expect(data.image).toBeUndefined();
  });

  it('clears a field the body sets to null', async () => {
    await write({ user: { bio: null } }).expect(200);

    expect(dataOf().bio).toBeNull();
  });

  it('hashes a new password rather than storing what was sent', async () => {
    await write({ user: { password: 'newsecret1' } }).expect(200);

    const password = dataOf().password as string;
    expect(password).not.toBe('newsecret1');
    expect(await compare('newsecret1', password)).toBe(true);
  });

  it('lower-cases a new email, as registration does', async () => {
    await write({ user: { email: 'Jake@Example.com' } }).expect(200);

    expect(dataOf().email).toBe('jake@example.com');
  });

  it('answers with the presented token, not a new one', async () => {
    const token = jwt.sign({ sub: '42' });

    const response = await write({ user: { bio: null } }, token)
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(response.body).toEqual({
      user: {
        email: 'jake@example.com',
        username: 'jake',
        bio: null,
        image: null,
        token,
      },
    });
  });
});
