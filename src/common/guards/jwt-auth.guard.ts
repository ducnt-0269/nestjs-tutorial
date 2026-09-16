import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { invalidToken } from '../errors/api-error.js';

export const TOKEN_SCHEME = 'Token';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Overridden for the error shape only: passport answers with its own body.
  handleRequest<TUser>(error: unknown, user: TUser): TUser {
    // A failure inside the strategy is a server fault, not a rejected token.
    if (error) throw error;
    if (user) return user;
    throw invalidToken();
  }
}
