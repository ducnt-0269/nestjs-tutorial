import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

export const TOKEN_SCHEME = 'Token';

// jsonwebtoken is an indirect dependency here, so the reason passport reports
// is read from the error name rather than through an instance check.
function reasonFor(info: unknown): string {
  const failure = info as { name?: string; message?: string } | undefined;
  if (failure?.name === 'TokenExpiredError') return 'has expired';
  if (failure?.message === 'No auth token') return 'is missing';
  return 'is invalid';
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Overridden to tell the three failures apart: passport reports only one.
  handleRequest<TUser>(error: unknown, user: TUser, info: unknown): TUser {
    // A failure inside the strategy is a server fault, not a rejected token.
    if (error) throw error;
    if (user) return user;
    throw new UnauthorizedException({ errors: { token: [reasonFor(info)] } });
  }
}
