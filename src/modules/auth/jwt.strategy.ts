import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TOKEN_SCHEME } from '../../common/guards/jwt-auth.guard.js';

// Declared once and reused below: passport hands the callback the decoded
// payload only, and the raw token is needed as well so a response can echo it.
const extractToken = ExtractJwt.fromAuthHeaderWithScheme(TOKEN_SCHEME);

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: extractToken,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  // The return value becomes the caller on the request.
  validate(request: Request, payload: { sub: string }): Express.User {
    // Verification has already extracted this token, so it cannot be null.
    const token = extractToken(request) as string;
    return { id: Number(payload.sub), token };
  }
}
