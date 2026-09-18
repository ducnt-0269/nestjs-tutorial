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
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';

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

const storedComments = [
  {
    id: 1,
    body: 'First comment',
    articleId: 7,
    authorId: 1,
    createdAt: new Date('2026-09-17T08:00:00Z'),
    updatedAt: new Date('2026-09-17T08:00:00Z'),
    author: {
      id: 1,
      email: 'alice@example.com',
      username: 'alice',
      bio: null,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
  {
    id: 2,
    body: 'Second comment',
    articleId: 7,
    authorId: 2,
    createdAt: new Date('2026-09-17T09:00:00Z'),
    updatedAt: new Date('2026-09-17T09:00:00Z'),
    author: {
      id: 2,
      email: 'bob@example.com',
      username: 'bob',
      bio: 'a writer',
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
];

describe('GET /api/articles/:slug/comments', () => {
  let app: INestApplication;
  const findUnique = vi.fn();
  const findMany = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        CommonModule,
        PrismaModule,
        CommentsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        article: { findUnique },
        comment: { findMany },
      })
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
    findUnique.mockResolvedValue(storedArticle);
    findMany.mockReset();
    findMany.mockResolvedValue(storedComments);
  });

  function read(slug: string) {
    return request(app.getHttpServer()).get(`/api/articles/${slug}/comments`);
  }

  it('returns 200 with comments in the order Prisma returned them', async () => {
    const response = await read(slug).expect(200);

    expect(response.body).toHaveProperty('comments');
    expect(response.body.comments).toHaveLength(2);
    expect(response.body.comments[0].id).toBe(1);
    expect(response.body.comments[1].id).toBe(2);
  });

  it('calls findMany with orderBy createdAt ascending and where articleId', async () => {
    await read(slug).expect(200);

    expect(findMany).toHaveBeenCalledWith({
      where: { articleId: 7 },
      orderBy: { createdAt: 'asc' },
      include: { author: true },
    });
  });

  it('returns an empty array when the article has no comments', async () => {
    findMany.mockResolvedValue([]);

    const response = await read(slug).expect(200);

    expect(response.body).toHaveProperty('comments');
    expect(response.body.comments).toEqual([]);
  });

  it('does not require a token', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/articles/${slug}/comments`)
      .expect(200);

    expect(response.body.comments).toHaveLength(2);
    // Public data, so the response carries no no-store the way an account
    // response does: there is nothing here that belongs to the reader.
    expect(response.headers['cache-control']).toBeUndefined();
  });

  it('answers 404 when the article does not exist', async () => {
    findUnique.mockResolvedValue(null);

    await read('no-such-article').expect(404, {
      errors: { article: ['not found'] },
    });
  });
});
