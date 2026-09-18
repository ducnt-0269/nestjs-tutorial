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

import { ArticlesModule } from './articles.module.js';

// The author row still carries an email; the response schema is what keeps it
// out of the answer, and the assertions below are what prove that.
const storedAuthor = {
  id: 42,
  email: 'jake@example.com',
  username: 'jake',
  bio: null,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Shape adapter-pg raises for a duplicate slug; the filter reads the column
// out of the index name.
function slugTaken(): Error {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.0',
    meta: {
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: {
          constraint: { index: 'articles_slug_key' },
          table: 'articles',
        },
      },
    },
  });
}

const submitted = {
  article: {
    title: 'How to train your dragon',
    description: 'Ever wonder how?',
    body: 'It takes a lot of patience.',
  },
};

// Stands in for the tags table: which id a name is stored under. 'dragons' is
// already there, so a request naming it is the mixed case the spec asks about.
const storedTagIds = new Map([['dragons', 1]]);
let nextTagId = 2;

describe('POST /api/articles', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const create = vi.fn();
  const tagCreateMany = vi.fn();
  const tagFindMany = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate }),
        CommonModule,
        PrismaModule,
        // Registers the strategy; the route itself belongs to articles.
        AuthModule,
        ArticlesModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        article: { create },
        tag: { createMany: tagCreateMany, findMany: tagFindMany },
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
    create.mockReset();
    tagCreateMany.mockReset();
    tagFindMany.mockReset();
    storedTagIds.clear();
    storedTagIds.set('dragons', 1);
    nextTagId = 2;

    // Only a name absent from the table lands a row: what skipDuplicates buys
    // against the unique index, standing in for it here.
    tagCreateMany.mockImplementation(
      ({ data }: { data: { name: string }[] }) => {
        const fresh = data.filter(({ name }) => !storedTagIds.has(name));
        for (const { name } of fresh) storedTagIds.set(name, nextTagId++);

        return Promise.resolve({ count: fresh.length });
      },
    );

    tagFindMany.mockImplementation(
      ({ where }: { where: { name: { in: string[] } } }) =>
        Promise.resolve(
          where.name.in.map((name) => ({ id: storedTagIds.get(name) })),
        ),
    );

    // Echoes what the service asked to store, so the response carries the slug
    // that was really generated rather than one written into the fixture. The
    // tags come back as the join rows the include really returns, not as the
    // nested write that was sent.
    create.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      const { tags, ...article } = data as {
        tags: { create: { tagId: number }[] };
      };
      const nameOf = new Map(
        [...storedTagIds].map(([name, id]) => [id, name] as const),
      );

      return Promise.resolve({
        id: 7,
        ...article,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: tags.create.map(({ tagId }) => ({
          tag: { name: nameOf.get(tagId) },
        })),
        author: storedAuthor,
      });
    });
  });

  function publish(body: object, token = jwt.sign({ sub: '42' })) {
    return request(app.getHttpServer())
      .post('/api/articles')
      .set('Authorization', `Token ${token}`)
      .send(body);
  }

  function dataOf(call = 0): Record<string, unknown> {
    const [{ data }] = create.mock.calls[call] as [
      { data: Record<string, unknown> },
    ];
    return data;
  }

  it('derives the slug from the title', async () => {
    const response = await publish(submitted).expect(201);

    expect(response.body.article.slug).toMatch(
      /^how-to-train-your-dragon-[0-9a-f]{8}$/,
    );
  });

  it('gives two articles under one title two different slugs', async () => {
    await publish(submitted).expect(201);
    await publish(submitted).expect(201);

    expect(dataOf(0).slug).not.toBe(dataOf(1).slug);
  });

  it('tries a second slug when the first one is already taken', async () => {
    // Two writers under one title landing on the same random suffix. The body
    // carries no slug, so there is nothing for the caller to change and a 409
    // would name a field they never sent.
    // The once-rejection runs first; the second call falls back to the echo
    // implementation the suite installs before each test.
    create.mockRejectedValueOnce(slugTaken());

    const response = await publish(submitted).expect(201);

    expect(create).toHaveBeenCalledTimes(2);
    expect(dataOf(0).slug).not.toBe(dataOf(1).slug);
    expect(response.body.article.slug).toBe(dataOf(1).slug);
  });

  it('gives up when the second slug is taken as well', async () => {
    create.mockRejectedValue(slugTaken());

    await publish(submitted).expect(409, {
      errors: { slug: ['has already been taken'] },
    });

    expect(create).toHaveBeenCalledTimes(2);
  });

  it('takes the author from the token, never from the body', async () => {
    await publish({
      article: { ...submitted.article, authorId: 99 },
    }).expect(201);

    expect(dataOf().authorId).toBe(42);
  });

  it('publishes the article fields and nothing else', async () => {
    const response = await publish(submitted).expect(201);

    expect(Object.keys(response.body.article).sort()).toEqual([
      'author',
      'body',
      'createdAt',
      'description',
      'slug',
      'tagList',
      'title',
      'updatedAt',
    ]);
    expect(response.body.article.author).toEqual({
      username: 'jake',
      bio: null,
      image: null,
    });
  });

  it('answers with timestamps carrying milliseconds', async () => {
    const response = await publish(submitted).expect(201);

    expect(response.body.article.createdAt).toMatch(/\.\d{3}Z$/);
    expect(response.body.article.updatedAt).toMatch(/\.\d{3}Z$/);
  });

  it('rejects a request without a token', async () => {
    await request(app.getHttpServer())
      .post('/api/articles')
      .send(submitted)
      .expect(401, { errors: { token: ['is invalid'] } });

    expect(create).not.toHaveBeenCalled();
  });

  it('names the missing root key in the project wording', async () => {
    await publish({}).expect(422, { errors: { article: ["can't be blank"] } });

    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a title that is blank', async () => {
    await publish({
      article: { ...submitted.article, title: '   ' },
    }).expect(422, { errors: { title: ["can't be blank"] } });

    expect(create).not.toHaveBeenCalled();
  });

  it('carries back the tags it was given', async () => {
    const response = await publish({
      article: { ...submitted.article, tagList: ['training', 'dragons'] },
    }).expect(201);

    expect(response.body.article.tagList).toEqual(['dragons', 'training']);
  });

  it('stores one row for a name already taken and one for a new name', async () => {
    await publish({
      article: { ...submitted.article, tagList: ['dragons', 'training'] },
    }).expect(201);

    // Both names are offered; only the absent one is written, and the article
    // connects to the id each name already holds.
    expect(tagCreateMany).toHaveBeenCalledWith({
      data: [{ name: 'dragons' }, { name: 'training' }],
      skipDuplicates: true,
    });
    expect(await tagCreateMany.mock.results[0]?.value).toEqual({ count: 1 });
    expect(dataOf().tags).toEqual({ create: [{ tagId: 1 }, { tagId: 2 }] });
  });

  it('collapses a name repeated inside one request', async () => {
    const response = await publish({
      article: { ...submitted.article, tagList: ['dragons', 'dragons'] },
    }).expect(201);

    expect(tagCreateMany).toHaveBeenCalledWith({
      data: [{ name: 'dragons' }],
      skipDuplicates: true,
    });
    expect(response.body.article.tagList).toEqual(['dragons']);
  });

  it('accepts an empty tagList and answers with an empty list', async () => {
    const response = await publish({
      article: { ...submitted.article, tagList: [] },
    }).expect(201);

    expect(response.body.article.tagList).toEqual([]);
    // No names to settle, so the tags table is never touched.
    expect(tagCreateMany).not.toHaveBeenCalled();
    expect(tagFindMany).not.toHaveBeenCalled();
  });

  it('accepts an article carrying no tagList at all', async () => {
    const response = await publish(submitted).expect(201);

    expect(response.body.article.tagList).toEqual([]);
  });

  it('rejects a tag that is blank', async () => {
    await publish({
      article: { ...submitted.article, tagList: ['   '] },
    }).expect(422, { errors: { tagList: ["can't be blank"] } });

    expect(create).not.toHaveBeenCalled();
  });
});
