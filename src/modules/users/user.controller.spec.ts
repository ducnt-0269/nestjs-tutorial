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
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
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

describe('GET /api/user', () => {
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
        // The strategy that verifies the token is registered by auth; the route
        // itself belongs here.
        AuthModule,
        UsersModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique } })
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

  function read(token?: string) {
    const pending = request(app.getHttpServer()).get('/api/user');
    return token === undefined
      ? pending
      : pending.set('Authorization', `Token ${token}`);
  }

  it('answers 200 with the account behind the token', async () => {
    findUnique.mockResolvedValue(storedUser);
    const token = jwt.sign({ sub: '42' });

    const response = await read(token).expect(200);

    expect(response.body).toEqual({
      user: {
        email: 'jake@example.com',
        username: 'jake',
        bio: null,
        image: null,
        // The token the client presented, not a freshly minted one.
        token,
      },
    });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 42 } });
  });

  // The three rejections below are read out of passport's info argument, so
  // they also pin the library's wording in place.
  it('answers 401 when the header is absent', async () => {
    const response = await read().expect(401);

    expect(response.body).toEqual({ errors: { token: ['is missing'] } });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('answers 401 when the token is not a JWT this server signed', async () => {
    const response = await read('not-a-token').expect(401);

    expect(response.body).toEqual({ errors: { token: ['is invalid'] } });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('answers 401 when the token has expired', async () => {
    const expired = jwt.sign({ sub: '42' }, { expiresIn: '-1s' });

    const response = await read(expired).expect(401);

    expect(response.body).toEqual({ errors: { token: ['has expired'] } });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('accepts the scheme in any case, as HTTP defines it', async () => {
    findUnique.mockResolvedValue(storedUser);

    await request(app.getHttpServer())
      .get('/api/user')
      .set('Authorization', `token ${jwt.sign({ sub: '42' })}`)
      .expect(200);
  });
});
