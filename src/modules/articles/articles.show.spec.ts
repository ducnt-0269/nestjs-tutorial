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

import { ArticlesModule } from './articles.module.js';

const storedArticle = {
  id: 7,
  slug: 'how-to-train-your-dragon-a3f91c7d',
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
    bio: 'writes things',
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe('GET /api/articles/:slug', () => {
  let app: INestApplication;
  const findUnique = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        CommonModule,
        PrismaModule,
        // No AuthModule: the route carries no guard, so no strategy is needed.
        ArticlesModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ article: { findUnique } })
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
  });

  function read(slug: string) {
    return request(app.getHttpServer()).get(`/api/articles/${slug}`);
  }

  it('answers a reader who sent no token', async () => {
    const response = await read(storedArticle.slug).expect(200);

    expect(response.body.article.slug).toBe(storedArticle.slug);
    expect(response.body.article.author).toEqual({
      username: 'jake',
      bio: 'writes things',
      image: null,
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { slug: storedArticle.slug },
      include: { author: true },
    });
  });

  it('leaves the answer cacheable', async () => {
    const response = await read(storedArticle.slug).expect(200);

    expect(response.headers['cache-control']).toBeUndefined();
  });

  it('answers 404 for a slug that does not exist', async () => {
    findUnique.mockResolvedValue(null);

    await read('no-such-article').expect(404, {
      errors: { article: ['not found'] },
    });
  });
});
