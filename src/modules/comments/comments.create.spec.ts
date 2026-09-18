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
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { TokenRevocationService } from '../auth/token-revocation.service.js';

import { CommentsModule } from './comments.module.js';

// Shape Prisma raises when a write points at a row another table no longer has.
function articleGone(): Error {
  return new Prisma.PrismaClientKnownRequestError('Foreign key constraint', {
    code: 'P2003',
    clientVersion: '7.10.0',
  });
}

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

const authorUser = {
  id: 42,
  email: 'jake@example.com',
  username: 'jake',
  bio: null,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('POST /api/articles/:slug/comments', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const findUnique = vi.fn();
  const create = vi.fn();

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
        comment: { create },
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
    create.mockReset();
    create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 1,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        author: authorUser,
      }),
    );
  });

  function post(body: object, token = jwt.sign({ sub: '42' })) {
    return request(app.getHttpServer())
      .post(`/api/articles/${slug}/comments`)
      .set('Authorization', `Token ${token}`)
      .send(body);
  }

  it('returns a 201 response with the comment', async () => {
    const response = await post({
      comment: { body: 'It takes a Jacobian.' },
    }).expect(201);

    expect(response.body).toHaveProperty('comment');
    expect(response.body.comment).toHaveProperty('id');
    expect(response.body.comment).toHaveProperty(
      'body',
      'It takes a Jacobian.',
    );
    expect(response.body.comment).toHaveProperty('createdAt');
    expect(response.body.comment).toHaveProperty('updatedAt');
    expect(response.body.comment).toHaveProperty('author');
  });

  it('does not expose articleId, authorId, email, or password in the response', async () => {
    const response = await post({
      comment: { body: 'It takes a Jacobian.' },
    }).expect(201);

    expect(response.body.comment).not.toHaveProperty('articleId');
    expect(response.body.comment).not.toHaveProperty('authorId');
    expect(response.body.comment.author).not.toHaveProperty('email');
    expect(response.body.comment.author).not.toHaveProperty('password');
  });

  it('formats timestamps with milliseconds', async () => {
    const response = await post({
      comment: { body: 'It takes a Jacobian.' },
    }).expect(201);

    expect(response.body.comment.createdAt).toMatch(/\.\d{3}Z$/);
    expect(response.body.comment.updatedAt).toMatch(/\.\d{3}Z$/);
  });

  it('takes the authorId from the token, never from the body', async () => {
    await post({
      comment: { body: 'test', authorId: 99 },
    }).expect(201);

    const [call] = create.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(call.data.authorId).toBe(42);
  });

  it('answers 404 when the article does not exist', async () => {
    findUnique.mockResolvedValue(null);

    await post({ comment: { body: 'test' } }).expect(404, {
      errors: { article: ['not found'] },
    });

    expect(create).not.toHaveBeenCalled();
  });

  it('answers 404 when the article is deleted between the read and the write', async () => {
    create.mockRejectedValue(articleGone());

    await post({ comment: { body: 'test' } }).expect(404, {
      errors: { article: ['not found'] },
    });
  });

  it('answers 422 when the body is blank', async () => {
    await post({ comment: { body: '   ' } }).expect(422, {
      errors: { body: ["can't be blank"] },
    });

    expect(create).not.toHaveBeenCalled();
  });

  it('answers 401 when no token is provided', async () => {
    await request(app.getHttpServer())
      .post(`/api/articles/${slug}/comments`)
      .send({ comment: { body: 'test' } })
      .expect(401, { errors: { token: ['is invalid'] } });

    expect(create).not.toHaveBeenCalled();
  });
});
