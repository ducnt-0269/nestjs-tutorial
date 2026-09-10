import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';
import { RedisService } from './redis.service.js';

function createRedisClient(configService: ConfigService): Redis {
  const logger = new Logger('RedisClient');
  const client = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
    // Fail a command instead of queueing it while the connection is down.
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  // ioredis emits 'error' on every failed connection attempt. Without a
  // listener the process crashes on an unhandled event; without logging,
  // a wrong REDIS_URL would fail silently.
  client.on('error', (error: Error) => {
    logger.error(`Redis connection error: ${error.message}`);
  });

  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: createRedisClient,
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
