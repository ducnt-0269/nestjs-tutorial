import 'reflect-metadata';

import { DeleteObjectCommand } from '@aws-sdk/client-s3';
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
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { S3_CLIENT } from '../attachments/attachments.constants.js';
import { AuthModule } from '../auth/auth.module.js';
import { TokenRevocationService } from '../auth/token-revocation.service.js';

import { UsersModule } from './users.module.js';

const held = [{ objectKey: 'users/42/avatar.png' }];

describe('DELETE /api/user/image', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const send = vi.fn();
  const findMany = vi.fn();
  const deleteMany = vi.fn();
  const update = vi.fn();
  const transaction = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate }),
        CommonModule,
        PrismaModule,
        // Registers the strategy; the route itself belongs to users.
        AuthModule,
        UsersModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ $transaction: transaction })
      .overrideProvider(TokenRevocationService)
      .useValue({ isRevoked: () => Promise.resolve(false) })
      .overrideProvider(S3_CLIENT)
      .useValue({ send })
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
    for (const mock of [send, findMany, deleteMany, update]) {
      mock.mockReset();
    }
    send.mockResolvedValue({});
    findMany.mockResolvedValue(held);
    deleteMany.mockResolvedValue({ count: 1 });
    update.mockResolvedValue({});
    transaction.mockReset();
    transaction.mockImplementation((run: (tx: unknown) => Promise<unknown>) =>
      run({ attachment: { findMany, deleteMany }, user: { update } }),
    );
  });

  function remove(token: string | null = jwt.sign({ sub: '42' })) {
    const call = request(app.getHttpServer()).delete('/api/user/image');
    if (token) call.set('Authorization', `Token ${token}`);
    return call;
  }

  it('removes the row, the stored object, and the column that pointed at it', async () => {
    await remove().expect(204);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { ownerType: 'User', ownerId: 42 },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { image: null },
    });

    const [command] = send.mock.calls[0] as [DeleteObjectCommand];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input.Key).toBe(held[0].objectKey);
  });

  it('answers 404 when the account holds no avatar, changing nothing', async () => {
    findMany.mockResolvedValue([]);

    const response = await remove().expect(404);

    expect(response.body).toEqual({ errors: { attachment: ['not found'] } });
    expect(update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses a caller with no token', async () => {
    const response = await remove(null).expect(401);

    expect(response.body).toEqual({ errors: { token: ['is invalid'] } });
    expect(transaction).not.toHaveBeenCalled();
  });
});
