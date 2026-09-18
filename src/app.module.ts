import * as path from 'node:path';

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n';

import { CommonModule } from './common/common.module.js';
import { validate } from './config/env.validation.js';
import { HelloController } from './hello/hello.controller.js';
import { ArticlesModule } from './modules/articles/articles.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CommentsModule } from './modules/comments/comments.module.js';
import { PasswordResetModule } from './modules/password-reset/password-reset.module.js';
import { ProfilesModule } from './modules/profiles/profiles.module.js';
import { TagsModule } from './modules/tags/tags.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        fallbackLanguage: 'en',
        loaderOptions: {
          path: path.join(import.meta.dirname, 'i18n'),
          // In production the translations live in dist and never change, so
          // the watcher only costs an fs handle.
          watch: configService.get('NODE_ENV') !== 'production',
        },
      }),
      imports: [ConfigModule],
      inject: [ConfigService],
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
      ],
    }),
    // The queue needs a connection of its own rather than the one the shared
    // client holds, because a worker refuses to start unless its connection
    // retries without limit. Offline queueing is off for the opposite reason
    // the shared client has it off: a command held until Redis returns would
    // hold the request that issued it open with it, and only on the branch of
    // the reset endpoint that found an account, which is the one difference
    // that endpoint exists not to report.
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.getOrThrow<string>('REDIS_URL'),
          maxRetriesPerRequest: null,
          enableOfflineQueue: false,
        },
      }),
    }),
    ScheduleModule.forRoot(),
    CommonModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    ProfilesModule,
    ArticlesModule,
    CommentsModule,
    TagsModule,
    PasswordResetModule,
  ],
  controllers: [HelloController],
})
export class AppModule {}
