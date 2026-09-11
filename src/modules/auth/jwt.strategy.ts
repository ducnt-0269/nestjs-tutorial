import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TOKEN_SCHEME } from '../../common/guards/jwt-auth.guard.js';
import { TokenRevocationService } from './token-revocation.service.js';

// Reused inside validate: passport hands over the decoded payload only.
const extractToken = ExtractJwt.fromAuthHeaderWithScheme(TOKEN_SCHEME);

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly revocation: TokenRevocationService,
  ) {
    super({
      jwtFromRequest: extractToken,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(
    request: Request,
    payload: { sub: string },
  ): Promise<Express.User | null> {
    // Verification has already extracted this token, so it cannot be null.
    const token = extractToken(request) as string;

    // Answering with no caller leaves the guard to phrase the rejection, so a
    // revoked token reads the same as an expired one.
    if (await this.revocation.isRevoked(token)) return null;

    return { id: Number(payload.sub), token };
  }
}
