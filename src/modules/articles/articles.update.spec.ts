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

// Shape Prisma raises when the row a write targets is no longer there.
function rowGone(): Error {
  return new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
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

describe('PUT /api/articles/:slug', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const findUnique = vi.fn();
  const update = vi.fn();

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
        AuthModule,
        ArticlesModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ article: { findUnique, update } })
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
    update.mockReset();
    update.mockResolvedValue(storedArticle);
  });

  function edit(body: object, token = jwt.sign({ sub: '42' })) {
    return request(app.getHttpServer())
      .put(`/api/articles/${slug}`)
      .set('Authorization', `Token ${token}`)
      .send(body);
  }

  function dataOf(): Record<string, unknown> {
    const [{ data }] = update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    return data;
  }

  it('leaves the slug alone when the body carries no title', async () => {
    await edit({ article: { body: 'Rewritten.' } }).expect(200);

    const data = dataOf();
    expect(data).not.toHaveProperty('slug');
    expect(data.body).toBe('Rewritten.');
    expect(data.title).toBeUndefined();
    expect(data.description).toBeUndefined();
  });

  it('moves the slug when the title changes', async () => {
    await edit({ article: { title: 'A whole new name' } }).expect(200);

    expect(dataOf().slug).toMatch(/^a-whole-new-name-[0-9a-f]{8}$/);
  });

  it('updates the row it already read, by id', async () => {
    await edit({ article: { body: 'Rewritten.' } }).expect(200);

    const [call] = update.mock.calls[0] as [{ where: unknown }];
    expect(call.where).toEqual({ id: 7 });
  });

  it('refuses to edit an article belonging to someone else', async () => {
    await edit(
      { article: { body: 'Hijacked.' } },
      jwt.sign({ sub: '99' }),
    ).expect(403, { errors: { article: ['forbidden'] } });

    expect(update).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown slug, even to a caller who is not the author', async () => {
    findUnique.mockResolvedValue(null);

    await edit(
      { article: { body: 'Rewritten.' } },
      jwt.sign({ sub: '99' }),
    ).expect(404, { errors: { article: ['not found'] } });

    expect(update).not.toHaveBeenCalled();
  });

  it('answers 404 when the article is deleted between the read and the write', async () => {
    update.mockRejectedValue(rowGone());

    await edit({ article: { body: 'Rewritten.' } }).expect(404, {
      errors: { article: ['not found'] },
    });
  });

  it('rejects a request without a token', async () => {
    await request(app.getHttpServer())
      .put(`/api/articles/${slug}`)
      .send({ article: { body: 'Rewritten.' } })
      .expect(401, { errors: { token: ['is invalid'] } });

    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a title sent as an empty string', async () => {
    await edit({ article: { title: '' } }).expect(422, {
      errors: { title: ["can't be blank"] },
    });

    expect(update).not.toHaveBeenCalled();
  });
});
