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
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { TokenRevocationService } from '../auth/token-revocation.service.js';

import { ArticlesModule } from './articles.module.js';

const secret = 'test-secret-'.padEnd(32, 'x');

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

describe('POST /api/articles', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const create = vi.fn();

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
        // Registers the strategy; the route itself belongs to articles.
        AuthModule,
        ArticlesModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ article: { create } })
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
    // Echoes what the service asked to store, so the response carries the slug
    // that was really generated rather than one written into the fixture.
    create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 7,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        author: storedAuthor,
      }),
    );
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
});
