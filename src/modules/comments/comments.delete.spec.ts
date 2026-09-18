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

import { CommentsModule } from './comments.module.js';

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
  // The article is read through the articles service, which includes them.
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

const storedComment = {
  id: 1,
  body: 'A comment',
  articleId: 7,
  authorId: 42,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('DELETE /api/articles/:slug/comments/:id', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const findUnique = vi.fn();
  const findFirst = vi.fn();
  const deleteMany = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate }),
        CommonModule,
        PrismaModule,
        AuthModule,
        CommentsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        article: { findUnique },
        comment: { findFirst, deleteMany },
      })
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
    findFirst.mockReset();
    findFirst.mockResolvedValue(storedComment);
    deleteMany.mockReset();
    deleteMany.mockResolvedValue({ count: 1 });
  });

  function destroy(id = '1', token = jwt.sign({ sub: '42' })) {
    return request(app.getHttpServer())
      .delete(`/api/articles/${slug}/comments/${id}`)
      .set('Authorization', `Token ${token}`);
  }

  it('deletes the comment and returns 200 with an empty object', async () => {
    const response = await destroy().expect(200);

    expect(response.body).toEqual({});
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("answers 403 when deleting someone else's comment", async () => {
    await destroy('1', jwt.sign({ sub: '99' })).expect(403, {
      errors: { comment: ['forbidden'] },
    });

    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('answers 404 when the comment does not exist', async () => {
    findFirst.mockResolvedValue(null);

    await destroy().expect(404, { errors: { comment: ['not found'] } });

    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('checks both id and articleId when finding the comment', async () => {
    await destroy().expect(200);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 1, articleId: 7 },
    });
  });

  it('checks the article first and answers 404 before querying comments', async () => {
    findUnique.mockResolvedValue(null);

    await destroy().expect(404, { errors: { article: ['not found'] } });

    expect(findFirst).not.toHaveBeenCalled();
  });

  it('answers 404 for a non-numeric comment id', async () => {
    await destroy('abc').expect(404, { errors: { comment: ['not found'] } });

    expect(findFirst).not.toHaveBeenCalled();
  });

  it('answers 404 for a comment id above INT4 maximum', async () => {
    await destroy('2147483648').expect(404, {
      errors: { comment: ['not found'] },
    });

    expect(findFirst).not.toHaveBeenCalled();
  });

  it('still answers 200 when a concurrent delete removed the comment', async () => {
    deleteMany.mockResolvedValue({ count: 0 });

    const response = await destroy().expect(200);

    expect(response.body).toEqual({});
  });

  it('answers 401 when no token is provided', async () => {
    await request(app.getHttpServer())
      .delete(`/api/articles/${slug}/comments/1`)
      .expect(401, { errors: { token: ['is invalid'] } });

    expect(findFirst).not.toHaveBeenCalled();
  });
});
