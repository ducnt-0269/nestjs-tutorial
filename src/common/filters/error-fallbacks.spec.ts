import 'reflect-metadata';

import { type INestApplication, Logger } from '@nestjs/common';
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

import { validate } from '../../config/env.validation.js';
import { ProfilesModule } from '../../modules/profiles/profiles.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CommonModule } from '../common.module.js';

describe('error contract, paths no module owns', () => {
  let app: INestApplication;
  const findUnique = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate }),
        CommonModule,
        PrismaModule,
        ProfilesModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique } })
      .overrideProvider(Logger)
      .useValue({ error: vi.fn(), log: vi.fn(), warn: vi.fn() })
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
  });

  function expectEnvelope(body: unknown): Record<string, string[]> {
    expect(Object.keys(body as object)).toEqual(['errors']);
    const errors = (body as { errors: Record<string, string[]> }).errors;
    for (const messages of Object.values(errors)) {
      expect(messages.length).toBeGreaterThan(0);
      for (const message of messages) expect(message.trim()).not.toBe('');
    }
    return errors;
  }

  it('answers an unknown route through the same envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/nowhere')
      .expect(404);

    expect(Object.keys(expectEnvelope(response.body))).toEqual(['request']);
  });

  it('answers a body that is not JSON through the same envelope', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/users')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);

    expect(Object.keys(expectEnvelope(response.body))).toEqual(['request']);
  });

  it('hides the detail of a failure that carries a status of its own', async () => {
    findUnique.mockRejectedValue(
      Object.assign(new Error('pool exhausted at 10.0.0.1:5432'), {
        statusCode: 503,
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/api/profiles/jake')
      .expect(500);

    expect(expectEnvelope(response.body)).toEqual({
      server: ['internal error'],
    });
  });

  it('hides the detail of a failure nobody predicted', async () => {
    findUnique.mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.1:5432'),
    );

    const response = await request(app.getHttpServer())
      .get('/api/profiles/jake')
      .expect(500);

    expect(expectEnvelope(response.body)).toEqual({
      server: ['internal error'],
    });
  });
});
