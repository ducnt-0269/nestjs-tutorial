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

import { ArticlesModule } from './articles.module.js';

const author = {
  id: 42,
  email: 'jake@example.com',
  username: 'jake',
  bio: null,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// The rows the list query returns carry no body: it is omitted in the database
// query, not dropped on the way out.
const storedArticle = (id: number, publishedAt: string) => ({
  id,
  slug: `article-${id}-a3f91c7d`,
  title: `Article ${id}`,
  description: `Description ${id}`,
  authorId: 42,
  createdAt: new Date(publishedAt),
  updatedAt: new Date(publishedAt),
  author,
});

// Newest first, the order the endpoint is expected to hand them back in.
const storedArticles = [
  storedArticle(2, '2026-09-16T09:00:00Z'),
  storedArticle(1, '2026-09-16T08:00:00Z'),
];

describe('GET /api/articles', () => {
  let app: INestApplication;
  const findMany = vi.fn();
  const count = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate }),
        CommonModule,
        PrismaModule,
        ArticlesModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ article: { findMany, count } })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('/api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue(storedArticles);
    count.mockReset();
    count.mockResolvedValue(storedArticles.length);
  });

  function list(query = '') {
    return request(app.getHttpServer()).get(`/api/articles${query}`);
  }

  it('returns 200 with the articles and the count', async () => {
    const response = await list().expect(200);

    expect(response.body.articles).toHaveLength(2);
    expect(response.body.articlesCount).toBe(2);
    expect(response.body.articles[0].slug).toBe('article-2-a3f91c7d');
  });

  it('reads the most recent first, with the id breaking ties', async () => {
    await list().expect(200);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  // A page of 20 from the start, and either half of that overridable on its own.
  it.each([
    ['nothing', '', 20, 0],
    ['both', '?limit=5&offset=10', 5, 10],
    ['a limit alone', '?limit=5', 5, 0],
    ['an offset alone', '?offset=10', 20, 10],
  ])('pages with %s', async (_name, query, take, skip) => {
    await list(query).expect(200);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take, skip }),
    );
  });

  it('filters on the author username, in the page and in the count alike', async () => {
    await list('?author=jake').expect(200);

    const where = { author: { username: 'jake' } };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('leaves the body out of the listed articles', async () => {
    const response = await list().expect(200);

    for (const article of response.body.articles) {
      expect(article).not.toHaveProperty('body');
    }
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ omit: { body: true } }),
    );
  });

  it('answers an empty list rather than an error when nothing matches', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const response = await list('?author=nobody').expect(200);

    expect(response.body).toEqual({ articles: [], articlesCount: 0 });
  });

  it('counts every matching article, not the ones on this page', async () => {
    count.mockResolvedValue(37);

    const response = await list('?limit=2').expect(200);

    expect(response.body.articles).toHaveLength(2);
    expect(response.body.articlesCount).toBe(37);
  });

  // Two of these are worth naming. A limit past the 32-bit bound wraps in the
  // driver and answers with the wrong page in silence -- 2^32 comes back empty,
  // 2^32 + 1 with a single article. And a parameter repeated in the query string
  // arrives as an array, not as the text the rule is written for.
  it.each([
    ['?limit=abc', 'limit'],
    ['?limit=-5', 'limit'],
    ['?limit=1.5', 'limit'],
    ['?limit=101', 'limit'],
    ['?limit=4294967296', 'limit'],
    ['?offset=-1', 'offset'],
    ['?author=jake&author=alice', 'author'],
  ])('refuses %s', async (query, field) => {
    await list(query).expect(422, { errors: { [field]: ['is invalid'] } });

    // Nothing invalid reaches the database.
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });

  it('does not require a token', async () => {
    const response = await list().expect(200);

    expect(response.body.articles).toHaveLength(2);
    // Public data, so the response carries no no-store the way an account
    // response does: there is nothing here that belongs to the reader.
    expect(response.headers['cache-control']).toBeUndefined();
  });
});
