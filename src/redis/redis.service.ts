import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleDestroy(): Promise<void> {
    // With enableOfflineQueue disabled, quit() rejects whenever the socket is
    // not writable — which is exactly the case when Redis is already gone.
    // disconnect() then clears the reconnect timer keeping the loop alive.
    await this.client.quit().catch(() => undefined);
    this.client.disconnect();
  }
}
