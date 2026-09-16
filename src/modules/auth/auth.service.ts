import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type UserWithToken, UsersService } from '../users/users.service.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

const INVALID_CREDENTIALS = { errors: { credentials: ['invalid'] } };

// Issues and refuses tokens. Storing and checking a password belongs to the
// module that owns the column, so no hash ever reaches this file.
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<UserWithToken> {
    const user = await this.usersService.create(input);
    return { ...user, token: this.tokenFor(user.id) };
  }

  async login(input: LoginInput): Promise<UserWithToken> {
    const user = await this.usersService.findByCredentials(
      input.email,
      input.password,
    );

    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    return { ...user, token: this.tokenFor(user.id) };
  }

  // Id only, nothing that PUT /user could make stale. The subject is a
  // string per RFC 7519, and the identifier keeps two sign-ins of the same
  // account within one second from minting the very same token, which
  // revoking either one would otherwise end.
  private tokenFor(userId: number): string {
    return this.jwtService.sign({ sub: String(userId), jti: randomUUID() });
  }
}
