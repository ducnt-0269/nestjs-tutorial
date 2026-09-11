import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// The scheme the spec puts in the Authorization header, and the name the
// OpenAPI document gives that security scheme.
export const TOKEN_SCHEME = 'Token';

// passport-jwt reports why authentication failed through the info argument:
// an error named TokenExpiredError, or a plain error reading "No auth token"
// when the header is absent. jsonwebtoken is only an indirect dependency, so
// the reason is read from the name rather than through an instance check. The
// three messages are pinned by the tests around GET /api/user, which is what
// keeps this honest if the library ever rewords them.
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
  handleRequest<TUser>(error: unknown, user: TUser, info: unknown): TUser {
    // A failure raised inside the strategy is a server fault, not a rejected
    // token. Passing it on keeps it going to the filter, the only place that
    // logs an unknown error, instead of answering 401 and leaving no trace.
    if (error) throw error;
    if (user) return user;
    throw new UnauthorizedException({ errors: { token: [reasonFor(info)] } });
  }
}
