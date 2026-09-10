import * as path from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import { CommonModule } from './common/common.module.js';
import { HelloController } from './hello/hello.controller.js';
import { validate } from './config/env.validation.js';
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
    CommonModule,
    PrismaModule,
    RedisModule,
  ],
  controllers: [HelloController],
})
export class AppModule {}
