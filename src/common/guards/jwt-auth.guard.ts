import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// The scheme the spec puts in the Authorization header, and the name the
// OpenAPI document gives that security scheme.
export const TOKEN_SCHEME = 'Token';

// passport reports why authentication failed through the info argument it
// passes below. jsonwebtoken is only an indirect dependency, so the reason is
// read from the error name rather than through an instance check.
function reasonFor(info: unknown): string {
  const failure = info as { name?: string; message?: string } | undefined;
  if (failure?.name === 'TokenExpiredError') return 'has expired';
  if (failure?.message === 'No auth token') return 'is missing';
  return 'is invalid';
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Missing, invalid and expired reach the client as separate messages under
  // one key, rather than as the single message passport would produce.
  handleRequest<TUser>(_error: unknown, user: TUser, info: unknown): TUser {
    if (user) return user;
    throw new UnauthorizedException({ errors: { token: [reasonFor(info)] } });
  }
}
