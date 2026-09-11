import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../redis/redis.service.js';

@Injectable()
export class TokenRevocationService {
  constructor(
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
  ) {}

  async revoke(token: string): Promise<void> {
    // Already verified by the guard, so reading the claims is enough.
    const payload = this.jwt.decode<{ exp?: number } | null>(token);
    const remaining = (payload?.exp ?? 0) - Math.floor(Date.now() / 1000);

    // An expired token has nothing left to revoke, and Redis refuses an
    // expiry of zero or less. The entry then disappears with the token.
    if (remaining > 0) {
      await this.redis.setWithExpiry(this.keyFor(token), '1', remaining);
    }
  }

  // A failure travels on rather than answering false: no request may pass
  // while the blacklist is unreachable.
  isRevoked(token: string): Promise<boolean> {
    return this.redis.exists(this.keyFor(token));
  }

  // The token itself never reaches Redis; its digest stands in for it.
  private keyFor(token: string): string {
    return `revoked:${createHash('sha256').update(token).digest('hex')}`;
  }
}
