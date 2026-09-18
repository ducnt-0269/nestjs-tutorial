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

import { TagsModule } from './tags.module.js';

describe('GET /api/tags', () => {
  let app: INestApplication;
  const findMany = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate }),
        CommonModule,
        PrismaModule,
        // No AuthModule: the route carries no guard, so no strategy is needed.
        TagsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ tag: { findMany } })
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
    findMany.mockResolvedValue([{ name: 'dragons' }, { name: 'training' }]);
  });

  function read() {
    return request(app.getHttpServer()).get('/api/tags');
  }

  it('answers a reader who sent no token', async () => {
    const response = await read().expect(200);

    expect(response.body).toEqual({ tags: ['dragons', 'training'] });
  });

  it('asks only for the tags an article carries, in name order', async () => {
    await read().expect(200);

    expect(findMany).toHaveBeenCalledWith({
      where: { articles: { some: {} } },
      orderBy: { name: 'asc' },
      select: { name: true },
    });
  });

  it('answers an empty list when no article carries a tag', async () => {
    findMany.mockResolvedValue([]);

    await read().expect(200, { tags: [] });
  });

  it('names a tag once however many articles carry it', async () => {
    const response = await read().expect(200);

    // The rows come from the tags table, where the name is unique, so a tag on
    // a hundred articles is still one row and one entry here.
    expect(response.body.tags).toEqual([...new Set(response.body.tags)]);
  });

  it('leaves the answer cacheable', async () => {
    const response = await read().expect(200);

    expect(response.headers['cache-control']).toBeUndefined();
  });
});
