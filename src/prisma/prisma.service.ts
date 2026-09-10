import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PrismaPg } from '@prisma/adapter-pg';
import { createPrismaAdapter } from './prisma-adapter.js';
import { PrismaClient } from '../generated/prisma/client.js';

// Declared once so the class generic and the constructor cannot disagree.
// The generic is what makes `prisma.user.*` result types drop `password`,
// not only the runtime value.
const omit = { user: { password: true } } as const;
type ClientOptions = { adapter: PrismaPg; omit: typeof omit };

@Injectable()
export class PrismaService
  extends PrismaClient<ClientOptions>
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    // The password hash never leaves this service unless a query opts back
    // in with `omit: { password: false }` (docs/system-architecture.md §6.3).
    super({ adapter: createPrismaAdapter(configService), omit });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
