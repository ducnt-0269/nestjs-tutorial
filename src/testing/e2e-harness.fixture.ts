import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach } from 'vitest';

import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { assertTestDatabase } from './test-database.js';

export interface Actor {
  id: number;
  username: string;
  token: string;
}

// The one table a run must not empty: it is what tells the migration tool
// which migrations this database already has.
const MIGRATION_HISTORY = '_prisma_migrations';

// Long enough for the registration rule, and the same for everyone, because no
// test turns on which password an account has.
const PASSWORD = 'password123';

/**
 * An application, a database and an identity: what every end-to-end suite needs
 * before it can say anything about a feature. Nothing here knows which feature
 * is under test, so a suite builds its own request helpers on top.
 *
 * The whole application module is loaded rather than a hand-assembled subset:
 * the point of this run is that the wiring a request passes through is the
 * wiring the server actually starts with.
 */
export function useApiHarness() {
  let app: INestApplication;
  let prisma: PrismaService;
  let quotedTables: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // The bootstrap applies the prefix outside the module graph, so a test
    // that skipped this would be calling routes the server does not serve.
    app.setGlobalPrefix('/api');
    await app.init();

    assertTestDatabase(
      app.get(ConfigService).getOrThrow<string>('DATABASE_URL'),
    );
    prisma = app.get(PrismaService);
    quotedTables = await readTables();
  });

  beforeEach(async () => {
    await truncate();
  });

  afterAll(async () => {
    // Emptied once more on the way out, so the last test of the run leaves as
    // little behind as every earlier one did.
    await truncate();
    await app.close();
  });

  /**
   * Asked of the database rather than written out by hand, so that a model
   * added later is emptied too. A list kept by hand would leave the new table
   * filling up while every suite still passes, and the claim that a run leaves
   * nothing behind would quietly stop being true.
   */
  async function readTables(): Promise<string> {
    const rows = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> ${MIGRATION_HISTORY}
    `;

    return rows.map((row) => `"${row.tablename}"`).join(', ');
  }

  // Restarting the identity sequences keeps the ids a test sees the same from
  // one run to the next, whatever order the files happened to execute in.
  // Cascading settles the order the tables have to be emptied in.
  async function truncate(): Promise<void> {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`,
    );
  }

  return {
    // Arrow properties so a suite can destructure them without the
    // unbound-method warning a shorthand method would raise.

    http: () => request(app.getHttpServer()),

    // A header is set only when there is a token, because leaving it off
    // entirely is what a signed-out caller actually sends.
    authorize: (call: request.Test, token: string | null): request.Test =>
      token ? call.set('Authorization', `Token ${token}`) : call,

    prisma: (): PrismaService => prisma,

    // Signs an account up over the API, so the token under test is one the
    // application itself issued. The identifier comes back from the database
    // because the account response does not publish it.
    register: async (username: string): Promise<Actor> => {
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .send({
          user: {
            username,
            email: `${username}@example.com`,
            password: PASSWORD,
          },
        })
        .expect(201);

      const user = await prisma.user.findUniqueOrThrow({ where: { username } });

      return {
        id: user.id,
        username,
        token: response.body.user.token as string,
      };
    },
  };
}
