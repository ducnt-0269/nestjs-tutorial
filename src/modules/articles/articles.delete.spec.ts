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
import { validate } from '../../config/env.validation.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { TokenRevocationService } from '../auth/token-revocation.service.js';

import { ArticlesModule } from './articles.module.js';

const slug = 'how-to-train-your-dragon-a3f91c7d';

const storedArticle = {
  id: 7,
  slug,
  title: 'How to train your dragon',
  description: 'Ever wonder how?',
  body: 'It takes a lot of patience.',
  authorId: 42,
  createdAt: new Date(),
  updatedAt: new Date(),
  tags: [],
  author: {
    id: 42,
    email: 'jake@example.com',
    username: 'jake',
    bio: null,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe('DELETE /api/articles/:slug', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const findUnique = vi.fn();
  const deleteMany = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate }),
        CommonModule,
        PrismaModule,
        AuthModule,
        ArticlesModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ article: { findUnique, deleteMany } })
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
    findUnique.mockResolvedValue(storedArticle);
    deleteMany.mockReset();
    deleteMany.mockResolvedValue({ count: 1 });
  });

  function destroy(token = jwt.sign({ sub: '42' })) {
    return request(app.getHttpServer())
      .delete(`/api/articles/${slug}`)
      .set('Authorization', `Token ${token}`);
  }

  it('deletes the article the caller wrote', async () => {
    const response = await destroy().expect(200);

    expect(response.body).toEqual({});
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it('refuses to delete an article belonging to someone else', async () => {
    await destroy(jwt.sign({ sub: '99' })).expect(403, {
      errors: { article: ['forbidden'] },
    });

    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('answers 404 for a slug that does not exist', async () => {
    findUnique.mockResolvedValue(null);

    await destroy().expect(404, { errors: { article: ['not found'] } });

    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('still answers 200 when a concurrent delete arrived first', async () => {
    deleteMany.mockResolvedValue({ count: 0 });

    await destroy().expect(200, {});
  });

  it('rejects a request without a token', async () => {
    await request(app.getHttpServer())
      .delete(`/api/articles/${slug}`)
      .expect(401, { errors: { token: ['is invalid'] } });

    expect(deleteMany).not.toHaveBeenCalled();
  });
});
