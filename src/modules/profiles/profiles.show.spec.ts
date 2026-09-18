import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
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

import { CommonModule } from '../../common/common.module.js';
import { validate } from '../../config/env.validation.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';

import { ProfilesModule } from './profiles.module.js';

const storedUser = {
  id: 42,
  email: 'jake@example.com',
  username: 'jake',
  bio: 'writes things',
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('GET /api/profiles/:username', () => {
  let app: INestApplication;
  const findUnique = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate }),
        CommonModule,
        PrismaModule,
        // No AuthModule: the route carries no guard, so no strategy is needed.
        ProfilesModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique } })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('/api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findUnique.mockReset();
  });

  function read(username: string) {
    return request(app.getHttpServer()).get(`/api/profiles/${username}`);
  }

  it('answers 200 with the public fields, looked up by username', async () => {
    findUnique.mockResolvedValue(storedUser);

    const response = await read('jake').expect(200);

    expect(response.body).toEqual({
      profile: { username: 'jake', bio: 'writes things', image: null },
    });
    expect(findUnique).toHaveBeenCalledWith({ where: { username: 'jake' } });
  });

  it('keeps the account fields out of a public response', async () => {
    findUnique.mockResolvedValue(storedUser);

    const { profile } = (await read('jake').expect(200)).body as {
      profile: Record<string, unknown>;
    };

    expect(profile).not.toHaveProperty('email');
    expect(profile).not.toHaveProperty('token');
    expect(profile).not.toHaveProperty('id');
  });

  it('answers 404 for a username nobody holds', async () => {
    findUnique.mockResolvedValue(null);

    const response = await read('nobody').expect(404);

    expect(response.body).toEqual({ errors: { profile: ['not found'] } });
  });

  // The route is public, so a token it cannot read must not change the answer.
  it('answers 200 to a reader with no token or a broken one', async () => {
    findUnique.mockResolvedValue(storedUser);

    await read('jake').expect(200);
    await read('jake').set('Authorization', 'Token not-a-token').expect(200);
  });
});
