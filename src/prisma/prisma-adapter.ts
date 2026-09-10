import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma 7 requires a driver adapter; the datasource URL is no longer read from
 * schema.prisma.
 *
 * The Prisma CLI honours `?schema=` when it runs migrations, but the pg driver
 * ignores it. Without passing it on, migrations and queries would target
 * different schemas.
 */
export function createPrismaAdapter(configService: ConfigService): PrismaPg {
  const connectionString = configService.getOrThrow<string>('DATABASE_URL');
  const schema = new URL(connectionString).searchParams.get('schema');

  return new PrismaPg({ connectionString }, schema ? { schema } : undefined);
}
